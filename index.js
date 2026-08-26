const express = require('express');
const { google } = require('googleapis');
const app = express();
app.use(express.urlencoded({ extended: false }));

function getAuth() {
  const b64 = (process.env.GOOGLE_CREDS_B64 || '').trim();
  const jsonStr = Buffer.from(b64, 'base64').toString('utf-8');
  const creds = JSON.parse(jsonStr);
  console.log('SOY EL BOT:', creds.client_email);
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
      return res.set('Content-Type','text/xml').send(`<Response><Message>Hola! Soy Maki 💈 Dime dia y hora: "Lunes a las 17:00"</Message></Response>`);
    }
    const fechaFin = new Date(fechaInicio.getTime()+60*60*1000);
    if(fechaInicio.getDay()===0 || fechaInicio.getHours()<10 || fechaInicio.getHours()>=20){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Cerrado 😊 L-S 10-20h</Message></Response>`);
    }

    const auth = await getAuth();
    const calendar = google.calendar({version:'v3', auth});

    // BUSCA AUTOMATICAMENTE EL CALENDARIO DONDE TIENE PERMISO
    const lista = await calendar.calendarList.list();
    const calConPermiso = lista.data.items.find(c => c.accessRole === 'writer' || c.accessRole === 'owner');

    if(!calConPermiso){
      console.log('No veo ningun calendario con permiso');
      return res.set('Content-Type','text/xml').send(`<Response><Message>No veo ningun calendario compartido conmigo. Soy: ${ (await auth.getCredentials()).client_email }. Agregame ese email al calendario.</Message></Response>`);
    }

    const calendarId = calConPermiso.id;
    console.log('Usando calendarId AUTOMATICO:', calendarId);

    const check = await calendar.events.list({
      calendarId,
      timeMin: fechaInicio.toISOString(),
      timeMax: fechaFin.toISOString(),
      singleEvents: true
    });

    if(check.data.items?.length>0){
      return res.set('Content-Type','text/xml').send(`<Response><Message>Ocupado a esa hora, prueba a las ${fechaInicio.getHours()+1}:00</Message></Response>`);
    }

    await calendar.events.insert({
      calendarId,
      requestBody:{
        summary: `Cita - ${req.body.From}`,
        description: msg,
        start:{dateTime: fechaInicio.toISOString(), timeZone:'Europe/Madrid'},
        end:{dateTime: fechaFin.toISOString(), timeZone:'Europe/Madrid'}
      }
    });

    const bonito = fechaInicio.toLocaleString('es-ES',{weekday:'long', hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
    return res.set('Content-Type','text/xml').send(`<Response><Message>Reserva confirmada ✅ ${bonito}</Message></Response>`);

  } catch(e){
    console.error('ERROR REAL:', e.message);
    return res.set('Content-Type','text/xml').send(`<Response><Message>Error: ${e.message}</Message></Response>`);
  }
});

app.get('/', (req,res)=>res.send('Maki Bot Live'));
app.listen(process.env.PORT||10000, ()=>console.log('Live'));
