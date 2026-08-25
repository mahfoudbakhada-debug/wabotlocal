const fs = require('fs');
const express = require('express');
const { google } = require('googleapis');

// 1. ARREGLO DE SEGURIDAD: Crea credentials.json desde Render
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync('./credentials.json', process.env.GOOGLE_CREDENTIALS);
  console.log('✅ Credenciales cargadas desde variable de entorno');
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 2. Config Google Calendar
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });
const calendarId = process.env.GOOGLE_CALENDAR_ID;

app.get('/', (req, res) => {
  res.send('wabotlocal funcionando ✅');
});

// 3. WEBHOOK DE TWILIO - WHATSAPP
app.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body || '';
  const de = req.body.From || '';
  console.log(`Mensaje de ${de}: ${mensaje}`);

  let respuesta = "¡Hola! Dime qué día y hora quieres tu cita. Ej: mañana a las 10am";

  try {
    // Detectar fecha simple para tu demo: "mañana 10am" / "mañana 10:00"
    if (mensaje.toLowerCase().includes('mañana')) {
      let hora = 10;
      const match = mensaje.match(/(\d{1,2})(?::(\d{2}))?/);
      if (match) hora = parseInt(match[1]);

      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(hora, 0, 0, 0);

      const fin = new Date(fecha);
      fin.setHours(hora + 1);

      // Crear evento en Google Calendar
      await calendar.events.insert({
        calendarId: calendarId,
        requestBody: {
          summary: `Cita WhatsApp - ${de}`,
          description: `Mensaje original: ${mensaje}`,
          start: { dateTime: fecha.toISOString(), timeZone: 'Europe/Madrid' },
          end: { dateTime: fin.toISOString(), timeZone: 'Europe/Madrid' },
        },
      });

      console.log('✅ Cita creada en calendario');
      respuesta = `¡Perfecto! Te he reservado la cita para mañana a las ${hora}:00. Ya la puedes ver en tu Google Calendar.`;
    }
  } catch (error) {
    console.error('Error creando cita:', error.message);
    respuesta = "He tenido un problema creando la cita, pero he recibido tu mensaje.";
  }

  // Responder a WhatsApp (Twilio)
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server en puerto ${PORT}`));
