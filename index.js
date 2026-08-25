const fs = require('fs');
const express = require('express');
const { google } = require('googleapis');

if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync('./credentials.json', process.env.GOOGLE_CREDENTIALS);
  console.log('✅ Credenciales cargadas');
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });
const calendarId = process.env.GOOGLE_CALENDAR_ID;
console.log('CalendarID cargado:', calendarId);

app.get('/', (req, res) => res.send('wabotlocal OK'));

app.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body || '';
  const de = req.body.From || '';
  console.log(`MSG de ${de}: ${mensaje}`);

  let respuesta = "Dime: mañana a las 10am";

  try {
    if (mensaje.toLowerCase().includes('mañana')) {
      let hora = 10;
      const match = mensaje.match(/(\d{1,2})/);
      if (match) hora = parseInt(match[1]);

      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(hora, 0, 0, 0);
      const fin = new Date(fecha);
      fin.setHours(hora + 1);

      const evento = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: {
          summary: `Cita WhatsApp - ${de}`,
          description: mensaje,
          start: { dateTime: fecha.toISOString(), timeZone: 'Europe/Madrid' },
          end: { dateTime: fin.toISOString(), timeZone: 'Europe/Madrid' },
        },
      });
      console.log('✅ Cita creada:', evento.data.id);
      respuesta = `¡Perfecto! Cita mañana a las ${hora}:00 creada ✅ ID: ${evento.data.id}`;
    }
  } catch (error) {
    console.error('ERROR REAL:', JSON.stringify(error, null, 2));
    // Esto te lo mandará por WhatsApp para saber el fallo
    respuesta = `ERROR REAL: ${error.message}. CalendarID: ${calendarId}. Mira logs Render.`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server puerto ${PORT}`));
