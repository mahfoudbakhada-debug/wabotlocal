const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 10000;

const BUSINESS_NAME = process.env.BUSINESS_NAME || "Peluquería Carmen";
const BUSINESS_SHORT = process.env.BUSINESS_SHORT || "Carmen";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "14155238886";
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || "C/ Mayor 12, 28001 Madrid";
const EMOJI = process.env.EMOJI || "✨";

const sesiones = {};
const H_INI=9, H_FIN=20;

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
  if(m){ hora=parseInt(m[1]); if(hora<8) hora+=12; if(hora>=H_INI && hora<=H_FIN) fecha.setHours(hora,0,0,0); else hora=null; }
  return {fecha,hora,tieneDia};
}
function getHuecosFake(){ return ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']; }
function formatHuecosPro(lista){ return lista.map(h=>`• ${h}`).join('\n'); }
function toLocalMadrid(d){ const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`; }

app.get('/health',(req,res)=>res.send('OK'));
app.get('/', (req,res)=>{
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${BUSINESS_NAME} | Reserva premium</title><link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Inter:wght@400;500;600;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FDFBFF;color:#1A0B2E;font-family:'Inter',sans-serif}.top{background:linear-gradient(90deg,#F5F0FF 0%,#D8B4FE 25%,#E9D5A8 50%,#D8B4FE 75%,#F5F0FF 100%);color:#1A0B2E;text-align:center;padding:10px;font-size:10px;letter-spacing:3px;font-weight:900;border-bottom:1px solid #E9D5FF}.nav{max-width:1320px;margin:0 auto;padding:24px 32px;display:flex;justify-content:space-between;align-items:center}.brand{font-family:'Bodoni Moda',serif;font-size:22px}.brand b{background:linear-gradient(90deg,#4C1D95,#D4AF37);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.brand i{font-style:italic;color:#D4AF37}.nav a{background:#1A0B2E;color:#fff;padding:12px 24px;border-radius:999px;font-size:11px;font-weight:800;text-decoration:none}.hero{max-width:1320px;margin:0 auto;padding:40px 32px 90px;display:grid;grid-template-columns:1.1fr.9fr;gap:70px;align-items:center}@media(max-width:900px){.hero{grid-template-columns:1fr}}.kicker{display:inline-flex;background:#fff;border:1px solid #F5E6C8;color:#8A6A1A;padding:8px 16px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:1.5px}h1{margin-top:22px;font-family:'Bodoni Moda',serif;font-size:96px;line-height:.88;letter-spacing:-4px;font-weight:400}.sub{margin-top:24px;color:#6E6580;font-size:17px;line-height:1.7;max-width:480px}.btns{margin-top:36px;display:flex;gap:14px;flex-wrap:wrap}.btn-gold{background:linear-gradient(90deg,#D4AF37 0%,#F3E5AB 50%,#D4AF37 100%);color:#1A0B2E;padding:19px 32px;border-radius:999px;text-decoration:none;font-weight:900;font-size:13px}.btn-lila{background:#F5F0FF;border:1px solid #E9D5FF;color:#4C1D95;padding:19px 26px;border-radius:999px;text-decoration:none;font-weight:800;font-size:13px}.card{background:#fff;border-radius:32px;padding:12px;box-shadow:0 40px 100px rgba(26,11,46,.12)}.card-inner{background:#fff;border-radius:24px;overflow:hidden;border:1px solid #F5F0FF}.chat{padding:24px;display:flex;flex-direction:column;gap:14px;background:#FDFBFF}.msg{padding:14px 18px;border-radius:20px;font-size:13.8px;max-width:86%}.msg.bot{background:#fff;border:1px solid #F1E8FF;color:#3A3350;border-radius:20px 20px 20px 6px}.msg.me{align-self:flex-end;background:#1A0B2E;color:#fff;border-radius:20px 20px 6px 20px}</style></head><body><div class="top">✦ SISTEMA PREMIUM 2026 • LILA • DORADO • AUTOMÁTICO 24/7 • GOOGLE CALENDAR ✦</div><div class="nav"><div class="brand"><b>MAKI</b> <i>BOT</i></div><a href="https://wa.me/${WHATSAPP_NUMBER}">RESERVAR CITA →</a></div><div class="hero"><div><div class="kicker">✦ EL SISTEMA QUE USA LA ÉLITE</div><h1><span>Tu peluquería</span><span style="background:linear-gradient(90deg,#8B5CF6,#D4AF37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:block">no pierde ni una cita más.</span></h1><p class="sub">Las clientas de <b>${BUSINESS_NAME}</b> reservan solas por WhatsApp.</p><div class="btns"><a class="btn-gold" href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20quiero%20cita%20el%20lunes%20a%20las%2014:00">✦ Probar WhatsApp →</a></div></div><div class="card"><div class="card-inner"><div class="chat"><div class="msg bot">Hola, soy Maki ✨ ¿Para qué día?</div><div class="msg me">Lunes 13:00</div><div class="msg bot">Perfecto, Lunes 13:00 libre ✨</div></div></div></div></div></body></html>`);
});

// BOT 100% ESTABLE - CONTESTA SIEMPRE
app.post('/whatsapp', async (req,res)=>{
  const from = req.body.From || 'test';
  const raw = (req.body.Body||'').trim();
  const body = raw.toLowerCase();
  if(!sesiones[from]) sesiones[from]={estado:'inicio', fecha:null};
  const ses=sesiones[from];
  let reply='';

  const {fecha, hora, tieneDia} = parseFechaHora(raw);
  const tieneHora = hora!==null;
  const libres = getHuecosFake();

  try{
    // MEMORIA: si ya tenia dia y solo dice hora
    if(ses.estado==='pidiendo_hora' && tieneHora &&!tieneDia && ses.fecha){
      ses.fecha.setHours(hora,0,0,0);
      const diaCap = ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
      const diaCap2 = diaCap.charAt(0).toUpperCase()+diaCap.slice(1);
      ses.estado='pidiendo_nombre';
      reply=`Perfecto ${EMOJI}\n\nHe bloqueado el ${diaCap2} a las ${hora}:00 para ti.\n\n¿A nombre de quién hago la reserva? Por favor, nombre y apellidos.`;
    }
    else if(ses.estado==='pidiendo_nombre'){
      if(raw.split(' ').length<2){
        reply=`¿Me indicas tu nombre completo por favor? ${EMOJI}\n\nEjemplo: Ana García`;
      } else {
        const nombre = raw.trim().split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');
        const diaTxt = ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
        const diaCap = diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
        reply=`¡Reservado, ${nombre.split(' ')[0]}! ${EMOJI}\n\nTu cita en ${BUSINESS_NAME} está confirmada:\n\n📅 ${diaCap}\n👤 ${nombre}\n📍 ${BUSINESS_ADDRESS}\n\n¡Gracias por confiar en nosotros!`;
        delete sesiones[from];
      }
    }
    else if(tieneDia){
      ses.fecha=fecha;
      const diaTxt = fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
      const diaCap = diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
      if(tieneHora){
        ses.estado='pidiendo_nombre';
        reply=`Perfecto ${EMOJI}\n\nTengo disponible el ${diaCap} a las ${hora}:00.\n\n¿A nombre de quién confirmo la reserva?\nNecesito tu nombre y apellidos.`;
      } else {
        ses.estado='pidiendo_hora';
        reply=`¡Genial! Para el ${diaCap} ${EMOJI}\n\nTengo estos horarios disponibles:\n\n${formatHuecosPro(libres)}\n\n¿Qué hora te viene mejor?`;
      }
    }
    else if(tieneHora && ses.fecha){
      ses.fecha.setHours(hora,0,0,0);
      const diaCap = ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
      const diaCap2 = diaCap.charAt(0).toUpperCase()+diaCap.slice(1);
      ses.estado='pidiendo_nombre';
      reply=`Perfecto ${EMOJI}\n\nHe bloqueado el ${diaCap2} a las ${hora}:00 para ti.\n\n¿A nombre de quién hago la reserva?`;
    }
    else{
      ses.estado='pidiendo_fecha';
      reply=`Hola, bienvenida a ${BUSINESS_NAME} ${EMOJI}\n\nSoy Maki, tu asistente de reservas premium.\n\n¿Para qué día te gustaría reservar tu cita?\n\nEjemplo: "Lunes a las 13:00"`;
    }
  }catch(e){
    console.log('ERROR', e);
    reply=`Hola, bienvenida a ${BUSINESS_NAME} ${EMOJI}\n\n¿Para qué día te gustaría reservar?`;
  }

  res.set('Content-Type','text/xml');
  return res.status(200).send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT,()=>console.log('LIVE V5.1 STABLE '+BUSINESS_NAME));
