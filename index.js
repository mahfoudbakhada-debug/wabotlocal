const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

function getAuth() {
  const b64 = (process.env.GOOGLE_CREDS_B64 || '').trim();
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
}

function parseFecha(texto) {
  texto = texto.toLowerCase();
  const ahora = new Date();
  let fecha = new Date(); fecha.setSeconds(0,0);
  if (texto.includes('pasado mañana')) fecha.setDate(ahora.getDate()+2);
  else if (texto.includes('mañana')) fecha.setDate(ahora.getDate()+1);
  else {
    const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    for(let i=0;i<dias.length;i++){
      if(texto.includes(dias[i])){
        let diff = i - ahora.getDay();
        if(diff <= 0) diff += 7;
        fecha.setDate(ahora.getDate()+diff);
        break;
      }
    }
  }
  const m = texto.match(/(\d{1,2})[:h](\d{2})?/);
  if(!m) return null;
  fecha.setHours(parseInt(m[1]), m[2]?parseInt(m[2]):0, 0, 0);
  return fecha;
}

app.post('/whatsapp', async (req,res)=>{
  try {
    const msg = req.body.Body || '';
    const fechaInicio = parseFecha(msg);
    if(!fechaInicio) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki, asistente de Peluquería Carmen 💈✨ Dime día y hora: Ej "Lunes a las 17:00" o "Mañana a las 11h".</Message></Response>`);
    }
    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    const hora = fechaInicio.getHours();
    const dia = fechaInicio.getDay();
    if(dia===0 || hora<10 || hora>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Estamos cerrados 😊 L-S 10:00-20:00. ¿Te va bien 11:00 o 17:00?</Message></Response>`);
    }

    const auth = await getAuth();
    const calendar = google.calendar({version:'v3', auth});

    // ID YA PUESTO A MANO, NO FALLA
    const calendarId = 'mahfoudbakhada@gmail.com';
    console.log('Usando calendarId:', calendarId);

    const check = await calendar.events.list({
      calendarId,
      timeMin: fechaInicio.toISOString(),
      timeMax: fechaFin.toISOString(),
      singleEvents: true
    });

    if(check.data.items && check.data.items.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Esa hora está ocupada 🥲 ¿Te va bien a las ${hora+1}:00?</Message></Response>`);
    }

    await calendar.events.insert({
      calendarId,
      requestBody:{
        summary: `Cita - ${req.body.From}`,
        description: msg,
        start:{dateTime: fechaInicio.toISOString(), timeZone:'Europe/Madrid'},
        end:{dateTime: fechaFin.toISOString(), timeZone:'Europe/Madrid'}
      }
    });

    const bonito = fechaInicio.toLocaleString('es-ES',{weekday:'long', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Perfecto! Reserva confirmada ✅💈 Te esperamos el ${bonito} en Peluquería Carmen. ✨</Message></Response>`);

  } catch(e){
    console.error('ERROR:', e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error: ${e.message}</Message></Response>`);
  }
});

app.get('/', (req,res)=>res.send('Maki Bot Live'));
app.listen(process.env.PORT||10000, ()=>console.log('Maki Bot Live'));
