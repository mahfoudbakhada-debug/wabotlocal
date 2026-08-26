const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 10000;

const BUSINESS_NAME = process.env.BUSINESS_NAME || "Peluquería Carmen";
const BUSINESS_SHORT = process.env.BUSINESS_SHORT || "Carmen";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "14155238886";
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
  texto = texto.toLowerCase();
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let fecha = new Date(hoy);

  if(texto.includes('mañana') &&!texto.includes('pasado')) fecha.setDate(hoy.getDate()+1);
  else if(texto.includes('pasado mañana')) fecha.setDate(hoy.getDate()+2);
  else {
    const dias = {lunes:1,martes:2,miercoles:3,miércoles:3,jueves:4,viernes:5,sabado:6,sábado:6,domingo:0};
    for(let d in dias){ if(texto.includes(d)){ let diff=(dias[d]-hoy.getDay()+7)%7; if(diff===0) diff=7; fecha.setDate(hoy.getDate()+diff); break; } }
  }
  let hora=null;
  const m=texto.match(/(\d{1,2})[:h ]*([0-5][0-9])?/);
  if(m){
    hora=parseInt(m[1]); if(hora<8) hora+=12;
    if(hora>=H_INI && hora<=H_FIN) fecha.setHours(hora,0,0,0);
    else hora=null;
  }
  return {fecha, hora};
}

async function getHuecosLibres(fecha){
  try{
    const calendar=getCalendar(); if(!calendar) return ['10:00','11:00','12:00','17:00','18:00'];
    const ini=new Date(fecha); ini.setHours(H_INI,0,0,0);
    const fin=new Date(fecha); fin.setHours(H_FIN,0,0,0);
    const res=await calendar.events.list({calendarId:process.env.GOOGLE_CALENDAR_ID, timeMin:ini.toISOString(), timeMax:fin.toISOString(), singleEvents:true});
    const ocupadas=(res.data.items||[]).map(e=>new Date(e.start.dateTime||e.start.date).getHours());
    let libres=[]; for(let h=H_INI;h<=H_FIN;h++) if(!ocupadas.includes(h)) libres.push(h+':00');
    return libres.length?libres:['10:00','12:00','17:00','18:00'];
  }catch(e){ return ['10:00','11:00','12:00','17:00','18:00']; }
}

// --- LANDING 2026 PREMIUM ---
app.get('/', (req,res)=>{
  res.send(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"><title>${BUSINESS_NAME} | Reserva 24/7</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box} body{background:#070709;color:#fff;font-family:'Inter',sans-serif; -webkit-font-smoothing:antialiased}
.top{position:sticky;top:0;z-index:10;background:linear-gradient(90deg,#C8A97E,#E9D5A8,#C8A97E);color:#111;text-align:center;padding:10px 12px;font-weight:900;font-size:10px;letter-spacing:1.6px}
.nav{max-width:1120px;margin:0 auto;padding:22px 24px;display:flex;justify-content:space-between;align-items:center}
.logo{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:.8px}.logo b{width:42px;height:42px;background:#fff;color:#000;border-radius:12px;display:grid;place-items:center;font-size:20px}
.logo span{color:#C8A97E}.live{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;color:#8a8a8a;border:1px solid #1e1e1e;background:#101012;padding:9px 14px;border-radius:999px}.dot{width:7px;height:7px;background:#22c55e;border-radius:50%;box-shadow:0 0 8px #22c55e}
.hero{max-width:1120px;margin:0 auto;padding:30px 24px 0;display:grid;grid-template-columns:1.1fr.9fr;gap:40px} @media(max-width:800px){.hero{grid-template-columns:1fr}}
.pill{display:inline-flex;border:1px solid rgba(200,169,126,.3);background:rgba(200,169,126,.07);color:#D8C19A;padding:8px 14px;border-radius:999px;font-size:10px;letter-spacing:1.4px;font-weight:700;margin-bottom:22px}
h1{font-family:'Instrument Serif',serif;font-size:84px;line-height:.84;letter-spacing:-2px;font-weight:400} @media(max-width:500px){h1{font-size:58px}} h1 em{font-style:italic;background:linear-gradient(180deg,#FFF8E8,#C8A97E);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{margin-top:20px;color:#8e8e93;font-size:18px;line-height:1.5;max-width:460px}.sub b{color:#fff}
.ctas{margin-top:32px;display:flex;gap:14px;flex-wrap:wrap}.cta{flex:1;min-width:220px;display:flex;justify-content:center;align-items:center;gap:10px;background:#fff;color:#000;padding:18px 20px;border-radius:999px;font-weight:800;text-decoration:none;transition:.2s}.cta:hover{transform:translateY(-1px)}.cta.dark{background:#151517;color:#fff;border:1px solid #232326}
.stats{margin-top:42px;display:flex;gap:32px;border-top:1px solid #151517;padding-top:22px}.stats div b{font-size:22px;display:block}.stats div span{font-size:11px;color:#6e6e73;letter-spacing:.8px}
.mock{position:relative;background:radial-gradient(80% 60% at 50% 0%,rgba(200,169,126,.25),transparent),linear-gradient(180deg,#121214,#0A0A0B);border:1px solid #1e1e20;border-radius:32px;padding:18px;box-shadow:0 40px 80px rgba(0,0,0,.6)}.phone{background:#0f0f10;border:1px solid #232326;border-radius:26px;overflow:hidden}.phone-top{padding:14px 16px;display:flex;justify-content:space-between;border-bottom:1px solid #1a1a1e;font-size:12px;font-weight:700}.bub{padding:14px}.bub.m{background:#1a1a1e;color:#d0d0d0;padding:12px 14px;border-radius:18px 18px 18px 4px;margin-bottom:10px;font-size:13.5px;line-height:1.4;max-width:88%}.bub.u{background:#fff;color:#000;padding:12px 14px;border-radius:18px 18px 4px 18px;margin-left:auto;max-width:70%;font-size:13.5px;font-weight:600;margin-bottom:10px}
.footer{margin-top:80px;border-top:1px solid #111;padding:24px;text-align:center;color:#3a3a3e;font-size:11px;letter-spacing:1px}
</style></head><body>
<div class="top">MAKI BOT • SISTEMA #1 DE RESERVAS AUTOMÁTICAS • CONECTADO A GOOGLE CALENDAR</div>
<div class="nav"><div class="logo"><b>M</b> MAKI <span>BOT</span></div><div class="live"><div class="dot"></div> LIVE • ${BUSINESS_NAME}</div></div>
<div class="hero">
  <div>
    <div class="pill">PARA NEGOCIOS PREMIUM • 2026</div>
    <h1>Tu agenda<br><em>llena mientras<br>duermes.</em></h1>
    <p class="sub">Las clientas de <b>${BUSINESS_NAME}</b> reservan solas por WhatsApp 24/7. Sin llamadas, sin esperas, sin perder ni una cita. Maki Bot lo gestiona todo.</p>
    <div class="ctas">
      <a class="cta" href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20quiero%20reservar%20en%20${encodeURIComponent(BUSINESS_NAME)}">💬 Probar WhatsApp de ${BUSINESS_SHORT} →</a>
      <a class="cta dark" href="#demo">Ver cómo funciona</a>
    </div>
    <div class="stats"><div><b>+247</b><span>CITAS/MES</span></div><div><b>0s</b><span>TIEMPO RESPUESTA</span></div><div><b>24/7</b><span>OPERATIVO</span></div></div>
  </div>
  <div id="demo" class="mock">
    <div class="phone">
      <div class="phone-top"><span>Twilio • ${BUSINESS_SHORT}</span><span>23:42</span></div>
      <div class="bub">
        <div class="m">${BUSINESS_NAME} ${EMOJI}<br><br>Bienvenida.<br><br>¿Para qué día te apetece reservar?</div>
        <div class="u">Lunes a las 14:00</div>
        <div class="m">Reservado ${EMOJI}<br><br>${BUSINESS_NAME}<br>Lunes 31 de agosto, 14:00<br><br>Te espero.</div>
      </div>
    </div>
  </div>
</div>
<div class="footer">© 2026 MAKI BOT • SISTEMA DE RESERVAS PARA ${BUSINESS_NAME.toUpperCase()}</div>
</body></html>
`);
});

app.get('/health',(req,res)=>res.send('OK'));

app.post('/whatsapp', async (req,res)=>{
  const from=req.body.From; const bodyRaw=(req.body.Body||"").trim(); const body=bodyRaw.toLowerCase();
  console.log('IN',from,bodyRaw);
  if(!sesiones[from]) sesiones[from]={};

  let reply="";
  try{
    const {fecha,hora}=parseFechaHora(body);
    const libres=await getHuecosLibres(fecha);
    const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});

    // Si manda día + hora junto: "Lunes a las 14:00" -> RESERVA DIRECTA
    if(hora!==null){
      const hStr=hora+':00';
      if(!libres.includes(hStr)){
        reply=`Ese hueco de ${diaTxt} a las ${hStr} ya está ocupado.

Tengo libre: ${libres.slice(0,5).join(', ')}

¿Te reservo alguna?`;
      } else {
        try{
          const cal=getCalendar();
          if(cal) await cal.events.insert({calendarId:process.env.GOOGLE_CALENDAR_ID, requestBody:{summary:`Cita ${BUSINESS_NAME}`, description:`Cliente ${from}`, start:{dateTime:fecha.toISOString()}, end:{dateTime:new Date(fecha.getTime()+45*60000).toISOString()}}});
        }catch(e){console.log(e.message)}
        reply=`Reservado ${EMOJI}

${BUSINESS_NAME}
${diaTxt}, ${hStr}

Te espero. Si necesitas cambiarla, escríbeme aquí mismo.

Gracias por confiar.`;
        delete sesiones[from];
      }
    }
    else if(body.match(/^(hola|buenas|hey|ola)/) ||!sesiones[from].fecha){
      sesiones[from].fecha=fecha;
      reply=`${BUSINESS_NAME} ${EMOJI}

Bienvenida.

¿Para qué día te apetece reservar?`;
      // Si solo dijo el día, muestra huecos
      if(!body.match(/^(hola|buenas|hey|ola)/)){
        reply=`Perfecto, ${diaTxt} ${EMOJI}

Tengo libre: ${libres.join(', ')}

¿A qué hora te viene bien?`;
      }
    }
    else{
      reply=`${BUSINESS_NAME} ${EMOJI}

Tengo libre el ${diaTxt}: ${libres.join(', ')}

Dime hora y te lo reservo.`;
    }
  }catch(err){
    console.log(err);
    reply=`${BUSINESS_NAME}. ¿Me repites día y hora por favor?`;
  }
  res.set('Content-Type','text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT,()=>console.log('PRO 2026 LIVE '+BUSINESS_NAME));
