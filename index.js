const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

const CALENDAR_ID = 'd4e0154eadbb84f04f3a38d2cb52859e0496706c42b1eee72f06d6cd1eec524a@group.calendar.google.com';

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
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki de Peluquería Carmen 💈 Dime día y hora: "Lunes 17:00"</Message></Response>`);
    }
    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    const h = fechaInicio.getHours();
    const d = fechaInicio.getDay();
    if(d===0 || h<10 || h>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Cerramos Domingos. L-S 10-20h. ¿Te va 11:00 o 17:00?</Message></Response>`);
    }

    const auth = await getAuth();
    const calendar = google.calendar({version:'v3', auth});

    // TRUCO: Forzar que el bot vea el calendario
    try {
      await calendar.calendarList.insert({ requestBody: { id: CALENDAR_ID } });
    } catch(e){} // si ya está, ignora

    console.log('Usando calendarId:', CALENDAR_ID);

    const check = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: fechaInicio.toISOString(),
      timeMax: fechaFin.toISOString(),
      singleEvents: true
    });

    if(check.data.items && check.data.items.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Esa hora ocupada 🥲 ¿A las ${h+1}:00?</Message></Response>`);
    }

    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody:{
        summary: `Cita - ${req.body.From}`,
        description: msg,
        start:{dateTime: fechaInicio.toISOString(), timeZone:'Europe/Madrid'},
        end:{dateTime: fechaFin.toISOString(), timeZone:'Europe/Madrid'}
      }
    });

    const bonito = fechaInicio.toLocaleString('es-ES',{weekday:'long', day:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Reserva confirmada ✅💈 ${bonito} en Peluquería Carmen! Te esperamos ✨</Message></Response>`);

  } catch(e){
    console.error('ERROR:', e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error: ${e.message}</Message></Response>`);
  }
});

app.get('/', (req,res)=>res.send('Maki Bot Live'));
app.listen(process.env.PORT||10000, ()=>console.log('Live'));
