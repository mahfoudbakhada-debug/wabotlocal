// MAKI BOT - V10 FINAL TWILIO TESTEO
const express = require('express');
const { google } = require('googleapis');
const app = express();

// Twilio manda urlencoded, no json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;
const NUMERO_TWILIO = "14155238886"; // Numero de prueba de Twilio

function getGoogleCreds() {
  if (process.env.GOOGLE_CREDENTIALS) return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  if (process.env.GOOGLE_CREDS_B64) {
    const decoded = Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }
  throw new Error("No creds");
}

function getCalendarClient() {
  const credentials = getGoogleCreds();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  return google.calendar({ version: 'v3', auth });
}

function getCalendarioPorEleccion(eleccion) {
  if (eleccion == '2') return { id: process.env.CALENDAR_LOLA_ID, nombre: 'Lola 💅' };
  const idCarmen = process.env.GOOGLE_CALENDAR_ID || process.env.CALENDAR_CARMEN_ID || process.env.CALENDAR_ID;
  return { id: idCarmen, nombre: 'Carmen 💇‍♀️' };
}

// --- LANDING NEGRA CON BOTON A TWILIO ---
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Peluquería Carmen - Testeo</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap');
body{margin:0;background:#050505;color:#fff;font-family:system-ui}
.top{background:linear-gradient(90deg,#C8A97E,#E9D5A8);color:#000;text-align:center;padding:10px;font-weight:900;font-size:11px}
.wrap{max-width:480px;margin:0 auto;padding:24px}
.logo{display:flex;align-items:center;gap:10px;font-weight:900} .logo i{background:#C8A97E;color:#000;width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-style:normal;font-size:20px}
h1{font-family:'Instrument Serif',serif;font-size:52px;line-height:.9;margin:20px 0 0;font-weight:400} h1 b{color:#C8A97E}
.btn{display:block;background:linear-gradient(90deg,#C8A97E,#E9D5A8);color:#000;text-align:center;padding:20px;border-radius:999px;font-weight:900;text-decoration:none;font-size:16px;margin-top:30px}
.code{background:#111;border:1px solid #222;padding:14px;border-radius:12px;margin-top:20px;font-size:13px;color:#aaa}
</style></head><body>
<div class="top">MODO TESTEO - MAKI BOT</div>
<div class="wrap">
<div class="logo"><i>M</i> MAKI BOT TEST</div>
<h1>Bot en <b>modo prueba</b></h1>
<div class="code">1. Manda WhatsApp a +${NUMERO_TWILIO} con:<br><b style="color:#fff">join &lt;tu-palabra&gt;</b><br><br>2. Luego pulsa el botón:</div>
<a class="btn" href="https://wa.me/${NUMERO_TWILIO}?text=Hola%20quiero%20cita">💬 Probar Bot (Twilio) →</a>
<p style="color:#666;font-size:12px;text-align:center;margin-top:20px">Solo contesta a los que hicieron el join. Para testeo interno.</p>
</div></body></html>`);
});

app.get('/health', (req,res)=> res.send('OK'));

// --- ESTE ES EL QUE HACE QUE CONTESTE TWILIO ---
app.post('/whatsapp', (req, res) => {
  const mensaje = (req.body.Body || "").trim().toLowerCase();
  console.log("Mensaje recibido de Twilio:", mensaje);

  let respuesta = "";
  
  if (mensaje.includes('hola') || mensaje.includes('cita') || mensaje == '1' || mensaje == '2') {
    if (mensaje == '1' || mensaje == '2') {
      const cal = getCalendarioPorEleccion(mensaje);
      respuesta = `Perfecto ✅ Has elegido a ${cal.nombre}.\n\nDime qué día quieres venir (ej: mañana a las 10) y te lo guardo en su calendario.`;
    } else {
      respuesta = `¡Hola! 👋 Soy el asistente de Peluquería Carmen.\n\n¿Con quién quieres reservar?\n*1.* Carmen - Peluquería 💇‍♀️\n*2.* Lola - Uñas 💅\n\nResponde con 1 o 2`;
    }
  } else {
    respuesta = `No te he entendido. Escribe *1* para Carmen o *2* para Lola`;
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

app.listen(PORT, () => console.log('MAKI TWILIO LIVE en ' + PORT));
