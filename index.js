const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });
const calendarId = 'primary';

app.get('/', (req, res) => res.send('wabotlocal OK'));

app.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body || '';
  const de = req.body.From || '';
  console.log(`MSG: ${mensaje}`);

  let respuesta = "Dime: mañana a las 10am";
  try {
    if (mensaje.toLowerCase().includes('mañana')) {
      let hora = 10;
      const m = mensaje.match(/(\d{1,2})/);
      if (m) hora = parseInt(m[1]);
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(hora, 0, 0, 0);
      const fin = new Date(fecha);
      fin.setHours(hora + 1);

      await calendar.events.insert({
        calendarId,
        requestBody: {
          summary: `Cita - ${de}`,
          description: mensaje,
          start: { dateTime: fecha.toISOString(), timeZone: 'Europe/Madrid' },
          end: { dateTime: fin.toISOString(), timeZone: 'Europe/Madrid' },
        },
      });
      respuesta = `¡Perfecto! Cita mañana a las ${hora}:00 creada ✅`;
    }
  } catch (e) {
    console.error(e.message);
    respuesta = `Error: ${e.message}`;
  }
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

app.listen(process.env.PORT || 10000, () => console.log('Server OK'));
