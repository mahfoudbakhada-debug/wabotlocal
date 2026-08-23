// dateParser.js
// -----------------------------------------------------------------------
// Convierte texto en lenguaje natural ("mañana", "lunes", "25/08")
// a una fecha en formato YYYY-MM-DD. Devuelve null si no se entiende.
// -----------------------------------------------------------------------

const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "miércoles",
  "jueves",
  "viernes",
  "sabado",
  "sábado",
];

function quitarAcentos(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatoISO(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Interpreta un texto de usuario y devuelve la fecha en formato YYYY-MM-DD,
 * o null si no se pudo interpretar.
 */
function parsearFecha(textoOriginal) {
  const texto = quitarAcentos(textoOriginal.trim().toLowerCase());
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // "hoy"
  if (texto.includes("hoy")) {
    return formatoISO(hoy);
  }

  // "mañana" / "manana"
  if (texto.includes("manana")) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + 1);
    return formatoISO(fecha);
  }

  // "pasado mañana"
  if (texto.includes("pasado manana")) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + 2);
    return formatoISO(fecha);
  }

  // Formato DD/MM o DD/MM/YYYY
  const matchFecha = texto.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (matchFecha) {
    const dia = parseInt(matchFecha[1], 10);
    const mes = parseInt(matchFecha[2], 10) - 1;
    let anio = matchFecha[3] ? parseInt(matchFecha[3], 10) : hoy.getFullYear();
    if (anio < 100) anio += 2000;

    const fecha = new Date(anio, mes, dia);
    // Si la fecha resultante ya paso este año y no se especifico año, asumimos el año siguiente
    if (!matchFecha[3] && fecha < hoy) {
      fecha.setFullYear(fecha.getFullYear() + 1);
    }
    return formatoISO(fecha);
  }

  // Dia de la semana ("lunes", "el martes", "para el viernes"...)
  const diasNormalizados = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
  ];
  for (let i = 0; i < diasNormalizados.length; i++) {
    if (texto.includes(diasNormalizados[i])) {
      const fecha = new Date(hoy);
      const diaActual = fecha.getDay(); // 0=domingo
      let diff = i - diaActual;
      if (diff <= 0) diff += 7; // siempre el proximo dia de esa semana
      fecha.setDate(fecha.getDate() + diff);
      return formatoISO(fecha);
    }
  }

  return null;
}

module.exports = { parsearFecha };
