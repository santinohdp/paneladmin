```js
// routes/publicApi.js
// API consumida por la app/cliente.
// Base montada en /SNEOSMART5/api
//
// La app usa:
//   {baseURL}player_api.php?username=..&password=..[&action=..]
//
// Esquema compatible con Xtream Codes.

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');

const router = express.Router();


// ============================================================
// UTILIDADES
// ============================================================

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}


function unixSeconds(fechaISO) {
  const t = new Date(
    fechaISO.includes(' ')
      ? fechaISO.replace(' ', 'T') + 'Z'
      : fechaISO + 'T00:00:00Z'
  ).getTime();

  return Math.floor((isNaN(t) ? Date.now() : t) / 1000);
}


// Limpia la URL del stream.
// Si no existe o está vacía, devuelve una cadena vacía.
function limpiarUrlStream(url) {
  if (!url) return '';

  return String(url).trim();
}


// ============================================================
// INFORMACIÓN DEL USUARIO
// ============================================================

function construirUserInfo(username, password) {
  const u = db
    .prepare('SELECT * FROM usuarios WHERE username = ?')
    .get(username);

  const credencialesValidas =
    !!u && bcrypt.compareSync(password || '', u.password);

  const activo =
    credencialesValidas && !!u.activo;

  const vencido =
    credencialesValidas &&
    u.fecha_vencimiento < hoyISO();

  const auth =
    credencialesValidas &&
    activo &&
    !vencido;


  let status = 'Disabled';

  if (credencialesValidas && activo && vencido) {
    status = 'Expired';
  } else if (credencialesValidas && activo && !vencido) {
    status = 'Active';
  }


  return {
    auth,

    user_info: {
      username: username || '',
      password: password || '',
      message: '',
      auth: auth ? 1 : 0,
      status,

      exp_date: u
        ? String(unixSeconds(u.fecha_vencimiento))
        : '0',

      is_trial: '0',
      active_cons: '0',

      created_at: u
        ? String(unixSeconds(u.creado_en))
        : '0',

      max_connections: u
        ? String(u.max_conexiones)
        : '1',

      allowed_output_formats: [
        'm3u8',
        'ts',
        'rtmp'
      ]
    }
  };
}


// ============================================================
// INFORMACIÓN DEL SERVIDOR
// ============================================================

function construirServerInfo(req) {
  const esHttps =
    req.protocol === 'https' ||
    req.get('x-forwarded-proto') === 'https';

  return {
    url: req.hostname,

    port: esHttps
      ? '80'
      : String(req.socket.localPort || 80),

    https_port: '443',

    server_protocol:
      esHttps ? 'https' : 'http',

    rtmp_port: '25461',

    timezone:
      'America/Argentina/Buenos_Aires',

    timestamp_now:
      Math.floor(Date.now() / 1000),

    time_now:
      new Date()
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ')
  };
}


// ============================================================
// CONTENIDO
// ============================================================

function armarListasContenido() {

  const contenido = db.prepare(`
    SELECT
      c.id,
      c.titulo,
      c.url_stream,
      c.tipo,
      c.categoria,
      c.logo,
      p.id AS proveedor_id,
      p.nombre AS proveedor_nombre

    FROM contenido c

    LEFT JOIN proveedores p
      ON p.id = c.proveedor_id

    WHERE c.tipo = 'live'

    ORDER BY c.categoria, c.titulo
  `).all();


  // ----------------------------------------------------------
  // CATEGORÍAS
  // ----------------------------------------------------------

  const categorias = [
    ...new Set(
      contenido.map(c => c.categoria)
    )
  ].map((nombre, i) => ({

    category_id:
      String(i + 1),

    category_name:
      nombre || 'Sin categoría',

    parent_id:
      0

  }));


  // ----------------------------------------------------------
  // STREAMS
  // ----------------------------------------------------------

  const streams = contenido.map((c, i) => {

    const cat = categorias.find(
      cat =>
        cat.category_name === c.categoria
    );


    return {

      num:
        i + 1,

      name:
        c.titulo,

      stream_type:
        'live',

      stream_id:
        c.id,

      stream_icon:
        c.logo || '',

      epg_channel_id:
        '',

      added:
        String(
          Math.floor(
            Date.now() / 1000
          )
        ),

      category_id:
        cat
          ? cat.category_id
          : '0',

      custom_sid:
        '',

      tv_archive:
        0,

      direct_source:
        limpiarUrlStream(
          c.url_stream
        ),

      tv_archive_duration:
        0,

      thumbnail:
        c.logo || ''
    };
  });


  return {
    streams,
    categorias
  };
}


// ============================================================
// PLAYER API
// ============================================================

function manejarPlayerApi(req, res) {

  const username =
    req.query.username ||
    req.body?.username;

  const password =
    req.query.password ||
    req.body?.password;

  const action =
    req.query.action ||
    req.body?.action;


  // ----------------------------------------------------------
  // AUTENTICACIÓN
  // ----------------------------------------------------------

  const { auth } =
    construirUserInfo(
      username,
      password
    );


  // ----------------------------------------------------------
  // ACCIONES
  // ----------------------------------------------------------

  if (action) {

    // Si no está autenticado,
    // devolvemos lista vacía.
    if (!auth) {
      return res.json([]);
    }


    const {
      categorias,
      streams
    } = armarListasContenido();


    switch (action) {

      // ------------------------------------------------------
      // CATEGORÍAS DE TV EN VIVO
      // ------------------------------------------------------

      case 'get_live_categories':

        return res.json(
          categorias
        );


      // ------------------------------------------------------
      // CANALES EN VIVO
      // ------------------------------------------------------

      case 'get_live_streams': {

        const category_id =
          req.query.category_id ||
          req.body?.category_id;

        let resultado =
          streams;


        if (category_id) {

          resultado =
            streams.filter(
              s =>
                String(
                  s.category_id
                ) ===
                String(
                  category_id
                )
            );
        }


        return res.json(
          resultado
        );
      }


      // ------------------------------------------------------
      // VOD
      // ------------------------------------------------------

      case 'get_vod_categories':

      case 'get_vod_streams':


      // ------------------------------------------------------
      // SERIES
      // ------------------------------------------------------

      case 'get_series_categories':

      case 'get_series':


      // ------------------------------------------------------
      // ACCIÓN DESCONOCIDA
      // ------------------------------------------------------

      default:

        return res.json([]);
    }
  }


  // ----------------------------------------------------------
  // SIN ACTION = LOGIN
  // ----------------------------------------------------------

  const {
    user_info
  } = construirUserInfo(
    username,
    password
  );


  const server_info =
    construirServerInfo(req);


  return res.json({

    user_info,

    server_info

  });
}


// ============================================================
// RUTAS
// ============================================================

// Endpoint principal utilizado por la app:
//
// /SNEOSMART5/api/player_api.php

router.all(
  '/player_api.php',
  manejarPlayerApi
);


// Alias en la raíz:
//
// /SNEOSMART5/api/

router.all(
  '/',
  manejarPlayerApi
);


// ============================================================
// COMPATIBILIDAD
// ============================================================

// Categorías

router.get(
  '/get_live_categories',
  (req, res) => {

    req.query.action =
      'get_live_categories';

    manejarPlayerApi(
      req,
      res
    );
  }
);


// Streams

router.get(
  '/get_live_streams',
  (req, res) => {

    req.query.action =
      'get_live_streams';

    manejarPlayerApi(
      req,
      res
    );
  }
);


// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = router;

module.exports.manejarPlayerApi =
  manejarPlayerApi;
```
