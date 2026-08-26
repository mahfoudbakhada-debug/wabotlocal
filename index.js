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

function getGoogleCreds() {
  if (process.env.GOOGLE_CREDENTIALS) return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  if (process.env.GOOGLE_CREDS_B64) return JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8'));
  return null;
}
function getCalendar() {
  try {
    const creds = getGoogleCreds(); if(!creds) return null;
    const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
    return google.calendar({ version: 'v3', auth });
  } catch(e){ return null; }
}
const sesiones = {};
const H_INI=9, H_FIN=20;

function parseFechaHora(texto){
  texto = texto.toLowerCase(); const hoy=new Date(); hoy.setHours(0,0,0,0); let fecha=new Date(hoy);
  let encontroDia=false;
  if(texto.includes('mañana') &&!texto.includes('pasado')){ fecha.setDate(hoy.getDate()+1); encontroDia=true; }
  else if(texto.includes('pasado mañana')){ fecha.setDate(hoy.getDate()+2); encontroDia=true; }
  else {
    const dias={lunes:1,martes:2,miercoles:3,miércoles:3,jueves:4,viernes:5,sabado:6,sábado:6,domingo:0};
    for(let d in dias){
      if(texto.includes(d)){
        let diff=(dias[d]-hoy.getDay()+7)%7; if(diff===0) diff=7;
        fecha.setDate(hoy.getDate()+diff); encontroDia=true; break;
      }
    }
    if(texto.includes('hoy')) encontroDia=true;
  }
  let hora=null; const m=texto.match(/(\d{1,2})[:h ]*([0-5][0-9])?/);
  if(m){ hora=parseInt(m[1]); if(hora<8) hora+=12; if(hora>=H_INI && hora<=H_FIN) fecha.setHours(hora,0,0,0); else hora=null; }
  return {fecha,hora,encontroDia};
}
async function getHuecosLibres(fecha){
  try{
    const calendar=getCalendar(); if(!calendar) return ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
    const ini=new Date(fecha); ini.setHours(H_INI,0,0,0); const fin=new Date(fecha); fin.setHours(H_FIN,0,0,0);
    const res=await calendar.events.list({calendarId:process.env.GOOGLE_CALENDAR_ID, timeMin:ini.toISOString(), timeMax:fin.toISOString(), singleEvents:true});
    const ocupadas=(res.data.items||[]).map(e=>new Date(e.start.dateTime||e.start.date).getHours());
    let libres=[]; for(let h=H_INI;h<=H_FIN;h++) if(!ocupadas.includes(h)) libres.push(h+':00'); return libres.length?libres:['10:00','12:00','17:00','18:00'];
  }catch(e){ return ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']; }
}
function toLocalMadrid(d){
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function formatHuecosPro(lista){ return lista.map(h => `• ${h}`).join('\n'); }

app.get('/health',(req,res)=>res.send('OK'));
app.get('/', (req,res)=>{
  res.send(`<h1>${BUSINESS_NAME} V5.1 LIVE ${EMOJI}</h1>`);
});

app.post('/whatsapp', async (req,res)=>{
  const from=req.body.From || 'test';
  const raw=(req.body.Body||"").trim();
  const body=raw.toLowerCase();
  if(!sesiones[from]) sesiones[from]={estado:'inicio', fecha:null, hora:null};
  const ses=sesiones[from];
  let reply="";

  try{
    const {fecha, hora, encontroDia} = parseFechaHora(raw);
    const tieneHora = hora!==null;
    const tieneDia = encontroDia;

    console.log('MSG:', body, 'tieneDia', tieneDia, 'hora', hora, 'estado', ses.estado, 'fechaGuardada', ses.fecha);

    if(ses.estado==='pidiendo_nombre'){
      if(raw.split(' ').length < 2){
        reply=`¿Me indicas tu nombre completo por favor? ${EMOJI}\n\nNecesito nombre y apellido para confirmar.\n\nEjemplo: Ana García`;
      } else {
        ses.nombre=raw.trim().split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');
        try{
          const cal=getCalendar();
          if(cal && process.env.GOOGLE_CALENDAR_ID){
            await cal.events.insert({
              calendarId:process.env.GOOGLE_CALENDAR_ID,
              requestBody:{
                summary:`${ses.nombre} - ${BUSINESS_NAME}`,
                description:`Cliente: ${ses.nombre}\nTel: ${from}`,
                start:{dateTime:toLocalMadrid(ses.fecha), timeZone:'Europe/Madrid'},
                end:{dateTime:toLocalMadrid(new Date(ses.fecha.getTime()+45*60000)), timeZone:'Europe/Madrid'},
                location: BUSINESS_ADDRESS
              }
            });
          }
        }catch(e){console.log('CAL ERROR', e.message)}
        const diaTxt=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
        const diaCap = diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
        reply=`¡Reservado, ${ses.nombre.split(' ')[0]}! ${EMOJI}\n\nTu cita en ${BUSINESS_NAME} está confirmada:\n\n📅 ${diaCap}\n👤 ${ses.nombre}\n📍 ${BUSINESS_ADDRESS}\n\n¡Gracias por confiar en nosotros!`;
        delete sesiones[from];
      }
    }
    else if(ses.estado==='pidiendo_hora' && tieneHora &&!tieneDia && ses.fecha){
      // MEMORIA: mantiene el dia que ya dijo antes
      ses.fecha.setHours(hora,0,0,0);
      const libres=await getHuecosLibres(ses.fecha);
      const diaCap = ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
      const diaCap2 = diaCap.charAt(0).toUpperCase()+diaCap.slice(1);
      if(!libres.includes(hora+':00')){
        reply=`Ese hueco ya está reservado para el ${diaCap2} ${EMOJI}\n\nMe quedan disponibles:\n\n${formatHuecosPro(libres)}\n\n¿Cuál prefieres?`;
      } else {
        ses.estado='pidiendo_nombre';
        reply=`Perfecto ${EMOJI}\n\nHe bloqueado el ${diaCap2} a las ${hora}:00 para ti.\n\n¿A nombre de quién hago la reserva? Por favor, nombre y apellidos.`;
      }
    }
    else if(tieneDia || tieneHora){
      ses.fecha=fecha; ses.hora=hora;
      const libres=await getHuecosLibres(fecha);
      const diaTxt=fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
      const diaTxtCapitalizado = diaTxt.charAt(0).toUpperCase() + diaTxt.slice(1);
      if(tieneHora){
        const hStr=hora+':00';
        if(!libres.includes(hStr)){
          reply=`Ese hueco ya está reservado para el ${diaTxtCapitalizado} a las ${hStr}.\n\nPero tengo estos huecos disponibles para ti ${EMOJI}\n\n${formatHuecosPro(libres)}\n\nDime qué hora te viene mejor y te la bloqueo.`;
          ses.estado='pidiendo_hora';
        } else {
          ses.estado='pidiendo_nombre';
          reply=`Perfecto ${EMOJI}\n\nTengo disponible el ${diaTxtCapitalizado} a las ${hStr}.\n\n¿A nombre de quién confirmo la reserva?\nNecesito tu nombre y apellidos.`;
        }
      } else {
        ses.estado='pidiendo_hora';
        reply=`¡Genial! Para el ${diaTxtCapitalizado} ${EMOJI}\n\nTengo estos horarios disponibles:\n\n${formatHuecosPro(libres)}\n\n¿Qué hora te viene mejor?`;
      }
    }
    else {
      ses.estado='pidiendo_fecha';
      reply=`Hola, bienvenida a ${BUSINESS_NAME} ${EMOJI}\n\nSoy Maki, tu asistente de reservas premium.\n\n¿Para qué día te gustaría reservar tu cita?`;
    }

  }catch(e){
    console.log('ERROR BOT:', e);
    reply=`Disculpa, no te he entendido bien. ¿Me repites el día y la hora por favor? ${EMOJI}\n\nEjemplo: Lunes a las 13:00`;
  }

  res.set('Content-Type','text/xml');
  return res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT,()=>console.log('LIVE V5.1 MEMORIA FIX '+BUSINESS_NAME));
