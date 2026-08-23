// sessionStore.js
// -----------------------------------------------------------------------
// Almacena el estado de la conversacion de cada usuario en MEMORIA.
// Estructura: { "whatsapp:+34600...": { estado, datos, actualizado } }
//
// NOTA: al ser memoria RAM, si el proceso se reinicia (deploy, crash)
// se pierde el estado de las conversaciones en curso. Para produccion
// a mayor escala, sustituir por Redis o una tabla en base de datos,
// pero para un MVP de negocio local esto es mas que suficiente.
// -----------------------------------------------------------------------

const sesiones = new Map();

// Estados posibles del flujo conversacional
const ESTADOS = {
  INICIO: "INICIO",
  MENU: "MENU",
  RESERVA_PIDIENDO_DIA: "RESERVA_PIDIENDO_DIA",
  RESERVA_PIDIENDO_HORA: "RESERVA_PIDIENDO_HORA",
  RESERVA_PIDIENDO_NOMBRE: "RESERVA_PIDIENDO_NOMBRE",
  RESERVA_PIDIENDO_SERVICIO: "RESERVA_PIDIENDO_SERVICIO",
  RESERVA_CONFIRMADA: "RESERVA_CONFIRMADA",
};

/** Devuelve el estado del usuario, o crea uno nuevo si no existe */
function getSesion(telefono) {
  if (!sesiones.has(telefono)) {
    sesiones.set(telefono, {
      estado: ESTADOS.INICIO,
      datos: {},
      actualizado: Date.now(),
    });
  }
  return sesiones.get(telefono);
}

/** Actualiza el estado y/o datos del usuario */
function setSesion(telefono, cambios) {
  const actual = getSesion(telefono);
  const nueva = {
    ...actual,
    ...cambios,
    datos: { ...actual.datos, ...(cambios.datos || {}) },
    actualizado: Date.now(),
  };
  sesiones.set(telefono, nueva);
  return nueva;
}

/** Reinicia la sesion de un usuario (vuelve al menu principal) */
function resetSesion(telefono) {
  sesiones.set(telefono, {
    estado: ESTADOS.INICIO,
    datos: {},
    actualizado: Date.now(),
  });
}

// Limpieza periodica: elimina sesiones inactivas de mas de 2 horas
// para que la memoria no crezca indefinidamente.
setInterval(() => {
  const DOS_HORAS = 2 * 60 * 60 * 1000;
  const ahora = Date.now();
  for (const [telefono, sesion] of sesiones.entries()) {
    if (ahora - sesion.actualizado > DOS_HORAS) {
      sesiones.delete(telefono);
    }
  }
}, 30 * 60 * 1000); // revisa cada 30 min

module.exports = { getSesion, setSesion, resetSesion, ESTADOS };
