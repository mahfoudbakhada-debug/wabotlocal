// MAKI BOT - V9 AGENCIA PRO - TODO EN UNO
const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;

// --- CONFIGURACIÓN DE TUS CALENDARIOS ---
const CALENDARIOS = {
  carmen: process.env.GOOGLE_CALENDAR_ID,
  lola: process.env.CALENDAR_LOLA_ID
};
const NUMERO_WHATSAPP = "34TU_NUMERO_AQUI"; // <--- CAMBIA ESTO

// --- GOOGLE CALENDAR ---
function getCalendarClient() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
  return google.calendar({ version: 'v3', auth });
}

// --- LANDING PAGE QUE QUIERES ENSEÑAR (ESTO ES LO QUE VERAN LOS CLIENTES) ---
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Peluquería Carmen - Reserva Automática</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap');
body{margin:0;background:#050505;color:#fff;font-family:system-ui}
.top{background:linear-gradient(90deg,#C8A97E,#E9D5A8);color:#000;text-align:center;padding:10px;font-weight:900;letter-spacing:1.2px;font-size:11px}
.wrap{max-width:480px;margin:0 auto;padding:24px}
.nav{display:flex;justify-content:space-between;align-items:center;margin:20px 0}
.logo{display:flex;align-items:center;gap:10px;font-weight:900;letter-spacing:1px}
.logo i{background:#C8A97E;color:#000;width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:12px;font-style:normal;font-size:20px}
.badge{border:1px solid rgba(200,169,126,.4);color:#C8A97E;border-radius:999px;padding:8px 16px;font-size:10px;letter-spacing:1px;margin:30px 0;display:inline-block}
h1{font-family:'Instrument Serif',serif;font-size:62px;line-height:0.9;font-weight:400;margin:0} h1 b{color:#C8A97E;font-weight:400}
.desc{color:#8a8a8a;font-size:16px;line-height:1.6;margin:24px 0} .desc strong{color:#fff}
.btn{display:block;background:linear-gradient(90deg,#C8A97E,#E9D5A8);color:#000;text-align:center;padding:20px;border-radius:999px;font-weight:900;text-decoration:none;font-size:16px;margin-top:30px}
.status{text-align:center;margin-top:20px;color:#5a5a5a;font-size:12px}
</style>
</head>
<body>
<div class="top">MAKI BOT • SISTEMA DE RESERVAS AUTOMÁTICO PARA NEGOCIOS PREMIUM</div>
<div class="wrap">
  <div class="nav"><div class="logo"><i>M</i> MAKI <span style="color:#C8A97E">BOT</span></div></div>
  <div class="badge">SISTEMA #1 PARA PELUQUERÍAS PREMIUM</div>
  <h1>Tu peluquería<br><b>no pierde ni<br>una cita<br>más.</b></h1>
  <p class="desc">Las clientas de <strong>Peluquería Carmen</strong> reservan solas por WhatsApp 24/7. Tú solo trabajas. Maki Bot vende por ti.</p>
  <a class="btn" href="https://wa.me/${NUMERO_WHATSAPP}?text=Hola%20quiero%20cita">💬 Probar WhatsApp de Carmen →</a>
  <div class="status">● Bot Online - Agencia V9</div>
</div>
</body>
</html>
  `);
});

// Endpoint para que Render sepa que el bot está vivo
app.get('/health', (req, res) => res.send('MAKI BOT AGENCIA V9 Live'));

// --- AQUI TU LOGICA DE WHATSAPP (Baileys) - CON EL MENU 1 y 2 ---
// Esta es la lógica simplificada. Si usas tu lógica actual de wabotlocal, pega tu código de bot aquí abajo.
// Lo importante es que uses esta función para elegir calendario:

function elegirCalendario(mensajeDelCliente) {
  const msg = mensajeDelCliente.trim();
  if (msg === '2') return { id: CALENDARIOS.lola, nombre: 'Lola' };
  return { id: CALENDARIOS.carmen, nombre: 'Carmen' }; // por defecto 1
}

// EJEMPLO DE MENSAJE DE BIENVENIDA QUE TIENES QUE PONER EN TU BOT:
/*
const mensajeBienvenida = `¡Hola! 👋 Soy el asistente de Peluquería Carmen.

¿Con quién quieres reservar?
*1.* Carmen - Peluquería 💇‍♀️
*2.* Lola - Uñas 💅

Responde con 1 o 2`;
*/

// TU CODIGO ACTUAL DEL BOT EMPIEZA AQUI...
// ...

app.listen(PORT, () => console.log('MAKI V9 Live en puerto ' + PORT));
