const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
require('dotenv').config();
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const sessions = {};

// --- TU LÓGICA DE FECHAS (igual) ---
function getProximoDia(diaSemana) {
  const hoy = new Date();
  const diff = (diaSemana - hoy.getDay() + 7) % 7 || 7;
  const proximo = new Date();
  proximo.setDate(hoy.getDate() + diff);
  proximo.setHours(0,0,0,0);
  return proximo;
}
function formatearFecha(fecha) {
  return fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

// --- FIX ÚNICO: ENTIENDE TODO JUNTO ---
function parseDiaYHora(texto) {
  const t = texto.toLowerCase();
  let fecha = null; let hora = null;
  if (t.includes('lunes')) fecha = getProximoDia(1);
  if (t.includes('martes')) fecha = getProximoDia(2);
  if (t.includes('miercoles') || t.includes('miércoles')) fecha = getProximoDia(3);
  if (t.includes('jueves')) fecha = getProximoDia(4);
  if (t.includes('viernes')) fecha = getProximoDia(5);
  if (t.includes('sabado') || t.includes('sábado')) fecha = getProximoDia(6);
  if (t.includes('domingo')) fecha = getProximoDia(0);

  if (t.includes('10')) hora = 10;
  if (t.includes('11')) hora = 11;
  if (t.includes('12')) hora = 12;
  if (t.includes('13') || t.includes('a la una')) hora = 13;
  if (t.includes('14') || t.includes('a las dos') || t.includes(' las 2')) hora = 14;
  if (t.includes('15') || t.includes('a las tres') || t.includes(' las 3')) hora = 15;
  if (t.includes('16') || t.includes('a las cuatro') || t.includes(' las 4')) hora = 16;
  if (t.includes('17') || t.includes('a las cinco') || t.includes(' las 5')) hora = 17;
  if (t.includes('18') || t.includes('a las seis') || t.includes(' las 6')) hora = 18;
  if (t.includes('19') || t.includes('a las siete') || t.includes(' las 7')) hora = 19;

  // Fix bug que ponía 15:00 cuando era 13:00
  if (t.match(/\ba la una\b/)) hora = 13;

  return { fecha, hora };
}

async function guardarEnCalendar(fecha, nombre) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const inicio = new Date(fecha); const fin = new Date(fecha);
    fin.setHours(fin.getHours() + 1);
    await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID,
      requestBody: { summary: `Cita: ${nombre}`, start: { dateTime: inicio.toISOString() }, end: { dateTime: fin.toISOString() } }
    });
  } catch (e) { console.log(e.message); }
}

app.post('/whatsapp', async (req, res) => {
  const from = req.body.From; const msg = (req.body.Body || '').trim();
  if (!sessions[from]) sessions[from] = { estado: 'inicio', fecha: null };
  const session = sessions[from]; let respuesta = '';
  const { fecha, hora } = parseDiaYHora(msg);

  if (/hola|buenas|quiero cita/i.test(msg) &&!fecha) {
    session.estado = 'pidiendo_dia';
    respuesta = `Hola, bienvenida a Peluquería Carmen ✨\n\nSoy Maki, tu asistente de reservas premium.\n\n¿Para qué día te gustaría reservar tu cita?`;
  } else if (fecha && hora) {
    session.fecha = fecha; session.fecha.setHours(hora, 0, 0, 0);
    session.estado = 'pidiendo_nombre';
    respuesta = `¡Perfecto! Tengo el ${formatearFecha(session.fecha)} a las ${hora}:00 ✨\n\n¿A nombre de quién hago la reserva? Por favor, nombre y apellidos.`;
  } else if (fecha) {
    session.fecha = fecha; session.estado = 'pidiendo_hora';
    respuesta = `¡Genial! Para el ${formatearFecha(session.fecha)} ✨\n\nTengo estos horarios:\n\n• 10:00 • 11:00 • 12:00 • 13:00 • 14:00 • 15:00 • 16:00 • 17:00 • 18:00 • 19:00\n\n¿Qué hora te viene mejor?`;
  } else if (session.estado === 'pidiendo_hora' && hora!== null) {
    session.fecha.setHours(hora, 0, 0, 0); session.estado = 'pidiendo_nombre';
    respuesta = `Perfecto ✨ He bloqueado el ${formatearFecha(session.fecha)} a las ${hora}:00.\n\n¿A nombre de quién hago la reserva?`;
  } else if (session.estado === 'pidiendo_nombre') {
    const nombre = msg; const fechaFinal = session.fecha; const horaFinal = fechaFinal.getHours();
    guardarEnCalendar(fechaFinal, nombre);
    respuesta = `¡Reservado, ${nombre.split(' ')[0]}! ✨\n\nTu cita confirmada:\n📅 ${formatearFecha(fechaFinal)}, ${horaFinal}:00\n👤 ${nombre}\n📍 Peluquería Carmen`;
    sessions[from] = { estado: 'inicio', fecha: null };
  } else {
    if (session.estado === 'pidiendo_hora') {
      respuesta = `Dime qué hora te viene mejor del ${formatearFecha(session.fecha)} ✨\nTengo: 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00`;
    } else {
      respuesta = `¡Hola! Soy Maki ✨ ¿Para qué día quieres tu cita?`;
      session.estado = 'pidiendo_dia';
    }
  }
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

// --- TU DISEÑO LILA ORO V5 - NO TOCADO ---
app.get('/', (req,res)=>{
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Peluquería Carmen | Maki Bot Premium</title>
<style>
body{margin:0;font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#f3e8ff,#e9d5ff,#d8b4fe);min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:white;border-radius:24px;padding:40px;max-width:500px;box-shadow:0 20px 60px rgba(107,33,168,0.2);border:2px solid #d4af37;text-align:center}
h1{color:#6b21a8;font-size:32px}.gold{color:#d4af37}.badge{background:#6b21a8;color:white;padding:8px 16px;border-radius:20px;font-size:12px}
</style>
</head>
<body>
<div class="card">
<div class="badge">✨ ASISTENTE PREMIUM 24/7 ✨</div>
<h1>Peluquería Carmen <span class="gold">✨</span></h1>
<p><strong>Maki</strong> - Tu asistente de reservas inteligente</p>
<p>Bot activo en <code>/whatsapp</code> - 100% operativo</p>
<p style="font-size:12px;color:#888;margin-top:20px">V5.3 PRO - Lila Oro Edition</p>
</div>
</body>
</html>
`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log('Servidor en', PORT));
