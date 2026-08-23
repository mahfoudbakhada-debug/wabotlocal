// cron.js
// -----------------------------------------------------------------------
// Tarea programada que se ejecuta todos los dias a las 10:00 (hora local
// configurable via CRON_TIMEZONE en el .env).
//
// Busca en Google Sheets los clientes que tuvieron cita hace 24 horas
// y les envia un mensaje de WhatsApp pidiendo una resena en Google.
//
// COMO EJECUTARLO:
//   - En local / VPS con proceso persistente: `node cron.js` (queda corriendo
//     en segundo plano y dispara la tarea cada dia a las 10:00).
//   - En Railway/Render: se puede desplegar como "Cron Job" / cronjob programado
//     que ejecute `node cron.js --once` una vez al dia (ver mas abajo).
// -----------------------------------------------------------------------

require("dotenv").config();
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const twilio = require("twilio");

const { obtenerReservasDeHace24h, marcarResenaEnviada } = require("./sheets");

function cargarConfig() {
  const raw = fs.readFileSync(path.join(__dirname, "config.json"), "utf-8");
  return JSON.parse(raw);
}

function getClienteTwilio() {
  return twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Ejecuta la tarea de envio de resenas una vez.
 */
async function ejecutarTareaResenas() {
  console.log(`[${new Date().toISOString()}] Ejecutando tarea de resenas...`);
  const config = cargarConfig();

  let reservas;
  try {
    reservas = await obtenerReservasDeHace24h();
  } catch (err) {
    console.error("Error leyendo reservas de Google Sheets:", err.message);
    return;
  }

  if (!reservas.length) {
    console.log("No hay clientes de hace 24h para pedir resena.");
    return;
  }

  const client = getClienteTwilio();

  for (const reserva of reservas) {
    const numeroDestino = reserva.telefono.startsWith("whatsapp:")
      ? reserva.telefono
      : `whatsapp:${reserva.telefono}`;

    const mensaje = `Hola ${reserva.nombre}! Que tal fue ayer en ${config.nombre_negocio}? Nos ayudarias mucho con una resena aqui: ${config.link_resenas_google}`;

    try {
      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: numeroDestino,
        body: mensaje,
      });
      console.log(`Resena solicitada a ${reserva.nombre} (${reserva.telefono})`);

      // Marcamos la fila para no volver a enviar el mismo mensaje otro dia
      await marcarResenaEnviada(reserva.filaIndex);
    } catch (err) {
      console.error(`Error enviando WhatsApp a ${reserva.telefono}:`, err.message);
    }
  }

  console.log(`Tarea de resenas finalizada. ${reservas.length} mensaje(s) procesado(s).`);
}

// --- Modo "una sola ejecucion", util para cron jobs de Railway/Render ---
// Uso: node cron.js --once
if (process.argv.includes("--once")) {
  ejecutarTareaResenas().then(() => process.exit(0));
} else {
  // --- Modo proceso persistente: programa la tarea todos los dias a las 10:00 ---
  const timezone = process.env.CRON_TIMEZONE || "Europe/Madrid";

  cron.schedule(
    "0 10 * * *", // minuto 0, hora 10, todos los dias
    () => {
      ejecutarTareaResenas().catch((err) =>
        console.error("Error inesperado en la tarea de resenas:", err)
      );
    },
    { timezone }
  );

  console.log(`⏰ Cron de resenas programado: todos los dias a las 10:00 (${timezone})`);
  console.log("   Este proceso debe mantenerse corriendo en segundo plano.");
}

module.exports = { ejecutarTareaResenas };
