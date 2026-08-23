// calendar.js
// -----------------------------------------------------------------------
// Integracion con Google Calendar API usando una Service Account.
// Funciones:
//   - buscarHuecosLibres(fecha)  -> array de horas "HH:MM" disponibles
//   - crearEvento(datos)         -> crea la cita en el calendario
// -----------------------------------------------------------------------

const { google } = require("googleapis");
require("dotenv").config();

const config = require("./config.json");

// --- Autenticacion con Service Account ---
function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    // El .env guarda los saltos de linea como "\n" literal, hay que convertirlos
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/calendar"]
  );
}

function getCalendarClient() {
  const auth = getAuth();
  return google.calendar({ version: "v3", auth });
}

/**
 * Genera todos los slots posibles de un dia segun el horario configurado
 * (por defecto 09:00 a 20:00 cada 30 minutos).
 */
function generarSlotsDelDia() {
  const slots = [];
  const [horaIni, minIni] = config.horario_apertura.split(":").map(Number);
  const [horaFin, minFin] = config.horario_cierre.split(":").map(Number);
  const duracion = config.duracion_cita_min || 30;

  let minutos = horaIni * 60 + minIni;
  const minutosFin = horaFin * 60 + minFin;

  while (minutos + duracion <= minutosFin) {
    const h = Math.floor(minutos / 60)
      .toString()
      .padStart(2, "0");
    const m = (minutos % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    minutos += duracion;
  }
  return slots;
}

/**
 * Busca huecos libres en el calendario para una fecha dada (formato YYYY-MM-DD).
 * Devuelve un array de horas libres, ej: ["10:00", "10:30", "12:00"]
 */
async function buscarHuecosLibres(fechaISO) {
  const calendar = getCalendarClient();
  const calendarId = process.env.CALENDAR_ID || "primary";

  const inicioDelDia = new Date(`${fechaISO}T00:00:00`);
  const finDelDia = new Date(`${fechaISO}T23:59:59`);

  // Consultamos los eventos ya existentes ese dia
  const respuesta = await calendar.events.list({
    calendarId,
    timeMin: inicioDelDia.toISOString(),
    timeMax: finDelDia.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const eventosOcupados = (respuesta.data.items || []).map((ev) => {
    const inicio = new Date(ev.start.dateTime || ev.start.date);
    const fin = new Date(ev.end.dateTime || ev.end.date);
    return { inicio, fin };
  });

  const todosLosSlots = generarSlotsDelDia();
  const duracion = config.duracion_cita_min || 30;

  const libres = todosLosSlots.filter((horaStr) => {
    const [h, m] = horaStr.split(":").map(Number);
    const inicioSlot = new Date(fechaISO);
    inicioSlot.setHours(h, m, 0, 0);
    const finSlot = new Date(inicioSlot.getTime() + duracion * 60000);

    // El slot esta libre si no se solapa con ningun evento existente
    const seSolapa = eventosOcupados.some(
      (ev) => inicioSlot < ev.fin && finSlot > ev.inicio
    );

    // Si es hoy, descartamos horas que ya han pasado
    const ahora = new Date();
    const esPasado = inicioSlot < ahora;

    return !seSolapa && !esPasado;
  });

  return libres;
}

/**
 * Crea un evento/cita en Google Calendar.
 * datos = { nombre, telefono, fechaISO, hora, servicio }
 */
async function crearEvento({ nombre, telefono, fechaISO, hora, servicio }) {
  const calendar = getCalendarClient();
  const calendarId = process.env.CALENDAR_ID || "primary";
  const duracion = config.duracion_cita_min || 30;

  const [h, m] = hora.split(":").map(Number);
  const inicio = new Date(fechaISO);
  inicio.setHours(h, m, 0, 0);
  const fin = new Date(inicio.getTime() + duracion * 60000);

  const evento = {
    summary: `Cita: ${nombre} - ${servicio || "Servicio"}`,
    description: `Cliente: ${nombre}\nTelefono: ${telefono}\nServicio: ${servicio || "No especificado"}\nReservado via WabotLocal`,
    start: { dateTime: inicio.toISOString() },
    end: { dateTime: fin.toISOString() },
  };

  const respuesta = await calendar.events.insert({
    calendarId,
    resource: evento,
  });

  return respuesta.data;
}

module.exports = { buscarHuecosLibres, crearEvento, generarSlotsDelDia };
