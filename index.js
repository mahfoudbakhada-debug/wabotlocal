const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

const CALENDAR_ID = 'd4e0154eadbb84f04f3a38d2cb52859e0496706c42b1eee72f06d6cd1eec524a@group.calendar.google.com';
const NOMBRE_PELU = 'Peluquería Carmen';

function getAuth() {
  const b64 = (process.env.GOOGLE_CREDS_B64 || '').trim();
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
}
function parseFecha(texto) {
  texto = texto.toLowerCase();
  const ahora = new Date(); let fecha = new Date(); fecha.setSeconds(0,0);
  if (texto.includes('pasado mañana')) fecha.setDate(ahora.getDate()+2);
  else if (texto.includes('mañana')) fecha.setDate(ahora.getDate()+1);
  else {
    const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    for(let i=0;i<dias.length;i++){ if(texto.includes(dias[i])){ let diff=i-ahora.getDay(); if(diff<=0) diff+=7; fecha.setDate(ahora.getDate()+diff); break; } }
  }
  const m = texto.match(/(\d{1,2})[:h](\d{2})?/); if(!m) return null;
  fecha.setHours(parseInt(m[1]), m[2]?parseInt(m[2]):0, 0, 0); return fecha;
}

app.post('/whatsapp', async (req,res)=>{
  try {
    const msg = (req.body.Body || '').trim().toLowerCase();
    const fechaInicio = parseFecha(msg);

    // MENSAJES BONITOS
    if(!fechaInicio){
      if(msg.includes('hola') || msg.includes('precio') || msg.includes('servicio') || msg.includes('corte')){
        return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola guapa! Soy Maki, tu asistente virtual de ${NOMBRE_PELU} 💈✨

💇‍♀️ *Servicios:*
• Corte - 15€
• Corte + Peinado - 22€
• Tinte - 35€
• Mechas - 55€

📍 Estamos en Calle Mayor, 12 - Horario L-S 10:00 a 20:00

Para reservar, solo dime: *"Lunes a las 17:00"* o *"Mañana a las 11h"* 💖
</Message></Response>`);
      }
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki de ${NOMBRE_PELU} 💈✨

Dime qué día y hora te viene bien y te reservo al instante.

Ej: "Martes a las 18:00" o "Mañana a las 11h" 😊
</Message></Response>`);
    }

    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    const h = fechaInicio.getHours(); const d = fechaInicio.getDay();
    if(d===0 || h<10 || h>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Uy! Ese día/hora estamos cerrados 🙈

⏰ Horario: Lunes a Sábado de 10:00 a 20:00

¿Te viene bien el Lunes a las 11:00 o a las 17:00? 💖</Message></Response>`);
    }

    const auth = await getAuth(); const calendar = google.calendar({version:'v3', auth});
    try{ await calendar.calendarList.insert({ requestBody: { id: CALENDAR_ID } }); }catch(e){}

    const check = await calendar.events.list({ calendarId: CALENDAR_ID, timeMin: fechaInicio.toISOString(), timeMax: fechaFin.toISOString(), singleEvents: true });
    if(check.data.items?.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Vaya! Esa hora ya está cogida a las ${h}:00 🥲

Pero tengo libre a las ${h+1}:00 o a las ${h+2}:00 el mismo día. ¿Te reservo? 💇‍♀️</Message></Response>`);
    }

    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody:{
        summary: `💈 Cita - ${req.body.From}`,
        description: `Reserva WhatsApp: ${req.body.Body}`,
        start:{dateTime: fechaInicio.toISOString(), timeZone:'Europe/Madrid'},
        end:{dateTime: fechaFin.toISOString(), timeZone:'Europe/Madrid'}
      }
    });

    const bonito = fechaInicio.toLocaleString('es-ES',{weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Perfecto, reservado! ✅💖

💈 *${NOMBRE_PELU}*
📅 *${bonito}*
📍 Calle Mayor, 12

Te esperamos con muchas ganas ✨ Si no puedes venir, avísanos por aquí.

¡Gracias por confiar en nosotras! 💇‍♀️💖</Message></Response>`);

  } catch(e){
    console.error(e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Uy, he tenido un mini error técnico 🙈 Prueba de nuevo en 1 min con "Lunes 17:00"</Message></Response>`);
  }
});
app.get('/', (req,res)=>res.send('Maki Bot Live'));
app.listen(process.env.PORT||10000, ()=>console.log('Live'));
