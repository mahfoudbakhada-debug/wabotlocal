const express = require('express');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function getGoogleAuth() {
  const b64 = process.env.GOOGLE_CREDS_B64;
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials: json,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
}
const calendarId = process.env.GOOGLE_CALENDAR_ID;

function parseFecha(texto) {
  const ahora = new Date();
  texto = texto.toLowerCase();
  let fecha = new Date();
  if (texto.includes('mañana')) fecha.setDate(ahora.getDate() + 1);
  if (texto.includes('pasado mañana')) fecha.setDate(ahora.getDate() + 2);

  const match = texto.match(/(\d{1,2})(?::(\d{2}))?\s*h/);
  if (match) {
    fecha.setHours(parseInt(match[1]), match[2]? parseInt(match[2]) : 0, 0, 0);
    return fecha;
  }
  const match2 = texto.match(/a las (\d{1,2})/);
  if (match2) {
    fecha.setHours(parseInt(match2[1]), 0, 0, 0);
    return fecha;
  }
  return null;
}

app.post('/whatsapp', async (req, res) => {
  try {
    const mensajeCliente = req.body.Body || '';
    const telefono = req.body.From || '';
    const fechaInicio = parseFecha(mensajeCliente);

    if (!fechaInicio) {
      return res.set('Content-Type','text/xml').send(
        `<Response><Message>¡Hola! Soy Maki Bot de tu peluquería 👋

Para reservar dime día y hora, por ejemplo:
"mañana a las 17:00" o "viernes 11h"

Horario: Lunes a Sábado de 10:00 a 20:00</Message></Response>`
      );
    }

    const fechaFin = new Date(fechaInicio.getTime() + 60 * 60 * 1000);
    const hora = fechaInicio.getHours();
    const dia = fechaInicio.getDay();

    if (dia === 0 || hora < 10 || hora >= 20) {
      return res.set('Content-Type','text/xml').send(
        `<Response><Message>En ese horario estamos cerrados 😕

Nuestro horario es de Lunes a Sábado de 10:00 a 20:00.
¿Te viene bien otro día a esa misma hora?</Message></Response>`
      );
    }

    const auth = await getGoogleAuth();
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
        `<Response><Message>Esa hora ya está reservada 😕

¿Te va bien a las ${hora + 1}:00 del mismo día?
Si no, dime otra hora y te lo miro al momento.</Message></Response>`
      );
    }

    await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: `Cita - Cliente ${telefono}`,
        description: `Reserva vía Maki Bot - Cliente: ${telefono}`,
        start: { dateTime: fechaInicio.toISOString(), timeZone: 'Europe/Madrid' },
        end: { dateTime: fechaFin.toISOString(), timeZone: 'Europe/Madrid' }
      }
    });

    const bonito = fechaInicio.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'
    });

    return res.set('Content-Type','text/xml').send(
      `<Response><Message>¡Perfecto! ✅ Reserva confirmada.

Te espero el ${bonito}.
Soy Maki Bot de tu peluquería 💈 ¡Gracias por reservar!</Message></Response>`
    );
  } catch (e) {
    console.error(e);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error técnico, ¿me repites día y hora? 🙏</Message></Response>`);
  }
});

app.listen(process.env.PORT || 10000, () => console.log('Maki Bot Live'));
