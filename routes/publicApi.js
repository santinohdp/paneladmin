// routes/publicApi.js
// API consumida por la app/cliente. Base montada en /SNEOSMART5/api
// El esquema de respuesta sigue el formato estándar de Xtream Codes
// (player_api.php), porque es el que espera el LoginActivity/LoginCallback
// decompilado de la app cliente.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');

const router = express.Router();

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function unixSeconds(fechaISO) {
  // fechaISO puede ser "YYYY-MM-DD" o "YYYY-MM-DD HH:MM:SS"
  const t = new Date(fechaISO.includes(' ') ? fechaISO.replace(' ', 'T') + 'Z' : fechaISO + 'T00:00:00Z').getTime();
  return Math.floor((isNaN(t) ? Date.now() : t) / 1000);
}

// Busca al usuario y arma el objeto user_info en formato Xtream, sin importar
// si las credenciales son válidas o no (Xtream siempre responde 200 OK y
// comunica el resultado a través de "auth": 1 / 0 dentro del JSON).
function construirUserInfo(username, password) {
  const u = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);

  const credencialesValidas = !!u && bcrypt.compareSync(password || '', u.password);
  const activo = credencialesValidas && !!u.activo;
  const vencido = credencialesValidas && u.fecha_vencimiento < hoyISO();
  const auth = credencialesValidas && activo && !vencido;

  let status = 'Disabled';
  if (!credencialesValidas) status = 'Disabled';
  else if (!activo) status = 'Disabled';
  else if (vencido) status = 'Expired';
  else status = 'Active';

  return {
    usuario: auth ? u : null,
    auth,
    user_info: {
      username: username || '',
      password: password || '',
      message: '',
      auth: auth ? 1 : 0,
      status,
      exp_date: u ? String(unixSeconds(u.fecha_vencimiento)) : '0',
      is_trial: '0',
      active_cons: '0',
      created_at: u ? String(unixSeconds(u.creado_en)) : '0',
      max_connections: u ? String(u.max_conexiones) : '1',
      allowed_output_formats: ['m3u8', 'ts', 'rtmp'],
    },
  };
}

function construirServerInfo(req) {
  const host = req.hostname;
  const esHttps = req.protocol === 'https';
  return {
    url: host,
    port: esHttps ? '80' : String(req.socket.localPort || 80),
    https_port: '443',
    server_protocol: esHttps ? 'https' : 'http',
    rtmp_port: '25461',
    timezone: 'America/Argentina/Buenos_Aires',
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
}

function armarListasContenido() {
  const contenido = db.prepare(`
    SELECT c.id, c.titulo, c.url_stream, c.tipo, c.categoria, c.logo,
           p.id AS proveedor_id, p.nombre AS proveedor_nombre
    FROM contenido c
    LEFT JOIN proveedores p ON p.id = c.proveedor_id
    ORDER BY c.categoria, c.titulo
  `).all();

  const categorias = [...new Set(contenido.map(c => c.categoria))].map((nombre, i) => ({
    category_id: String(i + 1),
    category_name: nombre,
    parent_id: 0,
  }));

  const streams = contenido.map((c, i) => {
    const cat = categorias.find(cat => cat.category_name === c.categoria);
    return {
      num: i + 1,
      name: c.titulo,
      stream_type: 'live',
      stream_id: c.id,
      stream_icon: c.logo || '',
      epg_channel_id: '',
      added: String(Math.floor(Date.now() / 1000)),
      category_id: cat ? cat.category_id : '0',
      custom_sid: '',
      tv_archive: 0,
      direct_source: c.url_stream,
      tv_archive_duration: 0,
      thumbnail: c.logo || '',
    };
  });

  return { streams, categorias };
}

// GET o POST /SNEOSMART5/api/  (login estilo Xtream: player_api.php)
router.all('/', (req, res) => {
  const username = req.body.username || req.query.username;
  const password = req.body.password || req.query.password;

  if (!username || !password) {
    return res.json({ user_info: { auth: 0, status: 'Disabled', message: 'Usuario y contraseña requeridos' } });
  }

  const { auth, user_info } = construirUserInfo(username, password);
  const server_info = construirServerInfo(req);

  if (!auth) {
    // Xtream responde 200 igual, la app lee "auth": 0 / "status" para mostrar el motivo.
    return res.json({ user_info, server_info });
  }

  res.json({ user_info, server_info });
});

// GET /SNEOSMART5/api/get_live_categories?username=&password=
router.get('/get_live_categories', (req, res) => {
  const { username, password } = req.query;
  const { auth } = construirUserInfo(username, password);
  if (!auth) return res.json([]);

  const { categorias } = armarListasContenido();
  res.json(categorias);
});

// GET /SNEOSMART5/api/get_live_streams?username=&password=&category_id=
router.get('/get_live_streams', (req, res) => {
  const { username, password, category_id } = req.query;
  const { auth } = construirUserInfo(username, password);
  if (!auth) return res.json([]);

  const { streams } = armarListasContenido();

  let resultado = streams;
  if (category_id) {
    resultado = streams.filter(s => String(s.category_id) === String(category_id));
  }

  res.json(resultado);
});

module.exports = router;
