// routes/publicApi.js
// API consumida por la app/cliente. Base montada en /SNEOSMART5/api
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');

const router = express.Router();

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Busca y valida un usuario cliente. Devuelve { usuario, error, codigo }
function validarUsuario(username, password) {
  if (!username || !password) {
    return { error: 'Usuario y contraseña requeridos', codigo: 400 };
  }
  const u = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password, u.password)) {
    return { error: 'Usuario o contraseña incorrectos', codigo: 401 };
  }
  if (!u.activo) {
    return { error: 'Cuenta suspendida', codigo: 403 };
  }
  if (u.fecha_vencimiento < hoyISO()) {
    return { error: 'Cuenta vencida', codigo: 403 };
  }
  return { usuario: u };
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
    category_id: i + 1,
    category_name: nombre,
  }));

  return { contenido, categorias };
}

// GET o POST /SNEOSMART5/api/  (estilo panel_api: login + config de sesión + listas)
router.all('/', (req, res) => {
  const username = req.body.username || req.query.username;
  const password = req.body.password || req.query.password;

  const { usuario, error, codigo } = validarUsuario(username, password);
  if (error) return res.status(codigo).json({ ok: false, error });

  const { contenido, categorias } = armarListasContenido();

  res.json({
    ok: true,
    user_info: {
      username: usuario.username,
      status: 'Active',
      exp_date: usuario.fecha_vencimiento,
      max_connections: usuario.max_conexiones,
      created_at: usuario.creado_en,
    },
    server_info: {
      url: req.protocol + '://' + req.get('host'),
      base_path: '/SNEOSMART5/api',
      time_now: new Date().toISOString(),
    },
    categories: categorias,
    streams: contenido,
  });
});

// GET /SNEOSMART5/api/get_live_categories?username=&password=
router.get('/get_live_categories', (req, res) => {
  const { username, password } = req.query;
  const { error, codigo } = validarUsuario(username, password);
  if (error) return res.status(codigo).json({ ok: false, error });

  const { categorias } = armarListasContenido();
  res.json(categorias);
});

// GET /SNEOSMART5/api/get_live_streams?username=&password=&category_id=
router.get('/get_live_streams', (req, res) => {
  const { username, password, category_id } = req.query;
  const { error, codigo } = validarUsuario(username, password);
  if (error) return res.status(codigo).json({ ok: false, error });

  const { contenido, categorias } = armarListasContenido();

  let resultado = contenido;
  if (category_id) {
    const cat = categorias.find(c => String(c.category_id) === String(category_id));
    if (cat) resultado = contenido.filter(c => c.categoria === cat.category_name);
  }

  res.json(resultado);
});

module.exports = router;
