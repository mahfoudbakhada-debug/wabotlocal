const express = require('express');
const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const OpenAI = require('openai');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- CANDADO DE PAGO ---
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  if (cfg.activo === false) { console.log('🚫 NO PAGÓ - MAKI BOT OFF'); process.exit(0); }
} catch {}

// --- 1. LANDING BLACK & GOLD ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/ping', (req,res) => res.send('Maki Bot Black & Gold 24/7 OK'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getGoogleAuth() {
  if (!process.env.GOOGLE_CREDS_B64) throw new Error("Falta GOOGLE_CREDS_B64");
  const json = JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials: json,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
}
const calendarId = process.env.GOOGLE_CALENDAR_ID || '581c8e504173a3db26b6047b27ac8324a7d3de7cc13e1f54878a6d473b73822a@group.calendar.google.com';

// --- 2. BOT WHATSAPP CON IA REAL ---
app.post('/webhook', async (req, res) => {
  try {
    const mensajeCliente = req.body.Body || '';
    const telefono = req.body.From || '';
    console.log(`📩 ${telefono}: ${mensajeCliente}`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Eres Maki Bot, recepcionista de peluquería premium. Hoy es ${new Date().toLocaleString('es-ES', {timeZone: 'Europe/Madrid'})}.
          Extrae fecha/hora y nombre. Devuelve SOLO JSON: {"fecha":"2026-08-26T17:00:00", "nombre":"Maria"}
          - fecha en ISO Europe/Madrid, si no hay fecha pon null
          - Si dice "mañana 5" es 17:00, no 05:00. Horario laboral 10-20h.
          - No inventes. Solo JSON.`
        },
        { role: 'user', content: mensajeCliente }
      ]
    });

    let datos = { fecha: null, nombre: 'Cliente' };
    try {
      const raw = completion.choices[0].message.content.replace(/```json|```/g, '').trim();
      datos = JSON.parse(raw);
    } catch {}

    if (!datos.fecha) {
      return res.set('Content-Type','text/xml').send(
        `<Response><Message>¡Hola! Soy Maki Bot 👋

Para reservar dime día y hora:
Ej: "mañana a las 17h" o "viernes 11:30"

Horario: Lun-Sab 10:00 a 20:00 💈</Message></Response>`
      );
    }

    const fechaInicio = new Date(datos.fecha);
    const fechaFin = new Date(fechaInicio.getTime() + 60 * 60 * 1000);
    const hora = fechaInicio.getHours();
    const dia = fechaInicio.getDay();

    if (dia === 0 || hora < 10 || hora >= 20) {
      return res.set('Content-Type','text/xml').send(
        `<Response><Message>Estamos cerrados en ese horario 😕

Abrimos de Lunes a Sábado de 10:00 a 20:00.
¿Te va bien otro día a las ${hora}:00?</Message></Response>`
      );
    }

    const auth = getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: fechaInicio.toISOString(),
        timeMax: fechaFin.toISOString(),
        items: [{ id: calendarId }]
      }
    });

    if (freeBusy.data.calendars[calendarId].busy.length > 0) {
      return res.set('Content-Type','text/xml').send(
        `<Response><Message>Esa hora ya está ocupada 😕

¿Te viene bien a las ${hora + 1}:00? Dime y te lo reservo al instante.</Message></Response>`
      );
    }

    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `💇‍♀️ ${datos.nombre} - ${telefono.replace('whatsapp:','')}`,
        description: `Reserva vía Maki Bot\nMsg: ${mensajeCliente}\nTel: ${telefono}`,
        start: { dateTime: fechaInicio.toISOString(), timeZone: 'Europe/Madrid' },
        end: { dateTime: fechaFin.toISOString(), timeZone: 'Europe/Madrid' }
      }
    });

    const bonito = fechaInicio.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'
    });

    return res.set('Content-Type','text/xml').send(
      `<Response><Message>¡Perfecto ${datos.nombre}! ✅

Reserva confirmada el ${bonito}.
Te esperamos 💈</Message></Response>`
    );

  } catch (e) {
    console.error('❌ ERROR:', e);
    return res.set('Content-Type','text/xml').send(
      `<Response><Message>Error técnico momentáneo 🙏 Repíteme día y hora y te lo reservo.</Message></Response>`
    );
  }
});

app.listen(process.env.PORT || 10000, () => console.log('🤖 Maki Bot Black & Gold + GPT Live'));
