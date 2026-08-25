const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- 1. CREDENCIALES B64 (forma más segura para Render) ---
let auth;
try {
  const credsJson = Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8');
  const creds = JSON.parse(credsJson);
  auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  console.log('✅ Credenciales B64 cargadas');
} catch (e) {
  console.error('❌ Falta GOOGLE_CREDS_B64', e.message);
}

const calendar = google.calendar({ version: 'v3', auth });
const calendarId = process.env.GOOGLE_CALENDAR_ID || '581c8e504173a3db26b6047b27ac8324a7d3de7cc13e1f54878a6d473b73822a@group.calendar.google.com';
console.log('📅 Calendar:', calendarId);

// --- 2. CANDADO DE PAGO ---
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  if (cfg.activo === false) { console.log('🚫 NO PAGÓ - BOT OFF'); process.exit(0); }
} catch {}

app.get('/', (req,res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get('/ping', (req,res) => res.send('Maki Bot Black & Gold 24/7 OK'));

app.post('/webhook', async (req,res) => {
  const body = req.body.Body || '';
  const mensaje = body.toLowerCase();
  const from = req.body.From || '';
  console.log(`📩 ${from}: ${body}`);

  let respuesta = `Hola! Soy Maki de tu peluquería 👋\n\nEscribe:\n1️⃣ Precios\n2️⃣ Reservar ej: "mañana 17h"`;

  try {
    if (mensaje.includes('mañana') || mensaje.includes('hoy') || /\d{1,2}h/.test(mensaje)) {
      let hora = 10;
      const m = mensaje.match(/(\d{1,2})/);
      if (m) hora = parseInt(m[1]);

      // Fix inteligente: 5 -> 17h, no 5am
      if (hora <= 7) hora += 12;
      if (hora < 9) hora = 10;
      if (hora > 20) hora = 18;

      const fecha = new Date();
      if (mensaje.includes('mañana')) fecha.setDate(fecha.getDate() + 1);
      fecha.setHours(hora, 0, 0, 0);
      const fin = new Date(fecha); fin.setHours(hora + 1);

      // Ver si está libre
      const free = await calendar.freebusy.query({
        requestBody: { timeMin: fecha.toISOString(), timeMax: fin.toISOString(), items: [{ id: calendarId }] }
      });

      if (free.data.calendars[calendarId].busy.length > 0) {
        respuesta = `Las ${hora}:00 está ocupada 😕 ¿Te va bien a las ${hora+1}:00?`;
      } else {
        await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: `💇‍♀️ Cita Maki Bot - ${from.replace('whatsapp:','')}`,
            description: `Original: ${body}`,
            start: { dateTime: fecha.toISOString(), timeZone: 'Europe/Madrid' },
            end: { dateTime: fin.toISOString(), timeZone: 'Europe/Madrid' },
          },
        });
        respuesta = `¡Hecho! ✅ Mañana a las ${hora}:00 reservado. Te esperamos!`;
      }
    } else if (mensaje.includes('precio') || mensaje === '1') {
      respuesta = "💇‍♀️ Corte 15€ | Color 35€ | Mechas 50€\n\nReserva escribiendo: mañana 17h";
    }
  } catch (e) {
    console.error('ERROR:', e);
    respuesta = `Error temporal, dime la hora y lo guardo manual.`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

app.listen(process.env.PORT || 10000, () => console.log('🤖 Maki Bot listo'));
