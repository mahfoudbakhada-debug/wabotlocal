const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

// ============ CONFIGURACION DE TU AGENCIA ============
// Aqui añades clientes. 1 linea por cliente y listo.
const CLIENTES = {
  carmen: {
    calendarId: 'd4e0154eadbb84f04f3a38d2cb52859e0496706c42b1eee72f06d6cd1eec524a@group.calendar.google.com',
    nombre: 'Peluquería Carmen',
    direccion: 'Calle Mayor, 12'
  },
  lola: {
    calendarId: 'ID_CALENDARIO_DE_LOLA_AQUI',
    nombre: 'Uñas Lola',
    direccion: 'Calle Sol, 5'
  }
};
// ======================================================

const memoria = new Map();
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:00`;
const bonitoHora = (d) => {
  const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  return `${dias[d.getDay()]} a las ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};
const bonitoLargo = (d) => {
  const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} a las ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

function getAuth() {
  const b64 = (process.env.GOOGLE_CREDS_B64 || '').trim();
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
}

function parseFecha(texto, keyMem) {
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
  if(!tieneDia && memoria.has(keyMem)){
    let mem = memoria.get(keyMem);
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
    const prev = memoria.get(keyMem) || {};
    memoria.set(keyMem, {...prev, fecha: new Date(fecha), ts: Date.now() });
  }
  return fecha;
}

app.post('/whatsapp/:cliente', async (req,res)=>{
  try {
    const clienteId = (req.params.cliente || 'carmen').toLowerCase();
    const config = CLIENTES[clienteId];
    if(!config) return res.set('Content-Type','text/xml').send(`<Response><Message>Cliente no configurado</Message></Response>`);

    const from = req.body.From || 'test';
    const keyMem = `${clienteId}_${from}`; // memoria separada por peluqueria
    const body = (req.body.Body || '').trim();

    if(memoria.has(keyMem) && memoria.get(keyMem).estado === 'esperando_nombre'){
      const nombreCompleto = body.trim().replace(/\b\w/g, l => l.toUpperCase());
      if(nombreCompleto.length < 3 || !nombreCompleto.includes(' ')){
        return res.set('Content-Type','text/xml').send(`<Response><Message>Ponme nombre y apellido porfa 😊 Ej: Maria Garcia</Message></Response>`);
      }
      const mem = memoria.get(keyMem);
      const fechaInicio = mem.fecha;
      const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
      const auth = await getAuth();
      const calendar = google.calendar({version:'v3', auth});
      await calendar.events.insert({
        calendarId: config.calendarId,
        requestBody:{
          summary: `💈 ${nombreCompleto} - Cita`,
          description: `Cliente: ${nombreCompleto} (${from})`,
          start:{dateTime: fmt(fechaInicio), timeZone:'Europe/Madrid'},
          end:{dateTime: fmt(fechaFin), timeZone:'Europe/Madrid'}
        }
      });
      memoria.delete(keyMem);
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Perfecto ${nombreCompleto}! ✅💖

💈 *${config.nombre}*
📅 *${bonitoLargo(fechaInicio)}*
📍 ${config.direccion}

Te esperamos ✨</Message></Response>`);
    }

    const fechaInicio = parseFecha(body, keyMem);
    if(!fechaInicio) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki de ${config.nombre} 💈 Dime día y hora: "Lunes 17:00"</Message></Response>`);
    }
    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    const h = fechaInicio.getHours(); const d = fechaInicio.getDay();
    if(d===0 || h<10 || h>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Cerramos Domingos. L-S 10-20h. ¿Te va 11:00 o 17:00?</Message></Response>`);
    }
    const auth = await getAuth();
    const calendar = google.calendar({version:'v3', auth});
    try { await calendar.calendarList.insert({ requestBody: { id: config.calendarId } }); } catch(e){}
    const check = await calendar.events.list({
      calendarId: config.calendarId,
      timeMin: new Date(fechaInicio.getTime()-2*60*60*1000).toISOString(),
      timeMax: new Date(fechaFin.getTime()-2*60*60*1000).toISOString(),
      singleEvents: true
    });
    if(check.data.items && check.data.items.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Vaya! Esa hora ya está cogida a las ${h}:00 😥

Pero tengo libre a las ${h+1}:00 o a las ${h+2}:00 el mismo día. ¿Te reservo? Solo di "A las ${h+1}:00"</Message></Response>`);
    }
    const prev = memoria.get(keyMem) || {};
    memoria.set(keyMem, {...prev, fecha: fechaInicio, ts: Date.now(), estado: 'esperando_nombre' });
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Genial! Tengo libre el ${bonitoHora(fechaInicio)} ✅

¿Me dices tu nombre y apellido para reservarlo?</Message></Response>`);
  } catch(e){
    console.error(e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error: ${e.message}</Message></Response>`);
  }
});

// Para que siga funcionando tu numero actual de Carmen
app.post('/whatsapp', (req,res)=>{ req.params.cliente='carmen'; return app._router.handle(req,res); });

app.get('/', (req,res)=>res.send('Maki Bot AGENCIA V8 Live'));
app.listen(process.env.PORT||10000, ()=>console.log('V8 Live'));
