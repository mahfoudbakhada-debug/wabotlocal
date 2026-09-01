// server.js
// Sistema multi-tenant: 1 solo deploy sirve a todos los clientes.
// Cada cliente vive en clientes.json y se accede en /b/:clienteId
 
const express = require("express");
const fs = require("fs");
const path = require("path");
 
const app = express();
const PORT = process.env.PORT || 3000;
const CLIENTES_PATH = path.join(__dirname, "clientes.json");
 
// ---------- Helpers ----------
 
function cargarClientes() {
  try {
    const raw = fs.readFileSync(CLIENTES_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error leyendo clientes.json:", err.message);
    return {};
  }
}
 
// Plantillas de estilo. Añade más "style" aquí si quieres nuevos temas.
const TEMAS = {
  "barber-black-gold": {
    fondo: "#0b0b0b",
    tarjeta: "#161616",
    texto: "#f5f5f5",
    textoSecundario: "#c9c9c9",
    fuente: "'Bebas Neue', 'Oswald', sans-serif",
    radius: "4px",
  },
  "peluqueria-pink": {
    fondo: "#fff7fa",
    tarjeta: "#ffffff",
    texto: "#2b2b2b",
    textoSecundario: "#6b6b6b",
    fuente: "'Poppins', 'Segoe UI', sans-serif",
    radius: "16px",
  },
  // Tema por defecto si un cliente usa un "style" que no existe todavía
  "default": {
    fondo: "#f4f4f4",
    tarjeta: "#ffffff",
    texto: "#222222",
    textoSecundario: "#555555",
    fuente: "'Segoe UI', sans-serif",
    radius: "10px",
  },
};
 
function whatsappLink(phone, texto) {
  const numero = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
 
function renderLanding(clienteId, cliente) {
  const tema = TEMAS[cliente.style] || TEMAS.default;
  const primary = cliente.colors?.primary || tema.fondo;
  const accent = cliente.colors?.accent || tema.texto;
 
  const servicios = (cliente.services || [])
    .map(
      (s) => `
        <li class="servicio">
          <span class="servicio-nombre">${escapeHtml(s.name)}</span>
          <span class="servicio-precio">${s.price}€</span>
        </li>`
    )
    .join("");
 
  const wa = whatsappLink(
    cliente.phone,
    `Hola ${cliente.name}, quiero reservar una cita`
  );
 
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(cliente.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${tema.fuente};
    background: ${primary};
    color: ${tema.texto};
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px 80px;
  }
  .card {
    background: ${tema.tarjeta};
    color: ${tema.texto};
    max-width: 480px;
    width: 100%;
    border-radius: ${tema.radius};
    padding: 32px 24px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.15);
    text-align: center;
  }
  h1 {
    font-size: 2rem;
    letter-spacing: 1px;
    color: ${accent};
    margin-bottom: 8px;
  }
  .direccion, .telefono {
    color: ${tema.textoSecundario};
    font-size: 0.95rem;
    margin-bottom: 4px;
  }
  .servicios {
    list-style: none;
    margin-top: 28px;
    text-align: left;
  }
  .servicio {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid rgba(128,128,128,0.25);
  }
  .servicio-nombre { color: ${tema.texto}; }
  .servicio-precio { color: ${accent}; font-weight: bold; }
  .cta {
    display: inline-block;
    margin-top: 32px;
    background: ${accent};
    color: ${tema.tarjeta};
    text-decoration: none;
    font-weight: bold;
    padding: 14px 28px;
    border-radius: ${tema.radius};
    transition: opacity 0.2s;
  }
  .cta:hover { opacity: 0.85; }
  footer {
    margin-top: 24px;
    font-size: 0.75rem;
    color: ${tema.textoSecundario};
  }
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(cliente.name)}</h1>
    <p class="direccion">${escapeHtml(cliente.address || "")}</p>
    <p class="telefono">${escapeHtml(cliente.phone || "")}</p>
 
    <ul class="servicios">
      ${servicios || "<li>Sin servicios cargados todavía</li>"}
    </ul>
 
    <a class="cta" href="${wa}" target="_blank" rel="noopener">
      Reservar por WhatsApp
    </a>
  </div>
  <footer>${escapeHtml(clienteId)}</footer>
</body>
</html>`;
}
 
function render404(clienteId) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cliente no encontrado</title>
<style>
  body {
    font-family: 'Segoe UI', sans-serif;
    background: #111;
    color: #eee;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
  }
  h1 { font-size: 3rem; margin-bottom: 12px; }
  p { color: #aaa; }
  code {
    background: #222;
    padding: 4px 10px;
    border-radius: 6px;
    color: #ffb703;
  }
</style>
</head>
<body>
  <h1>404</h1>
  <p>No existe ningún negocio con el identificador</p>
  <p><code>${escapeHtml(clienteId)}</code></p>
</body>
</html>`;
}
 
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
 
// ---------- Rutas ----------
 
app.get("/", (req, res) => {
  res.redirect("/b/carmen");
});
 
app.get("/b/:clienteId", (req, res) => {
  const clientes = cargarClientes(); // se relee en cada request: no hace falta reiniciar el server al añadir clientes
  const { clienteId } = req.params;
  const cliente = clientes[clienteId];
 
  if (!cliente) {
    return res.status(404).send(render404(clienteId));
  }
 
  res.send(renderLanding(clienteId, cliente));
});
 
// Endpoint opcional: lista de clientes en JSON (útil para depurar)
app.get("/api/clientes", (req, res) => {
  res.json(cargarClientes());
});
 
app.listen(PORT, () => {
  console.log(`Servidor multi-tenant escuchando en el puerto ${PORT}`);
});
