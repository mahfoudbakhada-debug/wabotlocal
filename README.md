# 🤖 WabotLocal

SaaS de Bot de WhatsApp para negocios locales: responde consultas, gestiona reservas
directamente en Google Calendar, guarda cada reserva en Google Sheets y pide reseñas
automáticamente 24h después de la cita.

## Stack

- Node.js + Express
- Twilio API (WhatsApp)
- Google Calendar API
- Google Sheets API
- node-cron (tarea programada de reseñas)
- Listo para desplegar en Railway o Render

## Estructura del proyecto

```
wabotlocal/
├── index.js          # Servidor Express (webhook + panel admin)
├── twilio.js          # Lógica conversacional del bot
├── calendar.js         # Integración Google Calendar
├── sheets.js           # Integración Google Sheets
├── dateParser.js        # Interpreta fechas en lenguaje natural
├── sessionStore.js       # Estado de conversación por usuario (en memoria)
├── cron.js             # Tarea diaria de solicitud de reseñas
├── config.json          # Configuración editable del negocio
├── .env.example          # Plantilla de variables de entorno
└── public/
    ├── admin.html         # Panel de administración
    └── carta.pdf           # Ejemplo de carta/catálogo en PDF
```

## Instalación en 5 pasos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Twilio (WhatsApp)

1. Crea una cuenta en [twilio.com](https://www.twilio.com) y activa el **WhatsApp Sandbox**
   (Console → Messaging → Try it out → Send a WhatsApp message) o compra un número de WhatsApp Business.
2. Copia tu `Account SID` y `Auth Token` desde el dashboard de Twilio.
3. En **Sandbox Settings** (o en la configuración de tu número), configura el webhook
   "WHEN A MESSAGE COMES IN" apuntando a:
   ```
   https://tu-dominio.com/webhook
   ```
   Método: `POST`.

### 3. Configurar Google Calendar y Google Sheets

1. Ve a [Google Cloud Console](https://console.cloud.google.com/) → crea un proyecto.
2. Activa las APIs **Google Calendar API** y **Google Sheets API**.
3. Crea una **Service Account** (IAM y administración → Cuentas de servicio) y genera una
   clave en formato JSON. De ese JSON necesitarás `client_email` y `private_key`.
4. Comparte tu **Google Calendar** (el que usarás para las citas) con el email de la
   Service Account, dándole permiso de "Realizar cambios en los eventos".
5. Crea una **Google Sheet** con una pestaña llamada `Reservas` y compártela también con
   el email de la Service Account (permiso de Editor). Copia el ID del Sheet desde la URL:
   ```
   https://docs.google.com/spreadsheets/d/ESTE_ES_EL_SHEET_ID/edit
   ```

### 4. Configurar variables de entorno

Copia el archivo de ejemplo y rellena tus datos reales:

```bash
cp .env.example .env
```

Edita `.env` con:
- `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
- `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` (de la Service Account)
- `SHEET_ID`, `CALENDAR_ID`
- `ADMIN_USER`, `ADMIN_PASS` (para proteger el panel `/admin`)

También personaliza `config.json` con el nombre de tu negocio, servicios, precios, etc.
(o hazlo directamente desde el panel `/admin` una vez desplegado).

### 5. Ejecutar en local o desplegar

**En local:**
```bash
npm start
```
El servidor arranca en `http://localhost:3000`. Para probar el webhook desde internet
puedes usar [ngrok](https://ngrok.com): `ngrok http 3000` y usar esa URL en Twilio.

**Desplegar en Railway / Render:**
1. Sube este proyecto a un repositorio de GitHub.
2. En Railway o Render, crea un nuevo servicio "Web Service" apuntando al repo.
3. Configura las mismas variables de entorno del `.env` en el panel de la plataforma
   (Railway: pestaña "Variables"; Render: pestaña "Environment").
4. Comando de arranque: `npm start`.
5. Copia la URL pública que te asigne la plataforma y úsala en el webhook de Twilio:
   `https://tu-app.up.railway.app/webhook`.

Para el **cron de reseñas**, tienes dos opciones:
- **Proceso persistente**: ejecuta `node cron.js` como un segundo servicio ("Worker" en
  Railway/Render) — quedará corriendo y disparará la tarea todos los días a las 10:00.
- **Cron Job nativo de la plataforma**: si Railway/Render ofrece "Scheduled Jobs", configura
  que ejecute `node cron.js --once` una vez al día a las 10:00 (esto evita mantener un
  proceso siempre encendido).

## Uso

- **Cliente en WhatsApp**: escribe "hola" al número de WhatsApp conectado a Twilio y el
  bot responde con el menú (1. Servicios, 2. Reservar cita, 3. Hablar con una persona).
- **Panel admin**: entra a `https://tu-dominio.com/admin` con el usuario/contraseña del
  `.env`. Desde ahí puedes editar el nombre del negocio, mensaje de bienvenida, links y
  subir un nuevo PDF de carta/catálogo.

## Notas importantes

- El estado de la conversación de cada usuario se guarda **en memoria** (no en base de
  datos). Si el servidor se reinicia, las conversaciones a mitad de flujo se pierden y el
  usuario simplemente puede volver a escribir "hola" para reiniciar. Para mayor escala,
  se recomienda sustituir `sessionStore.js` por Redis o una base de datos.
- Los huecos de reserva se calculan de 9:00 a 20:00 cada 30 minutos por defecto; esto es
  configurable en `config.json` (`horario_apertura`, `horario_cierre`, `duracion_cita_min`).
- Asegúrate de que el número de WhatsApp de Twilio (`TWILIO_WHATSAPP_NUMBER`) tenga el
  formato `whatsapp:+14155238886`.

## Licencia

MIT
