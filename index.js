const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Lee credenciales directo de la variable, sin archivo
let auth;
try {
  const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  console.log('✅ Credenciales cargadas bien');
} catch (e) {
  console.error('❌ GOOGLE_CREDENTIALS mal pegado:', e.message);
}

const calendar = google.calendar({ version: 'v3', auth });
const calendarId = 'primary';
console.log('CalendarID:', calendarId);

app.get('/', (req, res) => res.send('wabotlocal OK'));

app.post('/webhook', async (req, res) => {
  const mensaje = req.body.Body || '';
  const de = req.body.From || '';
  console.log(`MSG de ${de}: ${mensaje}`);
  let respuesta = "Dime: mañana a las 10am";

  try {
    if (!auth) throw new Error('Credenciales no cargadas');

    if (mensaje.toLowerCase().includes('mañana')) {
      let hora = 10;
      const match = mensaje.match(/(\d{1,2})/);
      if (match) hora = parseInt(match[1]);

      const fecha = new Date();
      fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(hora, 0, 0, 0);
      const fin = new Date(fecha);
      fin.setHours(hora + 1);

      await calendar.events.insert({
        calendarId: calendarId,
        requestBody: {
          summary: `Cita WhatsApp - ${de}`,
          description: mensaje,
          start: { dateTime: fecha.toISOString(), timeZone: 'Europe/Madrid' },
          end: { dateTime: fin.toISOString(), timeZone: 'Europe/Madrid' },
        },
      });
      respuesta = `¡Perfecto! Cita mañana a las ${hora}:00 creada ✅`;
    }
  } catch (error) {
    console.error('ERROR REAL:', error.message);
    respuesta = `Tuve un problema: ${error.message}`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server ${PORT}`));
