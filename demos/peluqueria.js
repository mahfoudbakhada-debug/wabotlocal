
// demos/peluqueria.js - Demo para vender a 49€/mes
export const flowPeluqueria = {
  bienvenida: "¡Hola! 👋 Soy el asistente de Barbershop Mahfoud 💈\n\n1️⃣ Ver precios\n2️⃣ Reservar cita\n3️⃣ Horario\n\nEscribe el número",
  
  precios: "💈 PRECIOS:\n- Corte: 15€\n- Corte + Barba: 22€\n- Barba: 10€\n\n¿Quieres reservar? Escribe 2",
  
  pedirCita: "Perfecto, dime:\nNombre y día/hora que quieres. Ej: Mahfoud mañana 18:00 corte",
  
  confirmado: (datos) => `¡Apuntado! ✅\n${datos}\nTe esperamos. Te llegará recordatorio por WhatsApp.`,
  
  horario: "🕒 LUN-SAB 10:00 a 20:00\nDomingo cerrado.\n¿Reservamos? Escribe 2"
}

// Luego lo conectamos a Google Sheet para que al dueño le llegue la cita automática
