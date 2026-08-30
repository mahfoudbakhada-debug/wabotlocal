const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 10000;

// --- CANDADO ---
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
  if (cfg.activo === false) { console.log('🚫 NO PAGÓ'); process.exit(0); }
} catch {}

// --- CONFIG AGENCIA / CLIENTE ---
const CLIENTES = {
  carmen: {
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'ec9d34923d8485b113ae92cef106fe55a7aa7e69cd4225007a907b708ec6252a@group.calendar.google.com',
    nombre: process.env.BUSINESS_NAME || "Peluquería Carmen",
    short: process.env.BUSINESS_SHORT || "Carmen",
    direccion: process.env.BUSINESS_ADDRESS || "C/ Mayor 12, 28001 Madrid",
    whatsapp: process.env.WHATSAPP_NUMBER || "14155238886",
    emoji: "✨"
  },
  lola: {
    calendarId: 'ID_CALENDARIO_DE_LOLA_AQUI',
    nombre: "Uñas Lola",
    short: "Lola",
    direccion: "Calle Sol 5",
    whatsapp: "14155238886",
    emoji: "💅"
  }
};

function getGoogleCreds() {
  if (process.env.GOOGLE_CREDENTIALS) return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  if (process.env.GOOGLE_CREDS_B64) return JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8'));
  return null;
}
function getCalendar() {
  try{
    const creds = getGoogleCreds(); if(!creds) return null;
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
    return google.calendar({ version: 'v3', auth });
  }catch{ return null; }
}

const sesiones = {};
const H_INI=10, H_FIN=20;

function parseFechaHora(texto){
  texto=(texto||'').toLowerCase(); const hoy=new Date(); hoy.setHours(0,0,0,0); let fecha=new Date(hoy);
  let tieneDia=false;
  if(texto.includes('mañana') &&!texto.includes('pasado')){ fecha.setDate(hoy.getDate()+1); tieneDia=true; }
  else if(texto.includes('pasado mañana')){ fecha.setDate(hoy.getDate()+2); tieneDia=true; }
  else {
    const dias={lunes:1,martes:2,miercoles:3,'miércoles':3,jueves:4,viernes:5,sabado:6,'sábado':6,domingo:0};
    for(let d in dias){ if(texto.includes(d)){ let diff=(dias[d]-hoy.getDay()+7)%7; if(diff===0) diff=7; fecha.setDate(hoy.getDate()+diff); tieneDia=true; break; } }
    if(texto.includes('hoy')) tieneDia=true;
  }
  let hora=null; const m=texto.match(/(\d{1,2})[:h ]*([0-5][0-9])?/);
  if(m){ hora=parseInt(m[1]); if(hora>0 && hora<8) hora+=12; if(hora>=H_INI && hora<=H_FIN) fecha.setHours(hora,0,0,0); else hora=null; }
  return {fecha,hora,tieneDia};
}
function toLocalMadrid(d){ const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`; }
function formatHuecosPro(lista){ return lista.map(h=>`• ${h}`).join('\n'); }

async function getHuecosLibres(fecha, calendarId){
  try{
    const calendar=getCalendar(); if(!calendar) return ['10:00','11:00','12:00','17:00','18:00','19:00'];
    const ini=new Date(fecha); ini.setHours(H_INI,0,0,0); const fin=new Date(fecha); fin.setHours(H_FIN,0,0,0);
    const res=await calendar.events.list({calendarId, timeMin:ini.toISOString(), timeMax:fin.toISOString(), singleEvents:true});
    const ocupadas=(res.data.items||[]).map(e=>new Date(e.start.dateTime||e.start.date).getHours());
    let libres=[]; for(let h=H_INI;h<H_FIN;h++) if(!ocupadas.includes(h)) libres.push(h+':00');
    return libres.length?libres:['11:00','17:00'];
  }catch{ return ['10:00','11:00','12:00','17:00','18:00']; }
}

// --- LANDING LILA GOLD 2026 ---
app.get('/', (req,res)=>{
  const cfg = CLIENTES.carmen;
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${cfg.nombre} | Reserva premium</title><link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Inter:wght@400;500;600;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FDFBFF;color:#1A0B2E;font-family:'Inter',sans-serif}.top{background:linear-gradient(90deg,#F5F0FF 0%,#D8B4FE 25%,#E9D5A8 50%,#D8B4FE 75%,#F5F0FF 100%);color:#1A0B2E;text-align:center;padding:10px;font-size:10px;letter-spacing:3px;font-weight:900;border-bottom:1px solid #E9D5FF}.nav{max-width:1320px;margin:0 auto;padding:24px 32px;display:flex;justify-content:space-between;align-items:center}.brand{font-family:'Bodoni Moda',serif;font-size:22px}.brand b{background:linear-gradient(90deg,#4C1D95,#D4AF37);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.brand i{font-style:italic;color:#D4AF37}.nav a{background:#1A0B2E;color:#fff;padding:12px 24px;border-radius:999px;font-size:11px;font-weight:800;text-decoration:none}.hero{max-width:1320px;margin:0 auto;padding:40px 32px 90px;display:grid;grid-template-columns:1.1fr.9fr;gap:70px;align-items:center}@media(max-width:900px){.hero{grid-template-columns:1fr}}.kicker{display:inline-flex;gap:10px;background:#fff;border:1px solid #F5E6C8;color:#8A6A1A;padding:8px 16px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:1.5px}h1{margin-top:22px;font-family:'Bodoni Moda',serif;font-size:96px;line-height:.88;letter-spacing:-4px;font-weight:400}h1.dark{color:#1A0B2E;display:block}h1.lila{background:linear-gradient(90deg,#8B5CF6,#D4AF37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:block}.sub{margin-top:24px;color:#6E6580;font-size:17px;line-height:1.7;max-width:480px}.btn-gold{background:linear-gradient(90deg,#D4AF37 0%,#F3E5AB 50%,#D4AF37 100%);color:#1A0B2E;padding:19px 32px;border-radius:999px;text-decoration:none;font-weight:900;font-size:13px;box-shadow:0 14px 35px rgba(212,175,55,.35)}.card{background:rgba(255,255,255,.85);backdrop-filter:blur(25px);border:1px solid rgba(255,255,255,.9);border-radius:32px;padding:12px;box-shadow:0 40px 100px rgba(26,11,46,.12)}.card-inner{background:#fff;border-radius:24px;overflow:hidden;border:1px solid #F5F0FF}.card-head{padding:18px 20px;display:flex;justify-content:space-between;background:linear-gradient(90deg,#FDFBFF,#FFFBEB);border-bottom:1px solid #F5F0FF}.chat{padding:24px;display:flex;flex-direction:column;gap:14px;background:#FDFBFF}.msg{padding:14px 18px;border-radius:20px;font-size:13.8px;max-width:86%}.msg.bot{background:#fff;border:1px solid #F1E8FF;border-radius:20px 20px 20px 6px}.msg.me{align-self:flex-end;background:#1A0B2E;color:#fff;border-radius:20px 20px 6px 20px}.msg.bot.gold{border:1px solid #F3E5AB;background:linear-gradient(180deg,#FFFEFB,#FFFBEB)}</style></head><body><div class="top">✦ SISTEMA PREMIUM 2026 • LILA • DORADO • AUTOMÁTICO 24/7 • GOOGLE CALENDAR ✦</div><div class="nav"><div class="brand"><b>MAKI</b> <i>BOT</i></div><a href="https://wa.me/${cfg.whatsapp}">RESERVAR CITA →</a></div><div class="hero"><div><div class="kicker">✦ EL SISTEMA QUE USA LA ÉLITE</div><h1><span class="dark">Tu peluquería</span><span class="lila">no pierde ni una cita más.</span></h1><p class="sub">Las clientas de <b>${cfg.nombre}</b> reservan solas por WhatsApp. Maki pide <b>nombre y apellidos</b>, confirma con dirección y lo guarda en tu calendario.</p><div style="margin-top:36px"><a class="btn-gold" href="https://wa.me/${cfg.whatsapp}?text=Hola%20quiero%20cita%20el%20lunes%20a%20las%2014:00">✦ Probar WhatsApp de ${cfg.short} →</a></div></div><div><div class="card"><div class="card-inner"><div class="card-head"><div>● ${cfg.nombre} • WhatsApp</div><div style="font-size:10px;background:#1A0B2E;color:#E9D5A8;padding:6px 12px;border-radius:999px">LIVE NOW</div></div><div class="chat"><div class="msg bot">Hola, soy Maki de <b>${cfg.nombre} ✨</b><br><br>¿Para qué día te gustaría reservar?</div><div class="msg me">Hola quiero cita el lunes a las 14:00</div><div class="msg bot">Perfecto, lunes a las 14:00 libre ✨<br>¿Nombre y apellido?</div><div class="msg me">Ana García</div><div class="msg bot gold">Reservado ✨<br>📅 Lunes 14:00<br>👤 Ana García<br>📍 ${cfg.direccion}</div></div></div></div></div></div></body></html>`);
});

app.get('/health',(req,res)=>res.send('OK V11'));

// --- BOT INTELIGENTE ---
async function handleBot(req,res){
  const clienteId = (req.params.cliente || 'carmen').toLowerCase();
  const config = CLIENTES[clienteId] || CLIENTES.carmen;
  const from=req.body.From||'test';
  const raw=(req.body.Body||'').trim();
  const key = `${clienteId}_${from}`;
  if(!sesiones[key]) sesiones[key]={estado:'inicio', fecha:null};
  const ses=sesiones[key];
  let reply='';
  const {fecha,hora,tieneDia}=parseFechaHora(raw);
  const tieneHora=hora!==null;

  if(ses.estado==='pidiendo_nombre'){
    if(raw.split(' ').filter(w=>w.length>1).length<2){
      reply=`¿Me indicas tu nombre completo por favor? ${config.emoji}\n\nNecesito nombre y apellido para confirmar.\n\nEjemplo: Ana García`;
    }else{
      const nombre=raw.trim().split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');
      const diaTxt=ses.fecha?ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'';
      const diaCap=diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
      try{
        const cal=getCalendar();
        if(cal && ses.fecha){
          await cal.events.insert({
            calendarId:config.calendarId,
            requestBody:{
              summary:`💈 ${nombre} - Cita`,
              description:`Cliente: ${nombre}\nTel: ${from}\nMaki Bot ${config.nombre}`,
              start:{dateTime:toLocalMadrid(ses.fecha), timeZone:'Europe/Madrid'},
              end:{dateTime:toLocalMadrid(new Date(ses.fecha.getTime()+60*60000)), timeZone:'Europe/Madrid'},
              location:config.direccion
            }
          });
        }
      }catch(e){console.log('Calendar error',e.message)}
      reply=`¡Reservado, ${nombre.split(' ')[0]}! ${config.emoji}\n\nTu cita en ${config.nombre} está confirmada:\n\n📅 ${diaCap}\n👤 ${nombre}\n📍 ${config.direccion}\n\n¡Gracias por confiar en nosotros!`;
      delete sesiones[key];
    }
  }else if(ses.estado==='pidiendo_hora' && tieneHora && ses.fecha){
    ses.fecha.setHours(hora,0,0,0);
    ses.estado='pidiendo_nombre';
    const diaCap=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    reply=`Perfecto ${config.emoji}\n\nHe bloqueado el ${diaCap.charAt(0).toUpperCase()+diaCap.slice(1)} a las ${hora}:00 para ti.\n\n¿A nombre de quién hago la reserva? Por favor, nombre y apellidos.`;
  }else if(tieneDia){
    ses.fecha=fecha;
    const libres=await getHuecosLibres(fecha, config.calendarId);
    const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    const diaCap=diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
    if(tieneHora){
      if(!libres.includes(hora+':00')){
        ses.estado='pidiendo_hora';
        reply=`Para el ${diaCap} a las ${hora}:00 ya lo tengo completo.\n\nTengo libre:\n${formatHuecosPro(libres)}\n\n¿Qué hora te va mejor?`;
      } else {
        ses.estado='pidiendo_nombre';
        reply=`Perfecto ${config.emoji}\n\nTengo disponible el ${diaCap} a las ${hora}:00.\n\n¿A nombre de quién confirmo la reserva?\nNecesito tu nombre y apellidos.`;
      }
    }else{
      ses.estado='pidiendo_hora';
      reply=`¡Genial! Para el ${diaCap} ${config.emoji}\n\nTengo estos horarios disponibles:\n\n${formatHuecosPro(libres)}\n\n¿Qué hora te viene mejor?`;
    }
  }else if(tieneHora){
    ses.fecha=fecha;
    const libres=await getHuecosLibres(fecha, config.calendarId);
    if(!libres.includes(hora+':00')){
      ses.estado='pidiendo_hora';
      reply=`Esa hora ya está ocupada.\n\nMe queda:\n${formatHuecosPro(libres)}`;
    } else {
      ses.estado='pidiendo_nombre';
      reply=`Perfecto ${config.emoji}\n\nTengo disponible el ${fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})} a las ${hora}:00.\n\n¿A nombre de quién confirmo?`;
    }
  }else{
    ses.estado='pidiendo_fecha';
    reply=`Hola, bienvenida a ${config.nombre} ${config.emoji}\n\nSoy Maki, tu asistente de reservas premium.\n\n¿Para qué día te gustaría reservar tu cita?`;
  }

  res.set('Content-Type','text/xml');
  return res.status(200).send(`<Response><Message>${reply}</Message></Response>`);
}

app.post('/whatsapp/:cliente', handleBot);
app.post('/whatsapp', (req,res)=>{ req.params.cliente='carmen'; return handleBot(req,res); });
app.post('/webhook', (req,res)=>{ req.params.cliente='carmen'; return handleBot(req,res); });

app.listen(PORT,()=>console.log('🚀 MAKI BOT V11 ULTIMATE LIVE - '+CLIENTES.carmen.calendarId));
