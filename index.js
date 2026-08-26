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

// --- GOOGLE ---
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
const sesiones = {};
const H_INI=9, H_FIN=20;

function parseFechaHora(texto){
  texto = texto.toLowerCase(); const hoy=new Date(); hoy.setHours(0,0,0,0); let fecha=new Date(hoy);
  if(texto.includes('mañana') &&!texto.includes('pasado')) fecha.setDate(hoy.getDate()+1);
  else if(texto.includes('pasado mañana')) fecha.setDate(hoy.getDate()+2);
  else { const dias={lunes:1,martes:2,miercoles:3,miércoles:3,jueves:4,viernes:5,sabado:6,sábado:6,domingo:0}; for(let d in dias){ if(texto.includes(d)){ let diff=(dias[d]-hoy.getDay()+7)%7; if(diff===0) diff=7; fecha.setDate(hoy.getDate()+diff); break; } } }
  let hora=null; const m=texto.match(/(\d{1,2})[:h ]*([0-5][0-9])?/); if(m){ hora=parseInt(m[1]); if(hora<8) hora+=12; if(hora>=H_INI && hora<=H_FIN) fecha.setHours(hora,0,0,0); else hora=null; }
  return {fecha,hora};
}
async function getHuecosLibres(fecha){
  try{
    const calendar=getCalendar(); if(!calendar) return ['10:00','11:00','12:00','17:00','18:00'];
    const ini=new Date(fecha); ini.setHours(H_INI,0,0,0); const fin=new Date(fecha); fin.setHours(H_FIN,0,0,0);
    const res=await calendar.events.list({calendarId:process.env.GOOGLE_CALENDAR_ID, timeMin:ini.toISOString(), timeMax:fin.toISOString(), singleEvents:true});
    const ocupadas=(res.data.items||[]).map(e=>new Date(e.start.dateTime||e.start.date).getHours());
    let libres=[]; for(let h=H_INI;h<=H_FIN;h++) if(!ocupadas.includes(h)) libres.push(h+':00'); return libres.length?libres:['10:00','12:00','17:00','18:00'];
  }catch(e){ return ['10:00','11:00','12:00','17:00','18:00']; }
}

// --- LANDING 2026 PREMIUM CLARA ---
app.get('/', (req,res)=>{
  res.send(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${BUSINESS_NAME} | Reserva online</title>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#FCFBF8;color:#121212;font-family:'Inter',sans-serif}
.top{width:100%;background:#121212;color:#E9D5A8;text-align:center;padding:11px;font-size:10px;letter-spacing:2px;font-weight:700}
.nav{max-width:1280px;margin:0 auto;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}
.nav b{font-family:'Bodoni Moda',serif;font-size:20px;letter-spacing:-.5px;font-weight:400}
.nav b i{font-style:italic}
.nav a{border:1px solid #121212;padding:10px 20px;border-radius:999px;font-size:11px;font-weight:700;text-decoration:none;color:#121212;letter-spacing:.5px}
.hero{max-width:1280px;margin:0 auto;padding:20px 32px 80px;display:grid;grid-template-columns:1.1fr.9fr;gap:40px}
@media(max-width:900px){.hero{grid-template-columns:1fr}}
.left{padding-top:40px}
.kicker{display:inline-block;border:1px solid #E9D5A8;background:#FBF6EB;color:#8A7447;padding:6px 12px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:1.2px;margin-bottom:24px}
h1{font-family:'Bodoni Moda',serif;font-size:92px;line-height:.85;letter-spacing:-3px;font-weight:400;color:#121212}
@media(max-width:600px){h1{font-size:62px}}
h1 i{font-style:italic;font-weight:400;color:#C8A97E}
.sub{margin-top:24px;color:#6B6B6B;font-size:17px;line-height:1.6;max-width:440px}
.btns{margin-top:32px;display:flex;gap:12px;flex-wrap:wrap}
.btn-black{background:#121212;color:#fff;padding:18px 28px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;display:inline-flex;align-items:center;gap:10px}
.btn-line{border:1px solid #D9D9D9;padding:18px 28px;border-radius:999px;text-decoration:none;color:#121212;font-weight:700;font-size:13px}
.stats{margin-top:50px;display:flex;gap:40px;border-top:1px solid #EDE8E1;padding-top:20px;max-width:440px}
.stats b{font-family:'Bodoni Moda',serif;font-size:28px;display:block}
.stats span{font-size:10px;letter-spacing:1px;color:#9A9A9A;font-weight:700}
.card{position:relative;background:#fff;border:1px solid #EDE8E1;border-radius:24px;padding:8px;box-shadow:0 30px 60px rgba(0,0,0,.08)}
.card-inner{border-radius:18px;overflow:hidden;background:#F6F3EE}
.card-top{padding:14px 16px;background:#fff;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #F0EDE8}
.card-top div{font-size:12px;font-weight:700;display:flex;align-items:center;gap:8px}
.dot{width:8px;height:8px;background:#22c55e;border-radius:50%}
.chat{padding:20px;display:flex;flex-direction:column;gap:12px;background:#FDFCFB}
.b{padding:12px 16px;border-radius:18px;font-size:13.5px;line-height:1.5;max-width:85%}
.b.bot{background:#fff;border:1px solid #EDE8E1;border-radius:18px 18px 18px 4px;color:#3a3a3a}
.b.me{align-self:flex-end;background:#121212;color:#fff;border-radius:18px 18px 4px 18px;font-weight:500}
.b.me small{display:block;text-align:right;opacity:.5;font-size:10px;margin-top:4px}
.addr{margin-top:8px;background:#fff;border:1px dashed #E9D5A8;padding:12px 14px;border-radius:12px;font-size:12px;color:#6B6B6B}
.addr b{color:#121212}
</style></head><body>
<div class="top">NUEVO • RESERVAS AUTOMÁTICAS POR WHATSAPP 24/7 • CONECTADO A GOOGLE CALENDAR</div>
<div class="nav"><b>MAKI <i>BOT</i></b><a href="https://wa.me/${WHATSAPP_NUMBER}">RESERVAR CITA</a></div>
<div class="hero">
  <div class="left">
    <div class="kicker">SISTEMA #1 PARA PELUQUERÍAS PREMIUM</div>
    <h1>Tu agenda<br><i>llena, sin<br>perder tiempo.</i></h1>
    <p class="sub">Las clientas de <b>${BUSINESS_NAME}</b> reservan solas por WhatsApp. Pide nombre y apellidos, confirma y guarda en tu calendario con dirección.</p>
    <div class="btns">
      <a class="btn-black" href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20quiero%20cita%20el%20lunes%20a%20las%2014:00">Probar WhatsApp de ${BUSINESS_SHORT} →</a>
      <a class="btn-line" href="#">Ver demo</a>
    </div>
    <div class="stats">
      <div><b>+312</b><span>CITAS / MES</span></div>
      <div><b>0.8s</b><span>RESPUESTA</span></div>
      <div><b>24/7</b><span>ACTIVO</span></div>
    </div>
  </div>
  <div>
    <div class="card">
      <div class="card-inner">
        <div class="card-top"><div><div class="dot"></div> ${BUSINESS_NAME} • WhatsApp</div><div style="color:#9A9A9A">Ahora</div></div>
        <div class="chat">
          <div class="b bot"><b>${BUSINESS_NAME} ✨</b><br>Bienvenida. ¿Para qué día te gustaría reservar?</div>
          <div class="b me">Hola quiero cita el lunes a las 14:00 <small>0:24 ✓✓</small></div>
          <div class="b bot">Perfecto, tengo el lunes 31 de agosto a las 14:00 libre ✨<br><br>¿A nombre de quién te reservo? Necesito nombre y apellido.</div>
          <div class="b me">Ana García <small>0:24 ✓✓</small></div>
          <div class="b bot">Reservado ✨<br><br><b>📅 Lunes 31 ago, 14:00</b><br><b>👤 Ana García</b><br><br><div class="addr">📍 <b>${BUSINESS_ADDRESS}</b><br>Te esperamos.</div></div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>
`);
});

app.get('/health',(req,res)=>res.send('OK'));

// --- BOT ARREGLADO - YA NO ES SUBNORMAL ---
app.post('/whatsapp', async (req,res)=>{
  const from=req.body.From; const raw=(req.body.Body||"").trim(); const body=raw.toLowerCase();
  if(!sesiones[from]) sesiones[from]={estado:'inicio'};
  const ses=sesiones[from];
  let reply="";

  try{
    const {fecha,hora}=parseFechaHora(raw);
    const tieneDia = body.includes('lunes')||body.includes('martes')||body.includes('miércoles')||body.includes('miercoles')||body.includes('jueves')||body.includes('viernes')||body.includes('sábado')||body.includes('sabado')||body.includes('mañana')||body.includes('hoy')||body.includes('domingo');
    const tieneHora = hora!==null;

    // 1. SI DICE FECHA Y HORA AUNQUE EMPIECE POR HOLA -> RESERVA DIRECTO
    if(tieneDia || tieneHora){
      ses.fecha=fecha; ses.hora=hora;
      const libres=await getHuecosLibres(fecha);
      const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});

      if(tieneHora){
        const hStr=hora+':00';
        if(!libres.includes(hStr)){
          reply=`Para el ${diaTxt} a las ${hStr} ya lo tengo completo.

Tengo libre: ${libres.join(', ')}

¿Qué hora te va mejor?`;
          ses.estado='pidiendo_hora';
        } else {
          ses.estado='pidiendo_nombre';
          reply=`Perfecto, tengo el ${diaTxt} a las ${hStr} libre ${EMOJI}

¿A nombre de quién te reservo? Necesito nombre y apellido.`;
        }
      } else {
        ses.estado='pidiendo_hora';
        reply=`Perfecto, ${diaTxt} ${EMOJI}

Tengo libre: ${libres.join(', ')}

¿Qué hora te viene bien?`;
      }
    }
    // 2. SOLO SALUDO, SIN FECHA
    else if(ses.estado==='inicio' || body.match(/^(hola|buenas|hello|ola|hey)$/)){
      ses.estado='pidiendo_fecha';
      reply=`${BUSINESS_NAME} ${EMOJI}

Bienvenida.

¿Para qué día te gustaría reservar?`;
    }
    // 3. PIDIENDO HORA
    else if(ses.estado==='pidiendo_hora'){
      if(hora===null){
        const libres=await getHuecosLibres(ses.fecha);
        reply=`Dime una hora entre ${libres.join(', ')} y te la guardo.`;
      } else {
        ses.fecha.setHours(hora,0,0,0); ses.hora=hora;
        const libres=await getHuecosLibres(ses.fecha);
        if(!libres.includes(hora+':00')){
          reply=`Esa hora ya está ocupada. Me queda: ${libres.join(', ')}`;
        } else {
          ses.estado='pidiendo_nombre';
          reply=`Genial, ${ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})} a las ${hora}:00 ${EMOJI}

¿A nombre de quién hago la reserva?`;
        }
      }
    }
    // 4. PIDIENDO NOMBRE Y APELLIDO
    else if(ses.estado==='pidiendo_nombre'){
      if(raw.split(' ').length < 2){
        reply=`¿Me dices tu nombre y apellido completo por favor?

Ej: Ana García`;
      } else {
        ses.nombre=raw.trim();
        try{
          const cal=getCalendar();
          if(cal) await cal.events.insert({
            calendarId:process.env.GOOGLE_CALENDAR_ID,
            requestBody:{
              summary:`${ses.nombre} - ${BUSINESS_NAME}`,
              description:`Cliente: ${ses.nombre}\nTel: ${from}\nMaki Bot`,
              start:{dateTime:ses.fecha.toISOString()},
              end:{dateTime:new Date(ses.fecha.getTime()+45*60000).toISOString()},
              location: BUSINESS_ADDRESS
            }
          });
        }catch(e){console.log(e.message)}
        const diaTxt=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
        reply=`Reservado ${EMOJI}

${BUSINESS_NAME}
📅 ${diaTxt}
👤 ${ses.nombre.charAt(0).toUpperCase()+ses.nombre.slice(1)}
📍 ${BUSINESS_ADDRESS}

Te espero. Si necesitas cambiarla, escríbeme por aquí.

Gracias por confiar en ${BUSINESS_NAME}.`;
        delete sesiones[from];
      }
    }
  }catch(e){ console.log(e); reply=`¿Me repites por favor?`; }

  res.set('Content-Type','text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT,()=>console.log('LIVE FINAL '+BUSINESS_NAME));
