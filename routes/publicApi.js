
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
  if (!fechaISO) return '0';

  const fecha = String(fechaISO);

  const iso = fecha.includes(' ')
    ? fecha.replace(' ', 'T') + 'Z'
    : fecha + 'T00:00:00Z';

  const tiempo = new Date(iso).getTime();

  if (isNaN(tiempo)) {
    return String(Math.floor(Date.now() / 1000));
  }

  return String(Math.floor(tiempo / 1000));
}

function limpiarUrlStream(url) {
  if (!url) return '';
  return String(url).trim();
}


// ============================================================
// INFORMACIÓN DEL USUARIO
// ============================================================

function construirUserInfo(username, password) {

  const usuario = db
    .prepare('SELECT * FROM usuarios WHERE username = ?')
    .get(username);

  const credencialesValidas =
    !!usuario &&
    bcrypt.compareSync(
      password || '',
      usuario.password
    );

  const activo =
    credencialesValidas &&
    !!usuario.activo;

  const vencido =
    credencialesValidas &&
    usuario.fecha_vencimiento &&
    usuario.fecha_vencimiento < hoyISO();

  const auth =
    credencialesValidas &&
    activo &&
    !vencido;

  let status = 'Disabled';

  if (credencialesValidas && activo && vencido) {
    status = 'Expired';
  }

  if (credencialesValidas && activo && !vencido) {
    status = 'Active';
  }

  return {
    auth: !!auth,

    user_info: {
      username: username || '',
      password: password || '',
      message: '',
      auth: auth ? 1 : 0,
      status: status,

      exp_date: usuario
        ? unixSeconds(usuario.fecha_vencimiento)
        : '0',

      is_trial: '0',
      active_cons: '0',

      created_at: usuario
        ? unixSeconds(usuario.creado_en)
        : '0',

      max_connections: usuario
        ? String(usuario.max_conexiones || 1)
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

  const protocoloForwarded =
    req.get('x-forwarded-proto');

  const esHttps =
    req.protocol === 'https' ||
    protocoloForwarded === 'https';

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
// LISTAS DE CONTENIDO
// ============================================================

function armarListasContenido() {

  const sql = `
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
  `;

  const contenido =
    db.prepare(sql).all();


  // ==========================================================
  // CATEGORÍAS
  // ==========================================================

  const nombresCategorias = [
    ...new Set(
      contenido.map(c =>
        c.categoria || 'Sin categoría'
      )
    )
  ];


  const categorias =
    nombresCategorias.map(
      (nombre, indice) => ({
        category_id:
          String(indice + 1),

        category_name:
          nombre,

        parent_id:
          0
      })
    );


  // ==========================================================
  // STREAMS
  // ==========================================================

  const streams =
    contenido.map((c, indice) => {

      const categoria =
        c.categoria ||
        'Sin categoría';

      const cat =
        categorias.find(
          item =>
            item.category_name ===
            categoria
        );


      return {
        num:
          indice + 1,

        name:
          c.titulo || '',

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
    streams: streams,
    categorias: categorias
  };
}


// ============================================================
// PLAYER API
// ============================================================

function manejarPlayerApi(req, res) {

  const username =
    req.query.username ||
    (req.body && req.body.username);

  const password =
    req.query.password ||
    (req.body && req.body.password);

  const action =
    req.query.action ||
    (req.body && req.body.action);


  const informacion =
    construirUserInfo(
      username,
      password
    );


  const auth =
    informacion.auth;


  // ==========================================================
  // ACCIONES
  // ==========================================================

  if (action) {

    if (!auth) {
      return res.json([]);
    }


    const listas =
      armarListasContenido();


    switch (action) {

      case 'get_live_categories':

        return res.json(
          listas.categorias
        );


      case 'get_live_streams': {

        const categoryId =
          req.query.category_id ||
          (req.body &&
            req.body.category_id);


        let resultado =
          listas.streams;


        if (categoryId) {

          resultado =
            resultado.filter(
              stream =>
                String(
                  stream.category_id
                ) ===
                String(
                  categoryId
                )
            );
        }


        return res.json(
          resultado
        );
      }


      case 'get_vod_categories':

      case 'get_vod_streams':

      case 'get_series_categories':

      case 'get_series':

        return res.json([]);


      default:

        return res.json([]);
    }
  }


  // ==========================================================
  // LOGIN
  // ==========================================================

  return res.json({

    user_info:
      informacion.user_info,

    server_info:
      construirServerInfo(req)

  });
}


// ============================================================
// RUTAS
// ============================================================

router.all(
  '/player_api.php',
  manejarPlayerApi
);

router.all(
  '/',
  manejarPlayerApi
);


// ============================================================
// RUTAS COMPATIBLES
// ============================================================

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
// EXPORTAR
// ============================================================

module.exports = router;

module.exports.manejarPlayerApi =
  manejarPlayerApi;
