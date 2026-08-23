// index.js
// -----------------------------------------------------------------------
// Servidor principal de WabotLocal.
//   POST /webhook  -> recibe mensajes de WhatsApp via Twilio
//   GET  /admin    -> panel de administracion (protegido con user/pass)
//   POST /admin/config -> guarda cambios en config.json
//   POST /admin/carta  -> sube un nuevo carta.pdf
// -----------------------------------------------------------------------

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

// --- CANDADO DE PAGO ---
const configLock = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
if (configLock.activo === false) { console.log("⛔ CLIENTA NO PAGÓ - BOT APAGADO"); process.exit(0); }

const multer = require("multer");
const basicAuth = require("basic-auth");
const { manejarWebhook } = require("./twilio");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares generales ---
app.use(bodyParser.urlencoded({ extended: false })); // Twilio envia application/x-www-form-urlencoded
app.use(bodyParser.json());

// =========================================================
// WEBHOOK DE WHATSAPP (Twilio)
// =========================================================
app.post("/webhook", manejarWebhook);

// Ruta de salud, util para comprobar que el deploy funciona
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =========================================================
// PANEL DE ADMINISTRACION (protegido con usuario/password del .env)
// =========================================================

function requiereAuth(req, res, next) {
  const credenciales = basicAuth(req);
  const usuarioOk = process.env.ADMIN_USER;
  const passOk = process.env.ADMIN_PASS;

  if (
    !credenciales ||
    credenciales.name !== usuarioOk ||
    credenciales.pass !== passOk
  ) {
    res.set("WWW-Authenticate", 'Basic realm="WabotLocal Admin"');
    return res.status(401).send("Acceso no autorizado");
  }
  next();
}

// Sirve el HTML del panel (protegido)
app.get("/admin", requiereAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Devuelve la config actual en JSON (para que admin.html rellene el formulario)
app.get("/admin/config", requiereAuth, (req, res) => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
  res.json(config);
});

// Guarda los cambios del formulario en config.json
app.post("/admin/config", requiereAuth, (req, res) => {
  try {
    const configPath = path.join(__dirname, "config.json");
    const configActual = JSON.parse(fs.readFileSync(configPath, "utf-8"));

    const {
      nombre_negocio,
      mensaje_bienvenida,
      link_google_maps,
      link_resenas_google,
      telefono_humano,
    } = req.body;

    const nuevaConfig = {
      ...configActual,
      nombre_negocio: nombre_negocio ?? configActual.nombre_negocio,
      mensaje_bienvenida: mensaje_bienvenida ?? configActual.mensaje_bienvenida,
      link_google_maps: link_google_maps ?? configActual.link_google_maps,
      link_resenas_google: link_resenas_google ?? configActual.link_resenas_google,
      telefono_humano: telefono_humano ?? configActual.telefono_humano,
    };

    fs.writeFileSync(configPath, JSON.stringify(nuevaConfig, null, 2));
    res.json({ ok: true, mensaje: "Configuracion guardada correctamente" });
  } catch (err) {
    console.error("Error guardando config:", err);
    res.status(500).json({ ok: false, mensaje: "Error guardando la configuracion" });
  }
});

// --- Subida de carta.pdf ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public")),
  filename: (req, file, cb) => cb(null, "carta.pdf"), // siempre sobreescribe con el mismo nombre
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Solo se permiten archivos PDF"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

app.post("/admin/carta", requiereAuth, upload.single("carta"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, mensaje: "No se recibio ningun archivo" });
  }
  res.json({ ok: true, mensaje: "Carta PDF actualizada correctamente" });
});

// --- Manejo de errores de multer (ej: archivo no es PDF) ---
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ ok: false, mensaje: err.message });
  }
  next();
});
// --- PUBLIC al final para que admin.html pida contraseña ---
app.use(express.static(path.join(__dirname, "public")));

// --- Ruta para UptimeRobot - que no se duerma ---
app.get("/ping", (req, res) => {
  res.status(200).send('WabotLocal activo 24/7');
});
app.listen(PORT, () => {
  console.log(`🤖 WabotLocal escuchando en el puerto ${PORT}`);
  console.log(`   Webhook WhatsApp: POST /webhook`);
  console.log(`   Panel admin:      GET  /admin`);
});
