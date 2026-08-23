// sheets.js
// -----------------------------------------------------------------------
// Integracion con Google Sheets API usando una Service Account.
// La hoja debe tener la siguiente cabecera en la fila 1:
//   Nombre | Telefono | Fecha | Hora | Servicio | Estado
//
// Funciones:
//   - guardarReserva(datos)       -> añade una fila nueva
//   - obtenerReservasDeHace24h()  -> usado por cron.js para resenas
// -----------------------------------------------------------------------

const { google } = require("googleapis");
require("dotenv").config();

const NOMBRE_HOJA = "Reservas"; // nombre de la pestaña dentro del Sheet
const RANGO_COMPLETO = `${NOMBRE_HOJA}!A:F`;

function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
}

function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

/**
 * Se asegura de que la hoja tenga la cabecera correcta.
 * Se llama automaticamente antes de escribir si la hoja esta vacia.
 */
async function asegurarCabecera() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${NOMBRE_HOJA}!A1:F1`,
  });

  if (!resp.data.values || resp.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${NOMBRE_HOJA}!A1:F1`,
      valueInputOption: "RAW",
      resource: {
        values: [["Nombre", "Telefono", "Fecha", "Hora", "Servicio", "Estado"]],
      },
    });
  }
}

/**
 * Guarda una reserva nueva en la hoja de calculo.
 * datos = { nombre, telefono, fecha, hora, servicio, estado }
 */
async function guardarReserva({ nombre, telefono, fecha, hora, servicio, estado }) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID;

  await asegurarCabecera();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: RANGO_COMPLETO,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [[nombre, telefono, fecha, hora, servicio || "", estado || "Confirmada"]],
    },
  });
}

/**
 * Lee todas las filas de la hoja y devuelve las reservas cuya
 * Fecha corresponde exactamente a "hace 24 horas" (usado por el cron de resenas).
 * Devuelve array de objetos { nombre, telefono, fecha, hora, servicio, estado, filaIndex }
 */
async function obtenerReservasDeHace24h() {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID;

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: RANGO_COMPLETO,
  });

  const filas = resp.data.values || [];
  if (filas.length <= 1) return []; // solo cabecera o vacio

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerISO = ayer.toISOString().split("T")[0]; // YYYY-MM-DD

  const resultado = [];

  // Empezamos en 1 para saltar la cabecera
  for (let i = 1; i < filas.length; i++) {
    const [nombre, telefono, fecha, hora, servicio, estado] = filas[i];
    if (fecha === ayerISO && estado !== "Resena_Enviada") {
      resultado.push({ nombre, telefono, fecha, hora, servicio, estado, filaIndex: i + 1 });
    }
  }

  return resultado;
}

/**
 * Marca una fila como "Resena_Enviada" para no volver a enviar el mensaje.
 */
async function marcarResenaEnviada(filaIndex) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.SHEET_ID;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${NOMBRE_HOJA}!F${filaIndex}`,
    valueInputOption: "RAW",
    resource: { values: [["Resena_Enviada"]] },
  });
}

module.exports = {
  guardarReserva,
  obtenerReservasDeHace24h,
  marcarResenaEnviada,
};
