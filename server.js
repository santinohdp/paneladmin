// server.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

require('./database'); // inicializa la DB y corre las migraciones/seed

const publicApiRoutes = require('./routes/publicApi');
const adminAuthRoutes = require('./routes/adminAuth');
const adminUsuariosRoutes = require('./routes/adminUsuarios');
const adminProveedoresRoutes = require('./routes/adminProveedores');
const adminContenidoRoutes = require('./routes/adminContenido');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- API pública consumida por la app/cliente ----
// Bajo el prefijo custom (por si alguna app específica lo espera así):
app.use('/SNEOSMART5/api', publicApiRoutes);

// Y también en la raíz del dominio, que es lo que espera CUALQUIER app
// IPTV estándar compatible con Xtream Codes (IPTV Smarters, TiviMate, etc.):
// ellas arman la URL como {servidor}/player_api.php directamente, sin
// ningún prefijo. Con esto, poner solo el dominio en la app ya funciona.
const { manejarPlayerApi, manejarLiveStream } = publicApiRoutes;
app.all('/player_api.php', manejarPlayerApi);
app.get('/get_live_categories', (req, res) => {
  req.query.action = 'get_live_categories';
  manejarPlayerApi(req, res);
});
app.get('/get_live_streams', (req, res) => {
  req.query.action = 'get_live_streams';
  manejarPlayerApi(req, res);
});
// Reproducción real del stream: /live/usuario/contraseña/id.m3u8
app.get('/live/:username/:password/:idConExtension', manejarLiveStream);

// ---- API del panel administrativo ----
app.use('/SNEOSMART5/admin/api/auth', adminAuthRoutes);
app.use('/SNEOSMART5/admin/api/usuarios', adminUsuariosRoutes);
app.use('/SNEOSMART5/admin/api/proveedores', adminProveedoresRoutes);
app.use('/SNEOSMART5/admin/api/contenido', adminContenidoRoutes);

// ---- Frontend estático del panel (login + dashboard) ----
app.use(express.static(path.join(__dirname, 'public')));

// Cualquier ruta no-API dentro del panel cae al index (SPA simple de 2 páginas)
app.get('/SNEOSMART5/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/SNEOSMART5/admin');
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// Manejo de errores genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`SNEOSMART5 backend corriendo en http://localhost:${PORT}`);
  console.log(`Panel admin: http://localhost:${PORT}/SNEOSMART5/admin`);
  console.log(`API cliente: http://localhost:${PORT}/SNEOSMART5/api`);
});
