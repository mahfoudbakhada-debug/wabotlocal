// twilio.js
// -----------------------------------------------------------------------
// Toda la logica del asistente de WhatsApp:
//   - Deteccion de saludos -> muestra menu
//   - Opcion 1: Info / servicios / carta
//   - Opcion 2: Flujo de reserva (dia -> hora -> nombre -> servicio -> confirmar)
//   - Opcion 3: Aviso para hablar con una persona
// -----------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const twilio = require("twilio");
const { getSesion, setSesion, resetSesion, ESTADOS } = require("./sessionStore");
const { buscarHuecosLibres, crearEvento } = require("./calendar");
const { guardarReserva } = require("./sheets");
const { parsearFecha } = require("./dateParser");

function cargarConfig() {
  // Se recarga en cada mensaje para reflejar cambios hechos desde el panel admin
  const raw = fs.readFileSync(path.join(__dirname, "config.json"), "utf-8");
  return JSON.parse(raw);
}

const SALUDOS = ["hola", "buenas", "info", "menu", "menú", "inicio", "hi", "hello"];

function esSaludo(texto) {
  const limpio = texto.trim().toLowerCase();
  return SALUDOS.some((s) => limpio.includes(s));
}

function mensajeMenu(config) {
  return `Hola! Soy el asistente virtual de ${config.nombre_negocio} 👋

1️⃣ Ver servicios/precios
2️⃣ Reservar cita
3️⃣ Hablar con una persona

Responde con el numero de la opcion que quieras.`;
}

function mensajeInfo(config) {
  let texto = `📋 *${config.nombre_negocio}*\n\n${config.mensaje_bienvenida}\n\n`;
  if (config.servicios && config.servicios.length) {
    texto += "*Servicios y precios:*\n";
    config.servicios.forEach((s) => {
      texto += `• ${s.nombre} - ${s.precio} (${s.duracion_min} min)\n`;
    });
  }
  if (config.link_google_maps) {
    texto += `\n📍 Ubicacion: ${config.link_google_maps}`;
  }
  texto += `\n\nEscribe "menu" para volver al menu principal.`;
  return texto;
}

/**
 * Procesa el mensaje entrante y devuelve el texto de respuesta (string).
 * Tambien indica si hay que enviar un media adicional (ej: PDF de la carta).
 */
async function procesarMensaje(telefono, textoEntrante) {
  const config = cargarConfig();
  const texto = (textoEntrante || "").trim();
  const sesion = getSesion(telefono);

  // Comando universal: volver al menu desde cualquier estado
  if (esSaludo(texto)) {
    resetSesion(telefono);
    setSesion(telefono, { estado: ESTADOS.MENU });
    return { respuesta: mensajeMenu(config), enviarCarta: false };
  }

  switch (sesion.estado) {
    // ------------------------------------------------------------
    case ESTADOS.MENU:
    case ESTADOS.INICIO: {
      if (texto === "1") {
        setSesion(telefono, { estado: ESTADOS.MENU });
        const hayCarta = fs.existsSync(path.join(__dirname, "public", "carta.pdf"));
        return { respuesta: mensajeInfo(config), enviarCarta: hayCarta };
      }

      if (texto === "2") {
        setSesion(telefono, { estado: ESTADOS.RESERVA_PIDIENDO_DIA, datos: {} });
        return {
          respuesta:
            "Vamos a reservar tu cita 📅\n¿Que dia quieres? Ej: mañana, lunes, 25/08",
          enviarCarta: false,
        };
      }

      if (texto === "3") {
        setSesion(telefono, { estado: ESTADOS.MENU });
        return {
          respuesta: `Claro, en breve te atendera una persona del equipo. Tambien puedes llamarnos directamente al ${config.telefono_humano} 📞`,
          enviarCarta: false,
        };
      }

      // No entendio la opcion
      return {
        respuesta: `No entendi tu respuesta 🤔\n\n${mensajeMenu(config)}`,
        enviarCarta: false,
      };
    }

    // ------------------------------------------------------------
    case ESTADOS.RESERVA_PIDIENDO_DIA: {
      const fechaISO = parsearFecha(texto);
      if (!fechaISO) {
        return {
          respuesta:
            'No entendi la fecha 😕 Prueba con algo como "mañana", "lunes" o "25/08".',
          enviarCarta: false,
        };
      }

      let huecos;
      try {
        huecos = await buscarHuecosLibres(fechaISO);
      } catch (err) {
        console.error("Error consultando Google Calendar:", err.message);
        return {
          respuesta:
            "Ups, tuve un problema consultando la agenda. Intenta de nuevo en unos minutos o escribe 3 para hablar con una persona.",
          enviarCarta: false,
        };
      }

      if (!huecos.length) {
        return {
          respuesta:
            "No hay huecos libres ese dia 😔 ¿Quieres probar con otro dia? Ej: mañana, lunes, 25/08",
          enviarCarta: false,
        };
      }

      setSesion(telefono, {
        estado: ESTADOS.RESERVA_PIDIENDO_HORA,
        datos: { fechaISO, huecosDisponibles: huecos },
      });

      return {
        respuesta: `Tengo libre ese dia: ${huecos.join(", ")}\n\n¿A que hora te viene bien? (escribe la hora, ej: 10:00)`,
        enviarCarta: false,
      };
    }

    // ------------------------------------------------------------
    case ESTADOS.RESERVA_PIDIENDO_HORA: {
      const horaLimpia = texto.match(/(\d{1,2}):?(\d{2})?/);
      let horaElegida = null;

      if (horaLimpia) {
        const h = horaLimpia[1].padStart(2, "0");
        const m = (horaLimpia[2] || "00").padStart(2, "0");
        horaElegida = `${h}:${m}`;
      }

      const huecos = sesion.datos.huecosDisponibles || [];
      if (!horaElegida || !huecos.includes(horaElegida)) {
        return {
          respuesta: `Esa hora no esta disponible. Elige una de estas: ${huecos.join(", ")}`,
          enviarCarta: false,
        };
      }

      setSesion(telefono, {
        estado: ESTADOS.RESERVA_PIDIENDO_NOMBRE,
        datos: { horaElegida },
      });

      return { respuesta: "Perfecto! ¿Cual es tu nombre?", enviarCarta: false };
    }

    // ------------------------------------------------------------
    case ESTADOS.RESERVA_PIDIENDO_NOMBRE: {
      if (!texto) {
        return { respuesta: "¿Cual es tu nombre?", enviarCarta: false };
      }

      setSesion(telefono, {
        estado: ESTADOS.RESERVA_PIDIENDO_SERVICIO,
        datos: { nombre: texto },
      });

      const listaServicios = (config.servicios || [])
        .map((s, i) => `${i + 1}. ${s.nombre} - ${s.precio}`)
        .join("\n");

      return {
        respuesta: `Gracias ${texto}! ¿Que servicio quieres? \n${listaServicios}\n\n(escribe el numero o el nombre del servicio)`,
        enviarCarta: false,
      };
    }

    // ------------------------------------------------------------
    case ESTADOS.RESERVA_PIDIENDO_SERVICIO: {
      const servicios = config.servicios || [];
      let servicioElegido = null;

      const numero = parseInt(texto, 10);
      if (!isNaN(numero) && servicios[numero - 1]) {
        servicioElegido = servicios[numero - 1].nombre;
      } else {
        const encontrado = servicios.find((s) =>
          s.nombre.toLowerCase().includes(texto.toLowerCase())
        );
        if (encontrado) servicioElegido = encontrado.nombre;
      }

      if (!servicioElegido) {
        return {
          respuesta: "No reconozco ese servicio. Escribe el numero de la lista anterior.",
          enviarCarta: false,
        };
      }

      const { fechaISO, horaElegida, nombre } = sesion.datos;

      // Crear evento en Google Calendar
      try {
        await crearEvento({
          nombre,
          telefono,
          fechaISO,
          hora: horaElegida,
          servicio: servicioElegido,
        });
      } catch (err) {
        console.error("Error creando evento en Calendar:", err.message);
        return {
          respuesta:
            "Ups, hubo un problema creando tu cita en el calendario. Por favor intenta de nuevo o escribe 3 para hablar con una persona.",
          enviarCarta: false,
        };
      }

      // Guardar en Google Sheets
      try {
        await guardarReserva({
          nombre,
          telefono,
          fecha: fechaISO,
          hora: horaElegida,
          servicio: servicioElegido,
          estado: "Confirmada",
        });
      } catch (err) {
        // La cita ya se creo en Calendar aunque falle el registro en Sheets;
        // lo registramos pero no bloqueamos la confirmacion al cliente.
        console.error("Error guardando en Google Sheets:", err.message);
      }

      resetSesion(telefono);

      return {
        respuesta: `Perfecto ${nombre}, reservado para el ${fechaISO} a las ${horaElegida}. Te esperamos! 🎉\n\nEscribe "menu" si necesitas algo mas.`,
        enviarCarta: false,
      };
    }

    // ------------------------------------------------------------
    default: {
      resetSesion(telefono);
      return { respuesta: mensajeMenu(config), enviarCarta: false };
    }
  }
}

/**
 * Maneja la peticion del webhook de Twilio: lee el mensaje entrante,
 * procesa la logica y responde usando TwiML (formato XML que Twilio requiere).
 */
async function manejarWebhook(req, res) {
  const from = req.body.From; // ej: "whatsapp:+34600111222"
  const body = req.body.Body || "";

  if (!from) {
    return res.status(400).send("Falta el campo From");
  }

  const { respuesta, enviarCarta } = await procesarMensaje(from, body);

  const MessagingResponse = twilio.twiml.MessagingResponse;
  const twiml = new MessagingResponse();
  const msg = twiml.message(respuesta);

  // Si hay que enviar la carta/menu en PDF, la adjuntamos como media.
  // Twilio requiere una URL publica accesible, no un archivo local directo.
  if (enviarCarta) {
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    msg.media(`${baseUrl}/carta.pdf`);
  }

  res.type("text/xml").send(twiml.toString());
}

module.exports = { manejarWebhook, procesarMensaje };
