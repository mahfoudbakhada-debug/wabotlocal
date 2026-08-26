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

// --- GOOGLE FIX MADRID ---
function getGoogleCreds() {
  if (process.env.GOOGLE_CREDENTIALS) return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  if (process.env.GOOGLE_CREDS_B64) return JSON.parse(Buffer.from(process.env.GOOGLE_CREDS_B64, 'base64').toString('utf-8'));
  return null;
}
function getCalendar() {
  const creds = getGoogleCreds(); if(!creds) return null;
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/calendar'] });
  return google.calendar({ version: 'v3', auth });
}
const sesiones = {};
const H_INI=9, H_FIN=20;

function parseFechaHora(texto){
  texto = texto.toLowerCase(); const hoy=new Date(); hoy.setHours(0,0,0,0); let fecha=new Date(hoy); let tieneDia=false;
  if(texto.includes('mañana') &&!texto.includes('pasado')){ fecha.setDate(hoy.getDate()+1); tieneDia=true; }
  else if(texto.includes('pasado mañana')){ fecha.setDate(hoy.getDate()+2); tieneDia=true; }
  else { const dias={lunes:1,martes:2,miercoles:3,miércoles:3,jueves:4,viernes:5,sabado:6,sábado:6,domingo:0}; for(let d in dias){ if(texto.includes(d)){ let diff=(dias[d]-hoy.getDay()+7)%7; if(diff===0) diff=7; fecha.setDate(hoy.getDate()+diff); tieneDia=true; break; } } if(texto.includes('hoy')) tieneDia=true; }
  let hora=null; const m=texto.match(/(\d{1,2})[:h ]*([0-5][0-9])?/); if(m){ hora=parseInt(m[1]); if(hora<8) hora+=12; if(hora>=H_INI && hora<=H_FIN) fecha.setHours(hora,0,0,0); else hora=null; }
  return {fecha,hora,tieneDia};
}
async function getHuecosLibres(fecha){
  try{
    const calendar=getCalendar(); if(!calendar) return ['10:00','11:00','12:00','17:00','18:00'];
    const ini=new Date(fecha); ini.setHours(H_INI,0,0,0); const fin=new Date(fecha); fin.setHours(H_FIN,0,0,0);
    const res=await calendar.events.list({calendarId:process.env.GOOGLE_CALENDAR_ID, timeMin:ini.toISOString(), timeMax:fin.toISOString(), singleEvents:true});
    const ocupadas=(res.data.items||[]).map(e=>new Date(e.start.dateTime||e.start.date).getHours());
    let libres=[]; for(let h=H_INI;h<=H_FIN;h++) if(!ocupadas.includes(h)) libres.push(h+':00'); return libres.length?libres:['10:00','12:00','17:00','18:00'];
  }catch(e){ return ['10:00','11:00','12:00','17:00','18:00']; }
}
function toLocalMadrid(d){
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
function formatHuecos(lista){ return lista.map(h=>`• ${h}`).join('\n'); }
function capitalizarFecha(d){ const t=d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}); return t.charAt(0).toUpperCase()+t.slice(1); }

app.get('/health',(req,res)=>res.send('OK'));
app.get('/', (req,res)=>{
  res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${BUSINESS_NAME}</title><link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400&family=Inter:wght@800;900&display=swap" rel="stylesheet"><style>body{background:#FDFBFF;font-family:Inter}h1{font-family:Bodoni Moda;font-size:80px}</style></head><body><h1>${BUSINESS_NAME} - Sistema Premium Activo ${EMOJI}</h1><p>Bot V6 con memoria</p></body></html>`);
});

// --- BOT V6 MEMORIA PREMIUM 2026 ---
app.post('/whatsapp', async (req,res)=>{
  const from=req.body.From; const raw=(req.body.Body||"").trim(); const body=raw.toLowerCase();
  if(!sesiones[from]) sesiones[from]={estado:'inicio', fecha:null, hora:null, nombre:null};
  const ses=sesiones[from];
  let reply="";

  try{
    const {fecha, hora, tieneDia} = parseFechaHora(raw);
    const tieneHora = hora!==null;

    // MEMORIA: Si ya tiene fecha y solo dice hora, NO PISAR FECHA
    if(ses.estado==='pidiendo_hora' && tieneHora &&!tieneDia){
      ses.fecha.setHours(hora,0,0,0); ses.hora=hora;
      const libres=await getHuecosLibres(ses.fecha);
      const diaCap = capitalizarFecha(ses.fecha);
      if(!libres.includes(hora+':00')){
        reply=`Ese hueco ya no está disponible, se me acaba de ocupar ${EMOJI}\n\nPara el ${diaCap} me quedan libres:\n\n${formatHuecos(libres)}\n\n¿Cuál de estos te bloqueo?`;
      } else {
        ses.estado='pidiendo_nombre';
        reply=`Perfecto ${EMOJI}\n\nHe bloqueado el ${diaCap} a las ${hora}:00 para ti.\n\n¿A nombre de quién confirmo la reserva?\nNecesito nombre y apellidos.`;
      }
    }
    // ESPERANDO NOMBRE
    else if(ses.estado==='pidiendo_nombre'){
      if(raw.split(' ').length < 2){
        reply=`¿Me indicas tu nombre completo por favor? ${EMOJI}\n\nPara confirmar necesito nombre y apellido.\n\nEjemplo: Ana García`;
      } else {
        ses.nombre=raw.trim().split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');
        try{
          const cal=getCalendar();
          if(cal) await cal.events.insert({
            calendarId:process.env.GOOGLE_CALENDAR_ID,
            requestBody:{
              summary:`${ses.nombre} - ${BUSINESS_NAME}`,
              description:`Cliente: ${ses.nombre}\nTel: ${from}\nReserva vía Maki Bot V6`,
              start:{dateTime:toLocalMadrid(ses.fecha), timeZone:'Europe/Madrid'},
              end:{dateTime:toLocalMadrid(new Date(ses.fecha.getTime()+45*60000)), timeZone:'Europe/Madrid'},
              location: BUSINESS_ADDRESS
            }
          });
        }catch(e){console.log('CAL ERROR:', e.message)}
        const diaTxt=ses.fecha.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
        const diaCap = diaTxt.charAt(0).toUpperCase()+diaTxt.slice(1);
        reply=`¡Reservado, ${ses.nombre.split(' ')[0]}! ${EMOJI}\n\nTu cita en ${BUSINESS_NAME} está 100% confirmada:\n\n📅 ${diaCap}\n👤 ${ses.nombre}\n📍 ${BUSINESS_ADDRESS}\n\nTe hemos guardado el hueco. Si necesitas cambiar o cancelar, escríbeme por aquí directamente.\n\n¡Gracias por confiar en nosotros!`;
        delete sesiones[from];
      }
    }
    // NUEVA PETICIÓN CON DÍA O DÍA+HORA
    else if(tieneDia){
      ses.fecha=fecha; ses.hora=hora;
      const libres=await getHuecosLibres(fecha);
      const diaCap = capitalizarFecha(fecha);

      if(tieneHora){
        const hStr=hora+':00';
        if(!libres.includes(hStr)){
          reply=`Ese hueco para el ${diaCap} a las ${hStr} acaba de ocuparse ${EMOJI}\n\nPero tengo estos disponibles para ti ese mismo día:\n\n${formatHuecos(libres)}\n\nDime cuál te viene mejor y te lo bloqueo ahora mismo.`;
          ses.estado='pidiendo_hora';
        } else {
          ses.estado='pidiendo_nombre';
          reply=`Perfecto ${EMOJI}\n\nTengo libre el ${diaCap} a las ${hStr}.\n\n¿A nombre de quién te hago la reserva?\nPor favor, nombre y apellidos.`;
        }
      } else {
        ses.estado='pidiendo_hora';
        reply=`¡Genial! Para el ${diaCap} ${EMOJI}\n\nTengo estos horarios disponibles para ti:\n\n${formatHuecos(libres)}\n\n¿Qué hora te encaja mejor?`;
      }
    }
    // SOLO DICE HORA SIN HABER DICHO DÍA ANTES
    else if(tieneHora &&!ses.fecha){
      ses.fecha=fecha; ses.hora=hora;
      ses.estado='pidiendo_nombre';
      const diaCap = capitalizarFecha(fecha);
      reply=`Perfecto ${EMOJI}\n\nTengo disponible hoy ${diaCap} a las ${hora}:00.\n\n¿A nombre de quién confirmo la reserva?\nNecesito nombre y apellidos.`;
    }
    // SALUDO / INICIO
    else {
      ses.estado='pidiendo_fecha';
      if(ses.fecha){
         const diaCap = capitalizarFecha(ses.fecha);
         reply=`Te tengo guardado el ${diaCap} ${EMOJI}\n\nDime solo la hora que quieres, por ejemplo: 13:00`;
      } else {
         reply=`Hola, bienvenida a ${BUSINESS_NAME} ${EMOJI}\n\nSoy Maki, tu asistente premium de reservas.\n\nTrabajamos con cita previa. ¿Para qué día te gustaría reservar?\n\nPuedes decirme por ejemplo: "Mañana a las 10" o "El lunes a las 17"`;
      }
    }
  }catch(e){ console.log(e); reply=`Uy, no te he entendido bien ${EMOJI}\n\n¿Me dices día y hora? Ejemplo: "Mañana a las 10:00"`; }

  res.set('Content-Type','text/xml');
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(PORT,()=>console.log('LIVE V6 MEMORIA PREMIUM '+BUSINESS_NAME));
