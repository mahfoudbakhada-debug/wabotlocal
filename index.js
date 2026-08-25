const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

function getAuth() {
  const b64 = process.env.GOOGLE_CREDS_B64;
  const creds = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
}

function parseFecha(texto) {
  texto = texto.toLowerCase();
  const ahora = new Date();
  let fecha = new Date(); fecha.setSeconds(0,0);

  if (texto.includes('pasado mañana')) fecha.setDate(ahora.getDate()+2);
  else if (texto.includes('mañana')) fecha.setDate(ahora.getDate()+1);
  else {
    const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    for(let i=0;i<dias.length;i++){
      if(texto.includes(dias[i])){
        let diff = i - ahora.getDay();
        if(diff <= 0) diff += 7;
        fecha.setDate(ahora.getDate()+diff);
        break;
      }
    }
  }
  const m = texto.match(/(\d{1,2})[:h](\d{2})?/);
  if(!m) return null;
  fecha.setHours(parseInt(m[1]), m[2]?parseInt(m[2]):0, 0, 0);
  return fecha;
}

app.post('/whatsapp', async (req,res)=>{
  try {
    const msg = req.body.Body || '';
    const fechaInicio = parseFecha(msg);

    if(!fechaInicio) {
      return res.set('Content-Type','text/xml').send(`<Response><Message>¡Hola! Soy Maki, tu asistente de Peluquería Carmen 💈✨

Encantada de ayudarte a reservar.

Dime por favor qué día y hora te viene bien, por ejemplo:
• "Mañana a las 17:00"
• "El lunes a las 11h"
• "Viernes a las 18:30"

Te confirmo al instante. Nuestro horario es de Lunes a Sábado de 10:00 a 20:00.</Message></Response>`);
    }

    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    const hora = fechaInicio.getHours();
    const dia = fechaInicio.getDay();

    if(dia===0 || hora<10 || hora>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Gracias por tu mensaje 😊

En ese horario tenemos el salón cerrado. Nuestro horario de atención es de Lunes a Sábado de 10:00 a 20:00.

¿Te podría venir bien a las 17:00 o a las 11:00 del mismo día? Dime otra hora y te lo miro enseguida 💈</Message></Response>`);
    }

    const auth = await getAuth();
    const calendar = google.calendar({version:'v3', auth});
    const calendarId = process.env.GOOGLE_CALENDAR_ID;

    const busy = await calendar.freebusy.query({
      requestBody:{
        timeMin: fechaInicio.toISOString(),
        timeMax: fechaFin.toISOString(),
        items:[{id: calendarId}]
      }
    });

    if(busy.data.calendars[calendarId].busy.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Vaya, esa hora ya la tenemos reservada y me encantaría atenderte 🥲

¿Te podría encajar a las ${hora+1}:00 el mismo día? Si no, dime otra hora que te venga mejor y te confirmo disponibilidad al momento.</Message></Response>`);
    }

    await calendar.events.insert({
      calendarId,
      requestBody:{
        summary: `Cita - ${req.body.From}`,
        description: `Cliente: ${req.body.From} - Mensaje: ${msg}`,
        start:{dateTime: fechaInicio.toISOString(), timeZone:'Europe/Madrid'},
        end:{dateTime: fechaFin.toISOString(), timeZone:'Europe/Madrid'}
      }
    });

    const bonito = fechaInicio.toLocaleString('es-ES',{weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});

    return res.set('Content-Type','text/xml').send(`<Response><Message>¡Perfecto! Reserva confirmada ✅💈

Te esperamos el *${bonito}* en Peluquería Carmen.

Hemos reservado 1 hora para ti. Si necesitas cambiar o cancelar, solo avísanos por aquí.

¡Muchas gracias por confiar en nosotros! ✨</Message></Response>`);

  } catch(e){
    console.error('ERROR:', e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Disculpa, hemos tenido un pequeño problema técnico 🙏 ¿Me podrías repetir el día y la hora que te interesa? Ej: "Lunes a las 17:00"</Message></Response>`);
  }
});

app.get('/', (req,res)=>res.send('Maki Bot Live Profesional'));
app.listen(process.env.PORT||10000, ()=>console.log('Maki Bot Live'));
