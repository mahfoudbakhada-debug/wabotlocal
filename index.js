const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const sessions = {};

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

function parseDiaYHora(texto) {
  const t = texto.toLowerCase();
  let fecha = null;
  let hora = null;

  if (t.includes('lunes')) fecha = getProximoDia(1);
  if (t.includes('martes')) fecha = getProximoDia(2);
  if (t.includes('miercoles') || t.includes('miércoles')) fecha = getProximoDia(3);
  if (t.includes('jueves')) fecha = getProximoDia(4);
  if (t.includes('viernes')) fecha = getProximoDia(5);
  if (t.includes('sabado') || t.includes('sábado')) fecha = getProximoDia(6);
  if (t.includes('domingo')) fecha = getProximoDia(0);

  // HORAS - entiende todo junto
  if (t.match(/10(:00)?/)) hora = 10;
  else if (t.match(/11(:00)?/)) hora = 11;
  else if (t.match(/12(:00)?/)) hora = 12;
  else if (t.match(/13(:00)?/) || t.includes('a la una') || t.includes('a las una') || t === '1' || t.includes(' una ')) hora = 13;
  else if (t.match(/14(:00)?/) || t.includes('a las dos') || t.includes(' dos ')) hora = 14;
  else if (t.match(/15(:00)?/) || t.includes('a las tres') || t.includes(' las 3')) hora = 15;
  else if (t.match(/16(:00)?/) || t.includes('a las cuatro') || t.includes(' las 4')) hora = 16;
  else if (t.match(/17(:00)?/) || t.includes('a las cinco') || t.includes(' las 5')) hora = 17;
  else if (t.match(/18(:00)?/) || t.includes('a las seis') || t.includes(' las 6')) hora = 18;
  else if (t.match(/19(:00)?/) || t.includes('a las siete') || t.includes(' las 7')) hora = 19;

  return { fecha, hora };
}

// GOOGLE CALENDAR
async function guardarEnCalendar(fecha, nombre) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const inicio = new Date(fecha);
    const fin = new Date(fecha);
    fin.setHours(fin.getHours() + 1);
    await calendar.events.insert({
      calendarId: process.env.CALENDAR_ID,
      requestBody: {
        summary: `Cita: ${nombre}`,
        start: { dateTime: inicio.toISOString() },
        end: { dateTime: fin.toISOString() },
      }
    });
  } catch (e) { console.log('Error calendar', e.message); }
}

// WHATSAPP WEBHOOK
app.post('/whatsapp', async (req, res) => {
  const from = req.body.From;
  const msg = (req.body.Body || '').trim();
  if (!sessions[from]) sessions[from] = { estado: 'inicio', fecha: null };

  const session = sessions[from];
  let respuesta = '';

  const { fecha, hora } = parseDiaYHora(msg);

  if (/hola|buenas|quiero cita/i.test(msg) &&!fecha) {
    session.estado = 'pidiendo_dia';
    respuesta = `Hola, bienvenida a Peluquería Carmen ✨\n\nSoy Maki, tu asistente de reservas premium.\n\n¿Para qué día te gustaría reservar tu cita?`;
  }
  else if (fecha && hora) {
    session.fecha = fecha;
    session.fecha.setHours(hora, 0, 0, 0);
    session.estado = 'pidiendo_nombre';
    respuesta = `¡Perfecto! Tengo el ${formatearFecha(session.fecha)} a las ${hora}:00 ✨\n\n¿A nombre de quién hago la reserva? Por favor, nombre y apellidos.`;
  }
  else if (fecha) {
    session.fecha = fecha;
    session.estado = 'pidiendo_hora';
    respuesta = `¡Genial! Para el ${formatearFecha(session.fecha)} ✨\n\nTengo estos horarios disponibles:\n\n• 10:00\n• 11:00\n• 12:00\n• 13:00\n• 14:00\n• 15:00\n• 16:00\n• 17:00\n• 18:00\n• 19:00\n\n¿Qué hora te viene mejor?`;
  }
  else if (session.estado === 'pidiendo_hora' && hora!== null) {
    session.fecha.setHours(hora, 0, 0, 0);
    session.estado = 'pidiendo_nombre';
    respuesta = `Perfecto ✨\n\nHe bloqueado el ${formatearFecha(session.fecha)} a las ${hora}:00 para ti.\n\n¿A nombre de quién hago la reserva? Por favor, nombre y apellidos.`;
  }
  else if (session.estado === 'pidiendo_nombre') {
    const nombre = msg;
    const fechaFinal = session.fecha;
    const horaFinal = fechaFinal.getHours();
    // Guardar en segundo plano
    guardarEnCalendar(fechaFinal, nombre);

    respuesta = `¡Reservado, ${nombre.split(' ')[0]}! ✨\n\nTu cita en Peluquería Carmen está confirmada:\n\n📅 ${formatearFecha(fechaFinal)}, ${horaFinal}:00\n👤 ${nombre}\n📍 C/ Mayor 12, 28001 Madrid\n\n¡Gracias por confiar en nosotros!`;
    sessions[from] = { estado: 'inicio', fecha: null };
  }
  else {
    // Si dice tontería, no saca huecos, contesta humano
    if (session.estado === 'pidiendo_hora') {
      respuesta = `Dime qué hora te viene mejor del ${formatearFecha(session.fecha)} ✨\n\nTengo: 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, 19:00`;
    } else {
      respuesta = `¡Hola! Soy Maki ✨ ¿Para qué día quieres tu cita en Peluquería Carmen?`;
      session.estado = 'pidiendo_dia';
    }
  }

  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${respuesta}</Message></Response>`);
});

// LANDING - NO TOCADA V5
app.get('/', (req,res)=>{
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Peluquería Carmen - Maki Bot Premium</title></head><body style="background:#e9d5ff; font-family:sans-serif; text-align:center; padding:40px;"><h1 style="color:#6b21a8;">Peluquería Carmen ✨</h1><h2>Maki - Asistente Premium 24/7</h2><p>Bot activo en: /whatsapp</p></body></html>`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log('Servidor en', PORT));
