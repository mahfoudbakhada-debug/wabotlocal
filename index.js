const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 10000;

const BUSINESS_NAME = process.env.BUSINESS_NAME || "Peluquería Carmen";
const BUSINESS_SHORT = process.env.BUSINESS_SHORT || "Carmen";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "14155238886";

// --- GOOGLE CALENDAR ---
function getGoogleCreds() {
  if (process.env.GOOGLE_CREDENTIALS) return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  if (process.env.GOOGLE_CREDS_B64) return JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8'));
  throw new Error("Faltan creds Google");
}
function getCalendar() {
  const auth = new google.auth.GoogleAuth({ credentials: getGoogleCreds(), scopes: ['https://www.googleapis.com/auth/calendar'] });
  return google.calendar({ version: 'v3', auth });
}

// --- MEMORIA POR CLIENTE ---
const sesiones = {}; // from -> { estado, servicio, fecha, hora }

// --- HORARIO ---
const HORA_INICIO = 9;
const HORA_FIN = 20;

function parseFecha(texto) {
  texto = texto.toLowerCase();
  const hoy = new Date();
  let fecha = new Date();
  if (texto.includes('mañana')) { fecha.setDate(hoy.getDate() + 1); }
  else if (texto.includes('pasado mañana')) { fecha.setDate(hoy.getDate() + 2); }
  else if (texto.includes('lunes')) { fecha.setDate(hoy.getDate() + ((1 - hoy.getDay() + 7) % 7 || 7)); }
  else if (texto.includes('martes')) { fecha.setDate(hoy.getDate() + ((2 - hoy.getDay() + 7) % 7 || 7)); }
  else if (texto.includes('miércoles')||texto.includes('miercoles')) { fecha.setDate(hoy.getDate() + ((3 - hoy.getDay() + 7) % 7 || 7)); }
  else if (texto.includes('jueves')) { fecha.setDate(hoy.getDate() + ((4 - hoy.getDay() + 7) % 7 || 7)); }
  else if (texto.includes('viernes')) { fecha.setDate(hoy.getDate() + ((5 - hoy.getDay() + 7) % 7 || 7)); }
  else if (texto.includes('sábado')||texto.includes('sabado')) { fecha.setDate(hoy.getDate() + ((6 - hoy.getDay() + 7) % 7 || 7)); }

  const matchHora = texto.match(/(\d{1,2})[:h]?\s*([0-5]?[0-9])?/);
  let hora = 11;
  if(matchHora){ hora = parseInt(matchHora[1]); if(hora < 9) hora+=12; }
  fecha.setHours(hora,0,0,0);
  return fecha;
}

async function getHuecosLibres(fecha) {
  try {
    const calendar = getCalendar();
    const inicio = new Date(fecha); inicio.setHours(HORA_INICIO,0,0,0);
    const fin = new Date(fecha); fin.setHours(HORA_FIN,0,0,0);
    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: inicio.toISOString(),
      timeMax: fin.toISOString(),
      singleEvents: true
    });
    const ocupadas = (res.data.items||[]).map(e=>new Date(e.start.dateTime).getHours());
    let libres = [];
    for(let h=HORA_INICIO; h<=HORA_FIN; h++){
      if(!ocupadas.includes(h)) libres.push(h+':00');
    }
    return libres;
  } catch(e){ console.log(e); return ['10:00','11:00','12:00','17:00','18:00']; }
}

// --- LANDING PRO COMO TU FOTO ---
app.get('/', (req,res)=>{
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MAKI BOT - ${BUSINESS_NAME}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap');
*{margin:0;padding:0;box-sizing:border-box}body{background:#080808;color:#fff;font-family:Inter,system-ui}
.top{background:linear-gradient(90deg,#C8A97E,#E9D5A8,#C8A97E);color:#000;text-align:center;padding:12px;font-weight:900;font-size:12px;letter-spacing:1.2px}
.wrap{max-width:540px;margin:0 auto;padding:18px 20px 40px}.head{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.logo{display:flex;gap:12px;align-items:center;font-weight:900;font-size:22px}.logo i{width:44px;height:44px;background:linear-gradient(180deg,#E9D5A8,#C8A97E);color:#000;display:grid;place-items:center;border-radius:12px;font-style:normal;font-weight:900}
.logo span{color:#C8A97E}.btn{border:1px solid #2a2a2a;background:#131313;color:#fff;padding:12px 18px;border-radius:999px;font-size:12px;font-weight:700;text-decoration:none}
.pill{margin:48px 0 24px;display:inline-block;border:1px solid rgba(200,169,126,.35);background:rgba(200,169,126,.08);color:#C8A97E;border-radius:999px;padding:10px 18px;font-size:11px;font-weight:700;letter-spacing:1.2px}
h1{font-family:'Instrument Serif',serif;font-weight:400;font-size:68px;line-height:.85;letter-spacing:-1px}h1.g{background:linear-gradient(180deg,#E9D5A8,#C8A97E);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{margin-top:28px;color:#8a8a8a;font-size:18px;line-height:1.5}.sub b{color:#fff}
.cta{margin-top:32px;display:flex;justify-content:center;align-items:center;gap:10px;width:100%;background:linear-gradient(90deg,#C8A97E,#E9D5A8);color:#000;padding:22px;border-radius:999px;font-weight:900;font-size:18px;text-decoration:none;box-shadow:0 12px 30px rgba(200,169,126,.25)}
</style></head><body>
<div class="top">MAKI BOT • SISTEMA DE RESERVAS AUTOMÁTICO PARA NEGOCIOS PREMIUM</div>
<div class="wrap"><div class="head"><div class="logo"><i>M</i> MAKI <span>BOT</span></div><a class="btn" href="#">VER DEMO EN VIVO</a></div>
<div class="pill">SISTEMA #1 PARA PELUQUERÍAS PREMIUM</div>
<h1>Tu peluquería<br><span class="g">no pierda ni<br>una cita<br>más.</span></h1>
<p class="sub">Las clientas de <b>${BUSINESS_NAME}</b> reservan solas por WhatsApp 24/7. Tú solo trabajas. Maki Bot vende por ti.</p>
<a class="cta" href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20${encodeURIComponent(BUSINESS_NAME)}">💬 Probar WhatsApp de ${BUSINESS_SHORT} →</a>
</div></body></html>`);
});

app.get('/health',(req,res)=>res.send('OK'));

// --- BOT PRO CON MEMORIA ---
app.post('/whatsapp', async (req,res)=>{
  const from = req.body.From;
  const textoOriginal = (req.body.Body||"").trim();
  const texto = textoOriginal.toLowerCase();
  console.log('MSG',from,textoOriginal);

  if(!sesiones[from]) sesiones[from] = { estado: 'inicio' };
  const ses = sesiones[from];
  let reply = "";

  try {
    // 1. SALUDO INICIAL - PRO, CORTO, SIN GUAPA
    if(ses.estado === 'inicio' || texto.match(/^(hola|buenas|hello|hey)/)){
      ses.estado = 'pidiendo_fecha';
      reply = `${BUSINESS_NAME} ✨

Bienvenida.

¿Para qué día te apetece reservar?`;
    }
    // 2. PIDE FECHA Y MIRA HUECOS REALES
    else if(ses.estado === 'pidiendo_fecha'){
      const fecha = parseFecha(texto);
      ses.fecha = fecha;
      const libres = await getHuecosLibres(fecha);
      const dia = fecha.toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'long'});

      if(libres.length === 0){
        reply = `Para el ${dia} estamos completas.

Tengo hueco mañana a las 10:00, 12:00 y 18:00.

¿Te viene bien alguna?`;
      } else {
        ses.estado = 'pidiendo_hora';
        reply = `Perfecto, ${dia} ✨

Tengo libre: ${libres.slice(0,5).join(', ')}

¿A qué hora te reservo?`;
      }
    }
    // 3. CONFIRMA Y GUARDA EN CALENDAR
    else if(ses.estado === 'pidiendo_hora'){
      const fecha = ses.fecha || parseFecha(texto);
      const matchHora = texto.match(/(\d{1,2})/);
      let hora = matchHora? parseInt(matchHora[1]) : 11;
      if(hora < 9) hora+=12;
      fecha.setHours(hora,0,0,0);

      // Guardar en Google Calendar
      try{
        const calendar = getCalendar();
        await calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          requestBody:{
            summary: `Cita ${BUSINESS_NAME} - ${from}`,
            description: `Cliente: ${from}\nReserva por WhatsApp Maki Bot`,
            start:{dateTime:fecha.toISOString()},
            end:{dateTime:new Date(fecha.getTime()+45*60000).toISOString()}
          }
        });
      }catch(e){console.log('Error calendar',e.message)}

      const diaTexto = fecha.toLocaleDateString('es-ES',{weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'});
      reply = `Reservado ✨

${BUSINESS_NAME}
${diaTexto}

Te espero. Si necesitas cambiarla, escríbeme aquí mismo.

Gracias por confiar.`;
      ses.estado = 'completado';
      setTimeout(()=>{ delete sesiones[from]; }, 60000);
    }
    else{
      reply = `${BUSINESS_NAME} ✨

¿Quieres reservar otra cita?

Dime día y hora y te la guardo.`;
      ses.estado = 'pidiendo_fecha';
    }

  } catch(err){
    console.log(err);
    reply = `${BUSINESS_NAME}.

He tenido un pequeño error técnico, ¿me repites día y hora por favor?`;
  }

  res.set('Content-Type','text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT,()=>console.log('MAKI PRO LIVE '+BUSINESS_NAME));
