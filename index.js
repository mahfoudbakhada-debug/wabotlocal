const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- CANDADO DE PAGO ---
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  if (cfg.activo === false) { console.log('🚫 NO PAGÓ - BOT OFF'); process.exit(0); }
} catch {}

// ============ CONFIGURACION DE TU AGENCIA ============
const CLIENTES = {
  carmen: {
    calendarId: 'ec9d34923d8485b113ae92cef106fe55a7aa7e69cd4225007a907b708ec6252a@group.calendar.google.com',
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
const fmt = (d) => d.toISOString(); // Usamos ISO directo, más fiable con timeZone
const bonitoHora = (d) => d.toLocaleString('es-ES', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
const bonitoLargo = (d) => d.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });

function getAuth() {
  const b64 = (process.env.GOOGLE_CREDS_B64 || '').trim();
  if (!b64) throw new Error('Falta GOOGLE_CREDS_B64');
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
  // Memoria de 5 minutos
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
  let h = parseInt(m[1]);
  if (h <= 7) h += 12; // 5 -> 17h
  fecha.setHours(h, m[2]?parseInt(m[2]):0, 0, 0);

  if(tieneDia){
    const prev = memoria.get(keyMem) || {};
    memoria.set(keyMem, {...prev, fecha: new Date(fecha), ts: Date.now() });
  }
  return fecha;
}

async function handleReserva(req, res) {
  try {
    const clienteId = (req.params.cliente || 'carmen').toLowerCase();
    const config = CLIENTES[clienteId];
    if(!config) return res.set('Content-Type','text/xml').send(`<Response><Message>Cliente no configurado</Message></Response>`);

    const from = req.body.From || 'test';
    const keyMem = `${clienteId}_${from}`;
    const body = (req.body.Body || '').trim();
    console.log(`📩 [${clienteId}] ${from}: ${body}`);

    // 2º PASO: Esperando nombre
    if(memoria.has(keyMem) && memoria.get(keyMem).estado === 'esperando_nombre'){
      const nombreCompleto = body.trim().replace(/\b\w/g, l => l.toUpperCase());
      if(nombreCompleto.length < 3 ||!nombreCompleto.includes(' ')){
        return res.set('Content-Type','text/xml').send(`<Response><Message>Ponme nombre y apellido porfa 😊 Ej: Maria Garcia</Message></Response>`);
      }
      const mem = memoria.get(keyMem);
      const fechaInicio = mem.fecha;
      const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
      const auth = getAuth();
      const calendar = google.calendar({version:'v3', auth});

      await calendar.events.insert({
        calendarId: config.calendarId,
        requestBody:{
          summary: `💈 ${nombreCompleto} - Cita`,
          description: `Cliente: ${nombreCompleto} (${from}) - ${body}`,
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

    // 1er PASO: Parsear fecha
    const fechaInicio = parseFecha(body, keyMem);
    if(!fechaInicio) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki de ${config.nombre} 💈 Dime día y hora: Ej "Lunes 17:00" o "Mañana 11h"</Message></Response>`);
    }
    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    const h = fechaInicio.getHours(); const d = fechaInicio.getDay();

    if(d===0 || h<10 || h>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Cerramos Domingos. Horario L-S 10-20h. ¿Te va bien a las 11:00 o 17:00?</Message></Response>`);
    }

    const auth = getAuth();
    const calendar = google.calendar({version:'v3', auth});

    const check = await calendar.events.list({
      calendarId: config.calendarId,
      timeMin: fechaInicio.toISOString(),
      timeMax: fechaFin.toISOString(),
      singleEvents: true
    });

    if(check.data.items && check.data.items.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Vaya! Esa hora ya está cogida a las ${h}:00 😥

Tengo libre a las ${h+1}:00 o ${h+2}:00 el mismo día. ¿Te reservo? Di "A las ${h+1}:00"</Message></Response>`);
    }

    const prev = memoria.get(keyMem) || {};
    memoria.set(keyMem, {...prev, fecha: fechaInicio, ts: Date.now(), estado: 'esperando_nombre' });
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Genial! Tengo libre el ${bonitoHora(fechaInicio)} ✅

¿Me dices tu nombre y apellido para reservarlo?</Message></Response>`);

  } catch(e){
    console.error('ERROR REAL:', e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error: ${e.message} 🙏</Message></Response>`);
  }
}

// RUTAS
app.post('/whatsapp/:cliente', handleReserva);
app.post('/whatsapp', (req, res) => { req.params.cliente = 'carmen'; return handleReserva(req, res); });
app.post('/webhook', (req, res) => { req.params.cliente = 'carmen'; return handleReserva(req, res); });

app.get('/', (req,res)=> res.sendFile(path.join(__dirname, "public", "index.html")));
app.get('/ping', (req,res)=> res.send('Maki Bot AGENCIA V9 Live'));

app.listen(process.env.PORT||10000, ()=>console.log('🚀 Maki Bot AGENCIA V9 Live'));
