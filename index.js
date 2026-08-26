const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

const CALENDAR_ID = 'd4e0154eadbb84f04f3a38d2cb52859e0496706c42b1eee72f06d6cd1eec524a@group.calendar.google.com';
const memoria = new Map(); // From -> { fecha, ts, estado, nombre? }

function getAuth() {
  const b64 = (process.env.GOOGLE_CREDS_B64 || '').trim();
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
}

function parseFecha(texto, from) {
  texto = texto.toLowerCase();
  const ahora = new Date();
  let fecha = new Date(); fecha.setSeconds(0,0);
  let tieneDia = false;

  if (texto.includes('pasado mañana')) { fecha.setDate(ahora.getDate()+2); tieneDia=true; }
  else if (texto.includes('mañana')) { fecha.setDate(ahora.getDate()+1); tieneDia=true; }
  else {
    const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    for(let i=0;i<dias.length;i++){
      if(texto.includes(dias[i])){
        let diff = i - ahora.getDay(); if(diff <= 0) diff += 7;
        fecha.setDate(ahora.getDate()+diff); tieneDia=true; break;
      }
    }
  }
  if(!tieneDia && memoria.has(from)){
    let mem = memoria.get(from);
    if(mem.fecha && Date.now() - mem.ts < 300000){
      fecha.setDate(mem.fecha.getDate());
      fecha.setMonth(mem.fecha.getMonth());
      fecha.setFullYear(mem.fecha.getFullYear());
    }
  }
  const m = texto.match(/(\d{1,2})[:h](\d{2})?/);
  if(!m) return null;
  fecha.setHours(parseInt(m[1]), m[2]?parseInt(m[2]):0, 0, 0);
  if(tieneDia){
    const prev = memoria.get(from) || {};
    memoria.set(from, {...prev, fecha: new Date(fecha), ts: Date.now() });
  }
  return fecha;
}

app.post('/whatsapp', async (req,res)=>{
  try {
    const from = req.body.From || 'test';
    const body = (req.body.Body || '').trim();

    // 1. SI ESTAMOS ESPERANDO NOMBRE
    if(memoria.has(from) && memoria.get(from).estado === 'esperando_nombre'){
      const nombre = body.split(' ')[0]; // Solo primer nombre
      if(nombre.length < 2){
        return res.set('Content-Type','text/xml').send(`<Response><Message>Dime tu nombre porfa 😊 Ej: María</Message></Response>`);
      }
      const mem = memoria.get(from);
      const fechaInicio = mem.fecha;
      const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);

      const auth = await getAuth();
      const calendar = google.calendar({version:'v3', auth});

      await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody:{
          summary: `💈 ${nombre} - Cita`,
          description: `Cliente: ${nombre} (${from}) - Mensaje original: ${mem.msgOriginal}`,
          start:{dateTime: fechaInicio.toISOString(), timeZone:'Europe/Madrid'},
          end:{dateTime: fechaFin.toISOString(), timeZone:'Europe/Madrid'}
        }
      });

      memoria.delete(from);
      const bonito = fechaInicio.toLocaleString('es-ES',{weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Perfecto ${nombre}! ✅💖

💈 *Peluquería Carmen*
📅 *${bonito}*
📍 Calle Mayor, 12

Te esperamos ✨</Message></Response>`);
    }

    // 2. SI ES FECHA
    const fechaInicio = parseFecha(body, from);
    if(!fechaInicio) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki de Peluquería Carmen 💈 Dime día y hora: "Lunes 17:00"</Message></Response>`);
    }

    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    const h = fechaInicio.getHours(); const d = fechaInicio.getDay();
    if(d===0 || h<10 || h>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Cerramos Domingos. L-S 10-20h. ¿Te va 11:00 o 17:00?</Message></Response>`);
    }

    const auth = await getAuth();
    const calendar = google.calendar({version:'v3', auth});
    try { await calendar.calendarList.insert({ requestBody: { id: CALENDAR_ID } }); } catch(e){}

    const check = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: fechaInicio.toISOString(),
      timeMax: fechaFin.toISOString(),
      singleEvents: true
    });

    if(check.data.items && check.data.items.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Vaya! Esa hora ya está cogida a las ${h}:00 😥

Pero tengo libre a las ${h+1}:00 o a las ${h+2}:00 el mismo día. ¿Te reservo? Solo di "A las ${h+1}:00"</Message></Response>`);
    }

    // 3. ESTA LIBRE -> PIDE NOMBRE, NO RESERVES AUN
    const prev = memoria.get(from) || {};
    memoria.set(from, {...prev, fecha: fechaInicio, ts: Date.now(), estado: 'esperando_nombre', msgOriginal: body });

    const bonito = fechaInicio.toLocaleString('es-ES',{weekday:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Genial! Tengo libre el ${bonito} ✅

¿A nombre de quién lo reservo?</Message></Response>`);

  } catch(e){
    console.error(e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error: ${e.message}</Message></Response>`);
  }
});
app.get('/', (req,res)=>res.send('Maki Bot Live V4 Profesional'));
app.listen(process.env.PORT||10000, ()=>console.log('Live'));
