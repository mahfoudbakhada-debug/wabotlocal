const express = require('express');
const { google } = require('googleapis');
const OpenAI = require('openai');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- CONFIG GOOGLE ---
function getGoogleAuth() {
  const b64 = process.env.GOOGLE_CREDS_B64;
  if (!b64) throw new Error('Falta GOOGLE_CREDS_B64');
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  console.log('Credenciales B64 cargadas:', json.client_email);
  const auth = new google.auth.GoogleAuth({
    credentials: json,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  return auth;
}
const calendarId = process.env.GOOGLE_CALENDAR_ID;
console.log('Calendar:', calendarId);

app.get('/', (req, res) => res.send('Maki Bot listo ✅'));

// --- WEBHOOK WHATSAPP (Twilio) ---
app.post('/whatsapp', async (req, res) => {
  try {
    const mensajeCliente = req.body.Body || '';
    const telefono = req.body.From || '';
    console.log(`Mensaje de ${telefono}: ${mensajeCliente}`);

    // 1. Entender fecha con OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Eres asistente de Peluquería Carmen en Barcelona. Hoy es ${new Date().toISOString()}. Devuelve SOLO un JSON con {"fecha": "ISO", "nombre": "nombre si lo dice"}. Si pide mañana a las 11, pon fecha mañana 11:00 Europe/Madrid. Si no hay fecha, pon null.` },
        { role: 'user', content: mensajeCliente }
      ]
    });
    
    let datos = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim());
    if (!datos.fecha) {
      const respuesta = '¡Hola! Soy Carmen de Peluquería Carmen 💇‍♀️ ¿Qué día y hora te va bien? Estamos de Lunes a Sábado de 10:00 a 20:00.';
      res.set('Content-Type', 'text/xml');
      return res.send(`<Response><Message>${respuesta}</Message></Response>`);
    }

    const fechaInicio = new Date(datos.fecha);
    const fechaFin = new Date(fechaInicio.getTime() + 60 * 60 * 1000); // 1 hora

    // 2. CONTROL HORARIO REAL (1)
    const hora = fechaInicio.getHours();
    const dia = fechaInicio.getDay();
    if (dia === 0 || hora < 10 || hora >= 20) {
      const respuesta = 'Lo siento, estamos cerrados 😕 Nuestro horario es de Lunes a Sábado de 10:00 a 20:00. ¿Te va bien otro día y hora?';
      res.set('Content-Type', 'text/xml');
      return res.send(`<Response><Message>${respuesta}</Message></Response>`);
    }

    const auth = await getGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    // 3. CONTROL NO PISAR CITAS (2)
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: fechaInicio.toISOString(),
        timeMax: fechaFin.toISOString(),
        items: [{ id: calendarId }]
      }
    });
    const ocupado = freeBusy.data.calendars[calendarId].busy.length > 0;
    if (ocupado) {
      const respuesta = `Esa hora ya está reservada 😕 ¿Te viene bien a las ${hora + 1}:00 o a las ${hora + 2}:00 del mismo día?`;
      res.set('Content-Type', 'text/xml');
      return res.send(`<Response><Message>${respuesta}</Message></Response>`);
    }

    // 4. CREAR CITA (3) Mensaje Pro + Nombre
    await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        summary: `Corte - ${datos.nombre || 'Cliente'} ${telefono}`,
        description: `Cliente: ${datos.nombre || ''}\nTel: ${telefono}\nMensaje original: ${mensajeCliente}`,
        start: { dateTime: fechaInicio.toISOString(), timeZone: 'Europe/Madrid' },
        end: { dateTime: fechaFin.toISOString(), timeZone: 'Europe/Madrid' },
        attendees: [{ email: 'mahfoudbakhada@gmail.com' }]
      }
    });

    console.log('¡Cita creada!');
    const diaBonito = fechaInicio.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    const respuestaFinal = `¡Perfecto! ✅ Soy Carmen de Peluquería Carmen 💇‍♀️ Te espero el ${diaBonito}. Si no puedes venir avísame por aquí. ¡Gracias!`;

    res.set('Content-Type', 'text/xml');
    return res.send(`<Response><Message>${respuestaFinal}</Message></Response>`);

  } catch (e) {
    console.error('Error:', e.message);
    res.set('Content-Type', 'text/xml');
    return res.send(`<Response><Message>Uy, ha habido un error al crear la cita, ¿me repites el día y hora por favor?</Message></Response>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot en puerto ${PORT}`));
