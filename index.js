const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

const CALENDAR_ID = 'd4e0154eadbb84f04f3a38d2cb52859e0496706c42b1eee72f06d6cd1eec524a@group.calendar.google.com';

// MEMORIA para no olvidar el día
const memoria = new Map(); // telefono -> { dia: Date }

function getAuth() {
  const b64 = (process.env.GOOGLE_CREDS_B64 || '').trim();
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
}

function crearFechaMadrid(baseDate, hora, minuto) {
  // Crea un string YYYY-MM-DDTHH:MM:SS sin convertir a UTC
  const yyyy = baseDate.getFullYear();
  const mm = String(baseDate.getMonth()+1).padStart(2,'0');
  const dd = String(baseDate.getDate()).padStart(2,'0');
  const hh = String(hora).padStart(2,'0');
  const min = String(minuto).padStart(2,'0');
  const dateTimeStr = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
  // Para chequear disponibilidad, necesitamos un Date real en UTC
  const fechaParaChequeo = new Date(`${dateTimeStr}.000+02:00`); // Madrid es +02:00 en verano
  return { dateTimeStr, fechaParaChequeo, baseDate };
}

function parseFecha(texto, from) {
  texto = texto.toLowerCase();
  const ahora = new Date();

  let baseDate = new Date();
  baseDate.setSeconds(0,0);
  let tieneDia = false;

  if (texto.includes('pasado mañana')) { baseDate.setDate(ahora.getDate()+2); tieneDia=true; }
  else if (texto.includes('mañana')) { baseDate.setDate(ahora.getDate()+1); tieneDia=true; }
  else {
    const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    for(let i=0;i<dias.length;i++){
      if(texto.includes(dias[i])){
        let diff = i - ahora.getDay(); if(diff <= 0) diff += 7;
        baseDate.setDate(ahora.getDate()+diff); tieneDia=true; break;
      }
    }
  }

  // Si NO dice día, usa la memoria (el lunes del que hablabais)
  if(!tieneDia && memoria.has(from)){
    const recordado = memoria.get(from);
    const diffMs = Date.now() - recordado.timestamp;
    if(diffMs < 5*60*1000){ // recuerda 5 minutos
      baseDate = new Date(recordado.baseDate);
      tieneDia = true;
      console.log('Usando memoria del día:', baseDate);
    }
  }

  const m = texto.match(/(\d{1,2})[:h](\d{2})?/);
  if(!m) return null;
  const hora = parseInt(m[1]); const minuto = m[2]?parseInt(m[2]):0;

  // Guarda en memoria si ha dicho día
  if(tieneDia){
    memoria.set(from, { baseDate: new Date(baseDate), timestamp: Date.now() });
  }

  return crearFechaMadrid(baseDate, hora, minuto);
}

app.post('/whatsapp', async (req,res)=>{
  try {
    const from = req.body.From || 'anonimo';
    const msg = (req.body.Body || '').trim();
    const parsed = parseFecha(msg, from);

    if(!parsed){
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki de Peluquería Carmen 💈 Dime día y hora: "Lunes 17:00"</Message></Response>`);
    }

    const { dateTimeStr, fechaParaChequeo, baseDate } = parsed;
    const fechaFinCheck = new Date(fechaParaChequeo.getTime()+60*60*1000);
    const dateTimeStrFin = (()=>{ const d=new Date(baseDate); d.setHours(parsed.fechaParaChequeo.getHours()+1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(parsed.fechaParaChequeo.getHours()+1).padStart(2,'0')}:${String(parsed.fechaParaChequeo.getMinutes()).padStart(2,'0')}:00`; })();

    // Validación horario - usa hora de Madrid
    const h = parseInt(dateTimeStr.split('T')[1].split(':')[0]);
    const d = baseDate.getDay();
    if(d===0 || h<10 || h>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Cerramos Domingos. L-S 10-20h. ¿Te va 11:00 o 17:00?</Message></Response>`);
    }

    const auth = await getAuth(); const calendar = google.calendar({version:'v3', auth});
    try{ await calendar.calendarList.insert({ requestBody: { id: CALENDAR_ID } }); }catch(e){}

    const check = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: fechaParaChequeo.toISOString(),
      timeMax: fechaFinCheck.toISOString(),
      singleEvents: true
    });

    if(check.data.items?.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Vaya! Esa hora ya está cogida a las ${h}:00 😥

Pero tengo libre a las ${h+1}:00 o a las ${h+2}:00 el *mismo día*. ¿Te reservo?

Solo di "A las ${h+1}:00" y te lo guardo para ese mismo día.</Message></Response>`);
    }

    // Crear evento usando la hora de Madrid exacta
    const finHour = h+1;
    const finStr = `${dateTimeStr.split('T')[0]}T${String(finHour).padStart(2,'0')}:${String(dateTimeStr.split('T')[1].split(':')[1])}`;

    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody:{
        summary: `💈 Cita - ${from}`,
        description: msg,
        start:{dateTime: dateTimeStr, timeZone:'Europe/Madrid'},
        end:{dateTime: finStr, timeZone:'Europe/Madrid'}
      }
    });

    memoria.delete(from); // limpia memoria tras reservar
    const bonito = fechaParaChequeo.toLocaleString('es-ES',{weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Perfecto, reservado! ✅💖

💈 *Peluquería Carmen*
📅 *${bonito}*
📍 Calle Mayor, 12

Te esperamos ✨</Message></Response>`);

  } catch(e){
    console.error('ERROR:', e);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error: ${e.message}</Message></Response>`);
  }
});
app.get('/', (req,res)=>res.send('Maki Bot Live V3 Fix'));
app.listen(process.env.PORT||10000, ()=>console.log('Live'));
