const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const OpenAI = require('openai');
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Esto enseña tu agencia
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
function getGoogleAuth() {
  const b64 = process.env.GOOGLE_CREDS_B64;
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({ credentials: json, scopes: ['https://www.googleapis.com/auth/calendar'] });
}
const calendarId = process.env.GOOGLE_CALENDAR_ID;

app.post('/whatsapp', async (req, res) => {
  try {
    const mensajeCliente = req.body.Body || '';
    const telefono = req.body.From || '';
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `Hoy es ${new Date().toISOString()}. Devuelve SOLO JSON {"fecha":"ISO", "nombre":"..."}. Europe/Madrid.` },
        { role: 'user', content: mensajeCliente }
      ]
    });
    let datos = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim());
    if (!datos.fecha) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Carmen de Peluquería Carmen 💇‍♀️ ¿Qué día y hora te va bien? Estamos de Lunes a Sábado de 10:00 a 20:00.</Message></Response>`);
    }
    const fechaInicio = new Date(datos.fecha);
    const fechaFin = new Date(fechaInicio.getTime() + 60*60*1000);
    const hora = fechaInicio.getHours(); const dia = fechaInicio.getDay();
    if (dia === 0 || hora < 10 || hora >= 20) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>Estamos cerrados 😕 Horario Lunes a Sábado 10:00 a 20:00. ¿Otro día?</Message></Response>`);
    }
    const auth = await getGoogleAuth(); const calendar = google.calendar({ version: 'v3', auth });
    const freeBusy = await calendar.freebusy.query({ requestBody: { timeMin: fechaInicio.toISOString(), timeMax: fechaFin.toISOString(), items: [{id: calendarId}] } });
    if (freeBusy.data.calendars[calendarId].busy.length > 0) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>Esa hora está ocupada 😕 ¿Te va bien a las ${hora+1}:00?</Message></Response>`);
    }
    await calendar.events.insert({ calendarId, requestBody: { summary: `Corte - ${datos.nombre||'Cliente'} ${telefono}`, start: {dateTime: fechaInicio.toISOString(), timeZone: 'Europe/Madrid'}, end: {dateTime: fechaFin.toISOString(), timeZone: 'Europe/Madrid'}, attendees: [{email: 'mahfoudbakhada@gmail.com'}] } });
    const bonito = fechaInicio.toLocaleDateString('es-ES',{weekday:'long', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Perfecto! ✅ Soy Carmen 💇‍♀️ Te espero el ${bonito}. ¡Gracias!</Message></Response>`);
  } catch(e){ console.error(e); return res.set('Content-Type','text/xml').send(`<Response><Message>Error, repite día y hora porfa</Message></Response>`); }
});
app.listen(process.env.PORT||3000, ()=>console.log('Live'));
