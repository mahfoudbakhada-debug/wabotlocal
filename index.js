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

app.get('/', (req,res)=>res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${BUSINESS_NAME}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Inter:wght@400;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{background:#070709;color:#fff;font-family:Inter,sans-serif}
.top{background:linear-gradient(90deg,#C8A97E,#E9D5A8,#C8A97E);color:#111;text-align:center;padding:10px;font-weight:900;font-size:10px;letter-spacing:1.4px}
.nav{max-width:1120px;margin:0 auto;padding:22px 24px;display:flex;justify-content:space-between;align-items:center}
.logo{display:flex;gap:12px;align-items:center;font-weight:900}.logo b{width:42px;height:42px;background:#fff;color:#000;border-radius:12px;display:grid;place-items:center}
.logo span{color:#C8A97E}.live{font-size:11px;color:#8a8a8a;border:1px solid #1e1e1e;padding:9px 14px;border-radius:999px}
.hero{max-width:1120px;margin:0 auto;padding:40px 24px;display:grid;grid-template-columns:1.1fr.9fr;gap:40px}@media(max-width:800px){.hero{grid-template-columns:1fr}}
.pill{border:1px solid rgba(200,169,126,.3);background:rgba(200,169,126,.07);color:#D8C19A;padding:8px 14px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:1.2px}
h1{font-family:'Instrument Serif',serif;font-size:82px;line-height:.85;letter-spacing:-1px;font-weight:400}h1 em{font-style:italic;background:linear-gradient(180deg,#FFF8E8,#C8A97E);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{margin-top:18px;color:#8e8e93;font-size:17px;line-height:1.5}.cta{margin-top:28px;display:flex;justify-content:center;background:#fff;color:#000;padding:18px;border-radius:999px;font-weight:800;text-decoration:none}
.mock{background:linear-gradient(180deg,#121214,#0A0A0B);border:1px solid #1e1e20;border-radius:32px;padding:18px}
</style></head><body>
<div class="top">MAKI BOT • RESERVAS AUTOMÁTICAS 24/7 • GOOGLE CALENDAR</div>
<div class="nav"><div class="logo"><b>M</b> MAKI <span>BOT</span></div><div class="live">LIVE • ${BUSINESS_NAME}</div></div>
<div class="hero"><div><div class="pill">SISTEMA #1 PARA NEGOCIOS PREMIUM</div><h1>Tu agenda<br><em>llena sin<br>perder tiempo.</em></h1><p class="sub">Las clientas de <b>${BUSINESS_NAME}</b> reservan solas por WhatsApp. Tú solo trabajas.</p><a class="cta" href="https://wa.me/${WHATSAPP_NUMBER}">💬 Probar WhatsApp de ${BUSINESS_SHORT} →</a><p style="margin-top:14px;color:#555;font-size:12px">📍 ${BUSINESS_ADDRESS}</p></div><div class="mock"><div style="font-size:13px;color:#aaa;line-height:1.6">WhatsApp Preview:<br><br><b style="color:#fff">${BUSINESS_NAME} ✨</b><br>Bienvenida. Para reservar necesito tu nombre completo.<br><br>¿A nombre de quién reservo?<br><br><b style="color:#fff">Lunes a las 14:00 - Ana García</b><br>Reservado ✨ Lunes 31 ago 14:00<br>📍 ${BUSINESS_ADDRESS}</div></div></div>
</body></html>`));

app.get('/health',(req,res)=>res.send('OK'));

// --- BOT PRO CON NOMBRE Y DIRECCIÓN ---
app.post('/whatsapp', async (req,res)=>{
  const from=req.body.From; const raw=(req.body.Body||"").trim(); const body=raw.toLowerCase();
  if(!sesiones[from]) sesiones[from]={estado:'inicio'};

  const ses=sesiones[from];
  let reply="";

  try{
    // INICIO
    if(ses.estado==='inicio' || body.match(/^(hola|buenas|hello|ola|hey)/)){
      ses.estado='pidiendo_fecha'; ses.fecha=null; ses.hora=null; ses.nombre=null;
      reply=`${BUSINESS_NAME} ${EMOJI}

Bienvenida.

¿Para qué día te gustaría reservar?`;
    }
    // TIENE FECHA Y HORA? SI DICE "Lunes a las 14:00"
    else if(!ses.fecha){
      const {fecha,hora}=parseFechaHora(raw);
      ses.fecha=fecha; ses.hora=hora;
      const libres=await getHuecosLibres(fecha);
      const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});

      if(hora!==null){
        const hStr=hora+':00';
        if(!libres.includes(hStr)){
          reply=`Para el ${diaTxt} a las ${hStr} ya lo tengo completo.

Tengo disponible: ${libres.join(', ')}

¿Qué hora te va mejor?`;
        } else {
          ses.estado='pidiendo_nombre';
          reply=`Perfecto, tengo libre el ${diaTxt} a las ${hStr} ${EMOJI}

¿A nombre de quién te reservo? Necesito nombre y apellido.`;
        }
      } else {
        ses.estado='pidiendo_hora';
        reply=`Perfecto, ${diaTxt} ${EMOJI}

Tengo libre: ${libres.join(', ')}

¿Qué hora te viene bien?`;
      }
    }
    // PIDIENDO HORA
    else if(ses.estado==='pidiendo_hora'){
      const {fecha,hora}=parseFechaHora(raw);
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
    // PIDIENDO NOMBRE Y APELLIDO - CLAVE PARA CARMEN
    else if(ses.estado==='pidiendo_nombre'){
      if(raw.split(' ').length < 2 || raw.length < 4){
        reply=`¿Me dices tu nombre y apellido completo por favor?

Ej: Ana García`;
      } else {
        ses.nombre=raw.trim();
        const fecha=ses.fecha;
        // Guardar en calendar con NOMBRE
        try{
          const cal=getCalendar();
          if(cal) await cal.events.insert({
            calendarId:process.env.GOOGLE_CALENDAR_ID,
            requestBody:{
              summary:`${ses.nombre} - ${BUSINESS_NAME}`,
              description:`Cliente: ${ses.nombre}\nTel: ${from}\nReservado por Maki Bot`,
              start:{dateTime:fecha.toISOString()},
              end:{dateTime:new Date(fecha.getTime()+45*60000).toISOString()},
              location: BUSINESS_ADDRESS
            }
          });
        }catch(e){console.log(e.message)}

        const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
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

app.listen(PORT,()=>console.log('LIVE PRO CON NOMBRE '+BUSINESS_NAME));
