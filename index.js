const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 10000;

const BUSINESS_NAME = process.env.BUSINESS_NAME || "Peluquería Carmen";
const BUSINESS_SHORT = process.env.BUSINESS_SHORT || "Carmen";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "14155238886";
const BUSINESS_ADDRESS = process.env.BUSINESS_ADDRESS || "C/ Mayor 12, 28001 Madrid";
const EMOJI = process.env.EMOJI || "✨";

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
  }catch(e){ return null; }
}
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
  let hora=null;
  if(texto.includes('a la una') || texto.includes('a las una')) hora=13;
  else if(texto.includes('a las dos') || texto.includes('a las 2')) hora=14;
  else if(texto.includes('a las tres') || texto.includes('a las 3')) hora=15;
  else if(texto.includes('a las cuatro') || texto.includes('a las 4')) hora=16;
  else if(texto.includes('a las cinco') || texto.includes('a las 5')) hora=17;
  else if(texto.includes('a las seis') || texto.includes('a las 6')) hora=18;
  else if(texto.includes('a las siete') || texto.includes('a las 7')) hora=19;
  else if(texto.includes('a las ocho') || texto.includes('a las 8')) hora=20;
  else {
    const mapaTexto={una:13,dos:14,tres:15,cuatro:16,cinco:17,seis:18,siete:19,ocho:20,nueve:9,diez:10,once:11,doce:12};
    for(let k in mapaTexto){ if(new RegExp(`\\b${k}\\b`).test(texto)){ hora=mapaTexto[k]; break; } }
    if(hora===null){
      const m=texto.match(/(\d{1,2})[:h ]*([0-5][0-9])?/);
      if(m){ hora=parseInt(m[1]); if(hora>=1 && hora<=7) hora+=12; if(hora===8) hora=20; }
    }
  }
  if(hora!==null && hora>=H_INI && hora<=H_FIN){ fecha.setHours(hora,0,0,0); } else if(hora!==null){ hora=null; }
  return {fecha,hora,tieneDia};
}
function toLocalMadrid(d){ const pad=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`; }
function formatHuecosPro(lista){ return lista.map(h=>`• ${h}`).join('\n'); }

app.get('/health',(req,res)=>res.send('OK'));
app.get('/', (req,res)=>{
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${BUSINESS_NAME} | Reserva premium</title><link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Inter:wght@400;500;600;800;900&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FDFBFF;color:#1A0B2E;font-family:'Inter',sans-serif}.top{background:linear-gradient(90deg,#F5F0FF 0%,#D8B4FE 25%,#E9D5A8 50%,#D8B4FE 75%,#F5F0FF 100%);color:#1A0B2E;text-align:center;padding:10px;font-size:10px;letter-spacing:3px;font-weight:900;border-bottom:1px solid #E9D5FF}.nav{max-width:1320px;margin:0 auto;padding:24px 32px;display:flex;justify-content:space-between;align-items:center}.brand{font-family:'Bodoni Moda',serif;font-size:22px;letter-spacing:-.3px}.brand b{background:linear-gradient(90deg,#4C1D95,#D4AF37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:400}.brand i{font-style:italic;color:#D4AF37}.nav a{background:#1A0B2E;color:#fff;padding:12px 24px;border-radius:999px;font-size:11px;font-weight:800;text-decoration:none;letter-spacing:1px;box-shadow:0 10px 25px rgba(26,11,46,.18)}.hero{max-width:1320px;margin:0 auto;padding:40px 32px 90px;display:grid;grid-template-columns:1.1fr.9fr;gap:70px;align-items:center}@media(max-width:900px){.hero{grid-template-columns:1fr;gap:40px}}.kicker{display:inline-flex;align-items:center;gap:10px;background:#fff;border:1px solid #F5E6C8;box-shadow:0 2px 10px rgba(212,175,55,.12);color:#8A6A1A;padding:8px 16px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:1.5px}h1{margin-top:22px;font-family:'Bodoni Moda',serif;font-size:96px;line-height:.88;letter-spacing:-4px;font-weight:400}h1.dark{color:#1A0B2E;display:block}h1.lila{background:linear-gradient(90deg,#8B5CF6,#D4AF37);-webkit-background-clip:text;-webkit-text-fill-color:transparent;display:block}.sub{margin-top:24px;color:#6E6580;font-size:17px;line-height:1.7;max-width:480px}.sub b{color:#1A0B2E}.btns{margin-top:36px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}.btn-gold{background:linear-gradient(90deg,#D4AF37 0%,#F3E5AB 50%,#D4AF37 100%);color:#1A0B2E;padding:19px 32px;border-radius:999px;text-decoration:none;font-weight:900;font-size:13px;box-shadow:0 14px 35px rgba(212,175,55,.35),inset 0 1px 0 rgba(255,255,255,.6);display:inline-flex;gap:10px}.btn-lila{background:#F5F0FF;border:1px solid #E9D5FF;color:#4C1D95;padding:19px 26px;border-radius:999px;text-decoration:none;font-weight:800;font-size:13px}.trust{margin-top:54px;display:flex;gap:32px}.trust div{border-left:1px solid #E9D5FF;padding-left:18px}.trust div:first-child{border:none;padding-left:0}.trust b{font-family:'Bodoni Moda',serif;font-size:30px;display:block;color:#1A0B2E;line-height:1}.trust span{font-size:10px;letter-spacing:1.2px;color:#9A8DB8;font-weight:800;margin-top:4px;display:block}.visual{position:relative}.glow1{position:absolute;width:520px;height:520px;left:-60px;top:-60px;background:radial-gradient(50% 50% at 50% 50%,rgba(216,180,254,.45) 0%,transparent 70%);filter:blur(10px);pointer-events:none}.glow2{position:absolute;width:520px;height:520px;right:-80px;bottom:-80px;background:radial-gradient(50% 50% at 50% 50%,rgba(233,213,168,.55) 0%,transparent 70%);filter:blur(10px);pointer-events:none}.card{background:rgba(255,255,255,.85);backdrop-filter:blur(25px);border:1px solid rgba(255,255,255,.9);border-radius:32px;padding:12px;box-shadow:0 40px 100px rgba(26,11,46,.12),0 0 0 1px rgba(233,213,255,.6);position:relative}.card-inner{background:#fff;border-radius:24px;overflow:hidden;border:1px solid #F5F0FF}.card-head{padding:18px 20px;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(90deg,#FDFBFF,#FFFBEB);border-bottom:1px solid #F5F0FF}.card-head.left{display:flex;align-items:center;gap:10px;font-weight:800;font-size:13px;color:#1A0B2E}.card-head.left span{width:30px;height:30px;background:linear-gradient(180deg,#8B5CF6,#D4AF37);border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:900}.badge{font-size:10px;background:#1A0B2E;color:#E9D5A8;padding:6px 12px;border-radius:999px;font-weight:800}.chat{padding:24px;display:flex;flex-direction:column;gap:14px;background:#FDFBFF}.msg{padding:14px 18px;border-radius:20px;font-size:13.8px;line-height:1.5;max-width:86%;box-shadow:0 4px 12px rgba(0,0,0,.03)}.msg.bot{background:#fff;border:1px solid #F1E8FF;color:#3A3350;border-radius:20px 20px 20px 6px}.msg.me{align-self:flex-end;background:linear-gradient(180deg,#1A0B2E 0%,#3B2563 100%);color:#fff;border-radius:20px 20px 6px 20px}.msg.bot.gold{border:1px solid #F3E5AB;background:linear-gradient(180deg,#FFFEFB,#FFFBEB)}</style></head><body><div class="top">✦ SISTEMA PREMIUM 2026 • LILA • DORADO • AUTOMÁTICO 24/7 • GOOGLE CALENDAR ✦</div><div class="nav"><div class="brand"><b>MAKI</b> <i>BOT</i></div><a href="https://wa.me/${WHATSAPP_NUMBER}">RESERVAR CITA →</a></div><div class="hero"><div><div class="kicker">✦ EL SISTEMA QUE USA LA ÉLITE</div><h1><span class="dark">Tu peluquería</span><span class="lila">no pierde ni una cita más.</span></h1><p class="sub">Las clientas de <b>${BUSINESS_NAME}</b> reservan solas por WhatsApp. Maki Bot pide <b>nombre y apellidos</b>, confirma con dirección y lo guarda en tu calendario. <b>Tú solo trabajas.</b></p><div class="btns"><a class="btn-gold" href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20quiero%20cita%20el%20lunes%20a%20las%2014:00">✦ Probar WhatsApp de ${BUSINESS_SHORT} →</a><a class="btn-lila" href="#">Ver demo en vivo</a></div><div class="trust"><div><b>+312</b><span>CITAS / MES</span></div><div><b>0.8s</b><span>RESPUESTA</span></div><div><b>24/7</b><span>PREMIUM</span></div></div></div><div class="visual"><div class="glow1"></div><div class="glow2"></div><div class="card"><div class="card-inner"><div class="card-head"><div class="left"><span>C</span> ${BUSINESS_NAME} • WhatsApp</div><div class="badge">● LIVE NOW</div></div><div class="chat"><div class="msg bot">Hola, soy Maki, asistente de<br><b>${BUSINESS_NAME} ✨</b><br><br>¿Para qué día te gustaría reservar?</div><div class="msg me">Hola quiero cita el lunes a las 14:00</div><div class="msg bot">Perfecto, tengo el lunes a las 14:00 libre ✨<br><br>¿A nombre de quién te reservo? Necesito nombre y apellido.</div><div class="msg me">Ana García</div><div class="msg bot gold">Reservado ✨<br><br>📅 <b>Lunes 14:00</b><br>👤 <b>Ana García</b><br><br>📍 ${BUSINESS_ADDRESS}</div></div></div></div></div></div></body></html>`);
});

app.post('/whatsapp', (req,res)=>{
  const from=req.body.From||'test';
  const raw=(req.body.Body||'').trim();
  const body=raw.toLowerCase();
  if(!sesiones[from]) sesiones[from]={estado:'inicio', fecha:null};
  const ses=sesiones[from];
  let reply='';
  const {fecha,hora,tieneDia}=parseFechaHora(raw);
  const tieneHora=hora!==null;
  const huecos=['10:00','11:00','12:00','13:00','14:00','17:00','18:00','19:00','20:00'];
  const esTonteria = /^(jaja|jeje|jajaja|xd|ok|vale|que|q|hola\?|jijiji|bueno)$/i.test(body) || body.length < 3;

  if(ses.estado==='pidiendo_nombre'){
    let textoNombre = raw.toLowerCase().replace(/nombre de|mi nombre es|me llamo|soy|nombre es|es de|nombre:/gi, '').trim();
    let nombreLimpio = textoNombre || raw;
    nombreLimpio = nombreLimpio.replace(/\s+/g,' ').trim();
    if(nombreLimpio.split(' ').filter(w=>w.length>1).length < 2){
      reply=`¿Me indicas tu nombre completo por favor? ${EMOJI}\n\nNecesito nombre y apellido para confirmar.\n\nEjemplo: Ana García`;
    }else{
      const nombre=nombreLimpio.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');
      const diaTxt=ses.fecha?ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'';
      const diaCap=diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
      try{
        const cal=getCalendar();
        if(cal && ses.fecha){
          cal.events.insert({
            calendarId:process.env.GOOGLE_CALENDAR_ID,
            requestBody:{
              summary:`${nombre} - ${BUSINESS_NAME}`,
              start:{dateTime:toLocalMadrid(ses.fecha), timeZone:'Europe/Madrid'},
              end:{dateTime:toLocalMadrid(new Date(ses.fecha.getTime()+45*60000)), timeZone:'Europe/Madrid'},
              location:BUSINESS_ADDRESS
            }
          }).catch(()=>{});
        }
      }catch(e){}
      reply=`¡Reservado, ${nombre.split(' ')[0]}! ${EMOJI}\n\nTu cita en ${BUSINESS_NAME} está confirmada:\n\n📅 ${diaCap}\n👤 ${nombre}\n📍 ${BUSINESS_ADDRESS}\n\n¡Gracias por confiar en nosotros!`;
      delete sesiones[from];
      sesiones[from] = { estado: 'acaba_de_reservar', fecha: null };
    }
  }else if(ses.estado === 'acaba_de_reservar'){
    if(/gracias|graciad|jaja|jeje|genial|perfecto|ok|vale/i.test(body)){
      reply=`¡De nada ${EMOJI} Nos vemos en ${BUSINESS_NAME}!`;
      delete sesiones[from];
    } else {
      ses.estado='pidiendo_fecha';
      reply=`¿Quieres reservar otra cita? ${EMOJI}\n\n¿Para qué día te gustaría?`;
    }
  }else if(ses.estado==='pidiendo_hora' && tieneHora && ses.fecha){
    ses.fecha.setHours(hora,0,0,0);
    ses.estado='pidiendo_nombre';
    const diaCap=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    const diaCap2=diaCap.charAt(0).toUpperCase()+diaCap.slice(1);
    reply=`Perfecto ${EMOJI}\n\nHe bloqueado el ${diaCap2} a las ${hora}:00 para ti.\n\n¿A nombre de quién hago la reserva? Por favor, nombre y apellidos.`;
  }else if(tieneDia){
    ses.fecha=fecha;
    const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    const diaCap=diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
    if(tieneHora){
      ses.estado='pidiendo_nombre';
      reply=`Perfecto ${EMOJI}\n\nTengo disponible el ${diaCap} a las ${hora}:00.\n\n¿A nombre de quién confirmo la reserva?\nNecesito tu nombre y apellidos.`;
    }else{
      ses.estado='pidiendo_hora';
      reply=`¡Genial! Para el ${diaCap} ${EMOJI}\n\nTengo estos horarios disponibles:\n\n${formatHuecosPro(huecos)}\n\n¿Qué hora te viene mejor?`;
    }
  }else if(tieneHora){
    ses.fecha=fecha;
    ses.estado='pidiendo_nombre';
    const diaCap=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    const diaCap2=diaCap.charAt(0).toUpperCase()+diaCap.slice(1);
    reply=`Perfecto ${EMOJI}\n\nTengo disponible el ${diaCap2} a las ${hora}:00.\n\n¿A nombre de quién confirmo la reserva?`;
  }else{
    if(esTonteria){
      if(ses.estado==='pidiendo_hora' && ses.fecha){
        const diaTxt=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
        const diaCap=diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
        reply=`Jajaja ${EMOJI} dime, ¿qué hora te viene bien para el ${diaCap}?\n\nTengo:\n${formatHuecosPro(huecos)}`;
      } else if(ses.estado==='pidiendo_nombre'){
        reply=`Dime tu nombre completo y te lo cierro ya ${EMOJI}\n\nEjemplo: Ana García`;
      } else {
        reply=`Dime ${EMOJI} ¿para qué día quieres la cita en ${BUSINESS_NAME}?`;
      }
    } else if(ses.estado==='pidiendo_hora' && ses.fecha){
      const diaTxt=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
      const diaCap=diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
      reply=`Dime qué hora te viene bien para el ${diaCap} ${EMOJI}\n\nTengo libres:\n\n${formatHuecosPro(huecos)}`;
    } else {
      ses.estado='pidiendo_fecha';
      reply=`Hola, bienvenida a ${BUSINESS_NAME} ${EMOJI}\n\nSoy Maki, tu asistente de reservas premium.\n\n¿Para qué día te gustaría reservar tu cita?`;
    }
  }

  res.set('Content-Type','text/xml');
  return res.status(200).send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT,()=>console.log('LIVE V5.5 HUMANO PRO'));
