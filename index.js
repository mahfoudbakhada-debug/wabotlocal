const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 10000;

// --- CANDADO PAGO ---
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  if (cfg.activo === false) { console.log('🚫 NO PAGÓ'); process.exit(0); }
} catch {}

// --- CONFIG AGENCIA ---
const CLIENTES = {
  carmen: {
    calendarId: 'ec9d34923d8485b113ae92cef106fe55a7aa7e69cd4225007a907b708ec6252a@group.calendar.google.com',
    nombre: process.env.BUSINESS_NAME || "Peluquería Carmen",
    short: process.env.BUSINESS_SHORT || "Carmen",
    direccion: process.env.BUSINESS_ADDRESS || "C/ Mayor 12, 28001 Madrid",
    emoji: "✨",
    whatsapp: process.env.WHATSAPP_NUMBER || "14155238886"
  }
};

const H_INI=10, H_FIN=20;
const sesiones = {};

function getGoogleCreds() {
  if (process.env.GOOGLE_CREDENTIALS) return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  if (process.env.GOOGLE_CREDS_B64) return JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8'));
  return null;
}
function getCalendar() {
  const creds = getGoogleCreds(); if(!creds) return null;
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
  return google.calendar({ version: 'v3', auth });
}

function parseFechaHora(texto){
  texto = texto.toLowerCase(); const hoy=new Date(); hoy.setHours(0,0,0,0); let fecha=new Date(hoy);
  if(texto.includes('mañana') &&!texto.includes('pasado')) fecha.setDate(hoy.getDate()+1);
  else if(texto.includes('pasado mañana')) fecha.setDate(hoy.getDate()+2);
  else { const dias={lunes:1,martes:2,miercoles:3,miércoles:3,jueves:4,viernes:5,sabado:6,sábado:6,domingo:0}; for(let d in dias){ if(texto.includes(d)){ let diff=(dias[d]-hoy.getDay()+7)%7; if(diff===0) diff=7; fecha.setDate(hoy.getDate()+diff); break; } } }
  let hora=null; const m=texto.match(/(\d{1,2})[:h ]*([0-5][0-9])?/); if(m){ hora=parseInt(m[1]); if(hora>0 && hora<8) hora+=12; fecha.setHours(hora,0,0,0); }
  return {fecha,hora};
}

async function getHuecosLibres(fecha, calendarId){
  try{
    const calendar=getCalendar(); if(!calendar) return ['10:00','11:00','12:00','17:00','18:00'];
    const ini=new Date(fecha); ini.setHours(H_INI,0,0,0); const fin=new Date(fecha); fin.setHours(H_FIN,0,0,0);
    const res=await calendar.events.list({calendarId, timeMin:ini.toISOString(), timeMax:fin.toISOString(), singleEvents:true});
    const ocupadas=(res.data.items||[]).map(e=>new Date(e.start.dateTime||e.start.date).getHours());
    let libres=[]; for(let h=H_INI;h<H_FIN;h++) if(!ocupadas.includes(h)) libres.push(h+':00'); return libres.length?libres:['11:00','17:00'];
  }catch(e){ console.log(e.message); return ['10:00','11:00','17:00','18:00']; }
}

// --- LANDING 2026 PREMIUM ---
app.get('/', (req,res)=>{
  const cfg = CLIENTES.carmen;
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${cfg.nombre} | Reserva online</title>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FCFBF8;color:#121212;font-family:'Inter',sans-serif}
.top{width:100%;background:#121212;color:#E9D5A8;text-align:center;padding:11px;font-size:10px;letter-spacing:2px;font-weight:700}
.nav{max-width:1280px;margin:0 auto;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}
.nav b{font-family:'Bodoni Moda',serif;font-size:20px;letter-spacing:-.5px;font-weight:400}
.hero{max-width:1280px;margin:0 auto;padding:20px 32px 80px;display:grid;grid-template-columns:1.1fr.9fr;gap:40px}
@media(max-width:900px){.hero{grid-template-columns:1fr}}h1{font-family:'Bodoni Moda',serif;font-size:92px;line-height:.85;letter-spacing:-3px;font-weight:400}
h1 i{font-style:italic;color:#C8A97E}.card{background:#fff;border:1px solid #EDE8E1;border-radius:24px;padding:8px;box-shadow:0 30px 60px rgba(0,0,0,.08)}
.btn-black{background:#121212;color:#fff;padding:18px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px}
</style></head><body>
<div class="top">RESERVAS AUTOMÁTICAS POR WHATSAPP 24/7 • CONECTADO A GOOGLE CALENDAR</div>
<div class="nav"><b>MAKI <i>BOT</i></b><a href="https://wa.me/${cfg.whatsapp}" style="border:1px solid #121212;padding:10px 20px;border-radius:999px;font-size:11px;text-decoration:none;color:#121212;font-weight:700">RESERVAR CITA</a></div>
<div class="hero"><div><h1>Tu agenda<br><i>llena, sin perder tiempo.</i></h1><p style="margin-top:24px;color:#6B6B6B;max-width:440px">Las clientas de <b>${cfg.nombre}</b> reservan solas por WhatsApp. Pide nombre y apellidos, confirma y guarda en tu calendario.</p><div style="margin-top:32px"><a class="btn-black" href="https://wa.me/${cfg.whatsapp}?text=Hola%20quiero%20cita%20el%20lunes%20a%20las%2014:00">Probar WhatsApp de ${cfg.short} →</a></div></div><div><div class="card"><div style="padding:20px">✅ Bot Activo - ${cfg.nombre}<br><br>📅 Conectado a: ${cfg.calendarId.substring(0,20)}...<br>📍 ${cfg.direccion}<br><br>Maki Bot V10 Live</div></div></div></div></body></html>`);
});

app.get('/health',(req,res)=>res.send('OK V10'));

// --- BOT AGENCIA ---
async function handleBot(req,res){
  const clienteId = (req.params.cliente || 'carmen').toLowerCase();
  const config = CLIENTES[clienteId] || CLIENTES.carmen;
  const from=req.body.From || 'test'; const raw=(req.body.Body||"").trim(); const body=raw.toLowerCase();
  const key = `${clienteId}_${from}`;
  if(!sesiones[key]) sesiones[key]={estado:'inicio'};
  const ses=sesiones[key];
  let reply="";

  try{
    const {fecha,hora}=parseFechaHora(raw);
    const tieneDia = /lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|mañana|hoy/.test(body);
    const tieneHora = hora!==null && hora>=H_INI && hora<H_FIN;

    if(tieneDia || tieneHora){
      ses.fecha=fecha; ses.hora=hora;
      const libres=await getHuecosLibres(fecha, config.calendarId);
      const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});

      if(tieneHora){
        if(!libres.includes(hora+':00')){
          reply=`Para el ${diaTxt} a las ${hora}:00 ya lo tengo completo.\n\nTengo libre: ${libres.join(', ')}\n\n¿Qué hora te va mejor?`;
          ses.estado='pidiendo_hora';
        } else {
          ses.estado='pidiendo_nombre';
          reply=`Perfecto, tengo el ${diaTxt} a las ${hora}:00 libre ${config.emoji}\n\n¿A nombre de quién te reservo? Necesito nombre y apellido.`;
        }
      } else {
        ses.estado='pidiendo_hora';
        reply=`Perfecto, ${diaTxt} ${config.emoji}\n\nTengo libre: ${libres.join(', ')}\n\n¿Qué hora te viene bien?`;
      }
    }
    else if(ses.estado==='inicio'){
      ses.estado='pidiendo_fecha';
      reply=`${config.nombre} ${config.emoji}\n\nBienvenida.\n\n¿Para qué día te gustaría reservar?`;
    }
    else if(ses.estado==='pidiendo_hora'){
      if(hora===null){
        const libres=await getHuecosLibres(ses.fecha, config.calendarId);
        reply=`Dime una hora entre ${libres.join(', ')} y te la guardo.`;
      } else {
        ses.fecha.setHours(hora,0,0,0); ses.hora=hora;
        const libres=await getHuecosLibres(ses.fecha, config.calendarId);
        if(!libres.includes(hora+':00')){
          reply=`Esa hora ya está ocupada. Me queda: ${libres.join(', ')}`;
        } else {
          ses.estado='pidiendo_nombre';
          reply=`Genial, ${ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})} a las ${hora}:00 ${config.emoji}\n\n¿A nombre de quién hago la reserva?`;
        }
      }
    }
    else if(ses.estado==='pidiendo_nombre'){
      if(raw.split(' ').length < 2){
        reply=`¿Me dices tu nombre y apellido completo por favor?\n\nEj: Ana García`;
      } else {
        ses.nombre=raw.trim();
        try{
          const cal=getCalendar();
          if(cal) await cal.events.insert({
            calendarId:config.calendarId,
            requestBody:{
              summary:`💈 ${ses.nombre} - Cita`,
              description:`Cliente: ${ses.nombre}\nTel: ${from}\nVía Maki Bot`,
              start:{dateTime:ses.fecha.toISOString(), timeZone:'Europe/Madrid'},
              end:{dateTime:new Date(ses.fecha.getTime()+60*60000).toISOString(), timeZone:'Europe/Madrid'},
              location: config.direccion
            }
          });
        }catch(e){console.log(e.message)}
        const diaTxt=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
        reply=`Reservado ${config.emoji}\n\n${config.nombre}\n📅 ${diaTxt}\n👤 ${ses.nombre}\n📍 ${config.direccion}\n\nTe esperamos.`;
        delete sesiones[key];
      }
    }
  }catch(e){ reply=`¿Me repites por favor?`; }

  res.set('Content-Type','text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
}

app.post('/whatsapp/:cliente', handleBot);
app.post('/whatsapp', (req,res)=>{ req.params.cliente='carmen'; return handleBot(req,res); });
app.post('/webhook', (req,res)=>{ req.params.cliente='carmen'; return handleBot(req,res); });

app.listen(PORT,()=>console.log('🚀 MAKI BOT V10 AGENCIA LIVE - '+CLIENTES.carmen.nombre));
