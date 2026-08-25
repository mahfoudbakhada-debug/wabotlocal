const fs = require('fs');
const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- CREDENCIALES GOOGLE ---
if (process.env.GOOGLE_CREDENTIALS) {
  fs.writeFileSync('./credentials.json', process.env.GOOGLE_CREDENTIALS);
  console.log('✅ Credenciales Google cargadas');
} else {
  console.warn('⚠️ No hay GOOGLE_CREDENTIALS en .env');
}

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });
const calendarId = process.env.GOOGLE_CALENDAR_ID || "581c8e504173a3db26b6047b27ac8324a7d3de7cc13e1f54878a6d473b73822a@group.calendar.google.com";
console.log('📅 CalendarID:', calendarId);

// --- CANDADO DE PAGO ---
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  if (cfg.activo === false) {
    console.log("🚫 CLIENTA NO PAGÓ - MAKI BOT APAGADO");
    process.exit(0);
  }
} catch(e) {}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get('/ping', (req, res) => res.send('Maki Bot Black & Gold activo 24/7'));

app.post('/webhook', async (req, res) => {
  const mensaje = (req.body.Body || '').toLowerCase().trim();
  const de = req.body.From || 'WhatsApp';
  console.log(`📩 ${de}: ${mensaje}`);

  let respuesta = `Hola! Soy Maki de ${process.env.NOMBRE_NEGOCIO || 'tu peluquería'} 👋\n\n1️⃣ Ver precios\n2️⃣ Reservar (ej: mañana 17h)\n3️⃣ Ubicación`;

  try {
    // Detecta reserva: "mañana 17", "mañana a las 10am", "hoy 16h"
    const esReserva = mensaje.includes('mañana') || mensaje.includes('hoy') || mensaje.match(/\d{1,2}\s*h/);
    
    if (esReserva) {
      let hora = 10;
      const matchHora = mensaje.match(/(\d{1,2})(?::\d{2})?\s*(?:h|am|pm)?/);
      if (matchHora) {
        hora = parseInt(matchHora[1]);
        // Convierte 5 de la tarde -> 17h si dice "tarde" o es menor a 8
        if ((mensaje.includes('tarde') || mensaje.includes('pm')) && hora < 12) hora += 12;
        if (hora >= 0 && hora <= 7) hora += 12; // nadie reserva a las 5am, es 17h
      }
      if (hora > 20 || hora < 9) hora = 17; // Horario comercial por defecto

      const fecha = new Date();
      if (mensaje.includes('mañana')) fecha.setDate(fecha.getDate() + 1);
      if (mensaje.includes('pasado mañana')) fecha.setDate(fecha.getDate() + 1);
      
      fecha.setHours(hora, 0, 0, 0);
      const fin = new Date(fecha);
      fin.setHours(hora + 1);

      // Comprobar si está libre
      const busy = await calendar.freebusy.query({
        requestBody: { timeMin: fecha.toISOString(), timeMax: fin.toISOString(), items: [{ id: calendarId }] }
      });
      
      if (busy.data.calendars[calendarId].busy.length > 0) {
        respuesta = `Esa hora (${hora}:00) está ocupada 😕 ¿Te va bien a las ${hora+1}:00 o a las ${hora-1}:00?`;
      } else {
        await calendar.events.insert({
          calendarId,
          requestBody: {
            summary: `💇‍♀️ ${de.replace('whatsapp:','')} - Reserva Maki Bot`,
            description: `Mensaje original: ${req.body.Body}\nTelefono: ${de}`,
            start: { dateTime: fecha.toISOString(), timeZone: 'Europe/Madrid' },
            end: { dateTime: fin.toISOString(), timeZone: 'Europe/Madrid' },
          },
        });
        respuesta = `¡Hecho! ✅\n\nReserva confirmada mañana a las ${hora}:00 en ${process.env.NOMBRE_NEGOCIO || 'Peluquería'}.\nTe esperamos!`;
      }
    }

    if (mensaje.includes('precio') || mensaje === '1') {
      respuesta = "💇‍♀️ Precios:\n• Corte 15€\n• Color 35€\n• Mechas 50€\n\nEscribe: mañana 17h para reservar";
    }

  } catch (error) {
    console.error('❌ ERROR REAL:', error);
    respuesta = `Tuve un problema creando la cita. Pero dime la hora y lo apunto manual: ${error.message}`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🤖 Maki Bot Black & Gold en puerto ${PORT}`));
