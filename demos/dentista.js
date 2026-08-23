// demos/dentista.js - Demo para vender a 99€/mes
export const flowDentista = {
  bienvenida: "Hola! 🦷 Clínica Dental Sonrisa\n\n1️⃣ Precios limpieza\n2️⃣ Pedir cita\n3️⃣ Urgencia\n\nEscribe el número",
  
  precios: "🦷 Limpieza: 40€\nBlanqueamiento: 120€\nRevisión GRATIS\n\n¿Quieres cita? Escribe 2",
  
  pedirCita: "Dime tu nombre y cuándo te viene bien. Ej: Ana martes 17:00 limpieza",
  
  confirmado: (datos) => `¡Cita apuntada! ✅\n${datos}\nTe enviamos recordatorio. ¡Gracias por confiar!`,
  
  urgencia: "🚨 Para urgencias llámanos: 600 123 456 o escribe URGENCIA y te atendemos YA."
}
