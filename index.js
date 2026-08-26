const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT || 10000;

// CONFIG - CAMBIA SOLO EN RENDER -> ENVIRONMENT
const BUSINESS_NAME = process.env.BUSINESS_NAME || "Peluquería Carmen";
const BUSINESS_SHORT = process.env.BUSINESS_SHORT || "Carmen"; // Para el botón
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "14155238886";

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MAKI BOT - ${BUSINESS_NAME}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080808;color:#fff;font-family:'Inter',system-ui;overflow-x:hidden}
.topbar{background:linear-gradient(90deg,#C8A97E 0%,#E9D5A8 50%,#C8A97E 100%);color:#000;text-align:center;padding:12px 16px;font-weight:900;font-size:12px;letter-spacing:1.2px;line-height:1.3}
.wrap{max-width:540px;margin:0 auto;padding:18px 20px 40px}
.header{display:flex;align-items:center;justify-content:space-between;margin-top:12px}
.logo{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:1px;font-size:22px}
.logo i{width:44px;height:44px;background:linear-gradient(180deg,#E9D5A8,#C8A97E);color:#000;display:grid;place-items:center;border-radius:12px;font-style:normal;font-weight:900;font-size:22px}
.logo span{color:#C8A97E}
.btn-demo{background:#131313;border:1px solid #2a2a2a;color:#fff;padding:12px 18px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.8px;text-decoration:none}
.pill{margin:48px 0 24px;display:inline-block;border:1px solid rgba(200,169,126,.35);background:rgba(200,169,126,.08);color:#C8A97E;border-radius:999px;padding:10px 18px;font-size:11px;font-weight:700;letter-spacing:1.2px}
h1{font-family:'Instrument Serif',serif;font-weight:400;font-size:68px;line-height:0.85;letter-spacing:-1px}
h1 .gold{color:#C8A97E;color:#D7BE8D;background:linear-gradient(180deg,#E9D5A8,#C8A97E);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{margin-top:28px;color:#8a8a8a;font-size:18px;line-height:1.5}
.sub b{color:#fff;font-weight:700}
.cta{margin-top:32px;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;background:linear-gradient(90deg,#C8A97E,#E9D5A8);color:#000;padding:22px;border-radius:999px;font-weight:900;font-size:18px;text-decoration:none;box-shadow:0 12px 30px rgba(200,169,126,.25)}
@media(max-width:380px){h1{font-size:54px}}
</style>
</head>
<body>
<div class="topbar">MAKI BOT • SISTEMA DE RESERVAS AUTOMÁTICO<br>PARA NEGOCIOS PREMIUM</div>
<div class="wrap">
  <div class="header">
    <div class="logo"><i>M</i> MAKI <span>BOT</span></div>
    <a class="btn-demo" href="#demo">VER DEMO EN VIVO</a>
  </div>
  <div class="pill">SISTEMA #1 PARA PELUQUERÍAS PREMIUM</div>
  <h1>Tu peluquería<br><span class="gold">no pierda ni<br>una cita<br>más.</span></h1>
  <p class="sub">Las clientas de <b>${BUSINESS_NAME}</b> reservan solas por WhatsApp 24/7. Tú solo trabajas. Maki Bot vende por ti.</p>
  <a class="cta" href="https://wa.me/${WHATSAPP_NUMBER}?text=Hola%20quiero%20reservar%20en%20${encodeURIComponent(BUSINESS_NAME)}">💬 Probar WhatsApp de &nbsp;${BUSINESS_SHORT} &nbsp;→</a>
</div>
</body>
</html>
  `);
});

app.get('/health', (req,res)=>res.send('OK'));

// BACKEND WHATSAPP (OCULTO, SIN CARTEL FEO)
const sesiones = {};
app.post('/whatsapp', async (req,res)=>{
  const from = req.body.From;
  const body = (req.body.Body || "").toLowerCase();
  let reply = `¡Hola! Soy la asistente de ${BUSINESS_NAME} ${process.env.EMOJI||'💇‍♀️'}\n\nDime qué día y hora quieres y te reservo al instante. Ej: "mañana a las 5"`;
  if(body.includes('hola')||body.includes('cita')||body.includes('reserva')) {
    reply = `¡Hola guapa! 👋 Soy la asistente de ${BUSINESS_NAME}.\n\nDime día y hora y te la guardo. Ej: "viernes 17:30"`;
  }
  res.set('Content-Type','text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT, ()=>console.log('LIVE '+BUSINESS_NAME));
