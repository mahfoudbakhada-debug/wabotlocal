const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const OpenAI = require('openai');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 1. TU AGENCIA MAKI BOT - Se ve profesional
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getGoogleAuth() {
  const b64 = process.env.GOOGLE_CREDS_B64;
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({ 
    credentials: json, 
    scopes: ['https://www.googleapis.com/auth/calendar'] 
  });
}
const calendarId = process.env.GOOGLE_CALENDAR_ID;

// 2. BOT DE WHATSAPP PROFESIONAL
app.post('/whatsapp', async (req, res) => {
  try {
    const mensajeCliente = req.body.Body || '';
    const telefono = req.body.From || '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `Eres Maki Bot, asistente profesional de reservas. Hoy es ${new Date().toISOString()}. 
          Tu trabajo: extraer fecha y nombre del cliente del mensaje.
          Devuelve SOLO JSON válido: {"fecha":"2026-08-26T11:00:00", "nombre":"Nombre"} en formato ISO Europe/Madrid.
          Si no hay fecha, devuelve {"fecha": null}.
          Si no hay nombre, pon "Cliente".
          No inventes horas.` 
        },
        { role: 'user', content: mensajeCliente }
      ]
    });

    let datos;
    try {
      datos = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim());
    } catch { datos = { fecha: null }; }

    if (!datos.fecha) {
      return res.set('Content-Type','text/xml').send(
        `<Response><Message>¡Hola! Soy Maki Bot de tu peluquería 👋

Para reservar dime día y hora, por ejemplo:
"mañana a las 17:00" o "viernes 11h"

Horario: Lunes a Sábado de 10:00 a 20:00</Message></Response>`
      );
    }

    const fechaInicio = new Date(datos.fecha);
    const fechaFin = new Date(fechaInicio.getTime() + 60 * 60 * 1000);
    const hora = fechaInicio.getHours();
    const dia = fechaInicio.getDay();

    // Validación de horario - Punto 1
    if (dia === 0 || hora < 10 || hora >= 20) {
      return res.set('Content-Type','text/xml').send(
        `<Response><Message>En ese horario estamos cerrados 😕

Nuestro horario es de Lunes a Sábado de 10:00 a 20:00.
¿Te viene bien otro día a esa misma hora?</Message></Response>`
      );
    }

    const auth = await getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    // Validación de que no pise citas - Punto 2
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

    // Crear cita - Punto 3
    await calendar.events.insert({ 
      calendarId, 
      requestBody: { 
        summary: `Cita - ${datos.nombre || 'Cliente'} ${telefono}`, 
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
    return res.set('Content-Type','text/xml').send(
      `<Response><Message>Ha habido un pequeño error técnico. ¿Me puedes repetir el día y la hora por favor? 🙏</Message></Response>`
    );
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Maki Bot Live'));
