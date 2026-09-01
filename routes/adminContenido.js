// routes/adminContenido.js
const express = require('express');
const db = require('../database');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdminAuth);

// Parsea el texto de una lista M3U/M3U8 extendida y devuelve un array de
// { titulo, url_stream, categoria, logo }. Soporta el formato estándar:
//   #EXTINF:-1 tvg-logo="..." group-title="Categoria",Nombre del Canal
//   http://.../stream.m3u8
function parsearM3U(texto) {
  const lineas = texto.split(/\r?\n/);
  const items = [];
  let actual = null;

  for (const lineaCruda of lineas) {
    const linea = lineaCruda.trim();
    if (!linea) continue;

    if (linea.toUpperCase().startsWith('#EXTINF')) {
      const logoMatch = linea.match(/tvg-logo="([^"]*)"/i);
      const grupoMatch = linea.match(/group-title="([^"]*)"/i);
      const nombreMatch = linea.match(/,([^,]*)$/);
      actual = {
        logo: logoMatch ? logoMatch[1] : '',
        categoria: (grupoMatch ? grupoMatch[1] : '').trim() || 'General',
        titulo: (nombreMatch ? nombreMatch[1] : 'Canal sin nombre').trim(),
      };
    } else if (!linea.startsWith('#') && actual) {
      actual.url_stream = linea;
      items.push(actual);
      actual = null;
    }
  }
  return items;
}

// GET /SNEOSMART5/admin/api/contenido?categoria=&proveedor_id=&buscar=
router.get('/', (req, res) => {
  const { categoria, proveedor_id, buscar } = req.query;
  let sql = `
    SELECT c.*, p.nombre AS proveedor_nombre
    FROM contenido c
    LEFT JOIN proveedores p ON p.id = c.proveedor_id
    WHERE 1=1
  `;
  const params = [];

  if (categoria) { sql += ' AND c.categoria = ?'; params.push(categoria); }
  if (proveedor_id) { sql += ' AND c.proveedor_id = ?'; params.push(proveedor_id); }
  if (buscar) { sql += ' AND c.titulo LIKE ?'; params.push(`%${buscar}%`); }

  sql += ' ORDER BY c.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json({ ok: true, contenido: rows });
});

// GET /SNEOSMART5/admin/api/contenido/categorias  -> lista de categorías existentes
router.get('/categorias', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT categoria FROM contenido ORDER BY categoria').all();
  res.json({ ok: true, categorias: rows.map(r => r.categoria) });
});

// POST /SNEOSMART5/admin/api/contenido/importar-m3u
// Body: { url?: string, contenido_m3u?: string, proveedor_id?: number }
// Hay que mandar "url" (para que el servidor la descargue) O "contenido_m3u"
// (el texto de la lista ya pegado). Si ambos vienen, se prioriza el texto.
router.post('/importar-m3u', async (req, res) => {
  const { url, contenido_m3u, proveedor_id } = req.body;
  let texto = contenido_m3u;

  if (!texto && url) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        return res.status(400).json({ ok: false, error: `No se pudo descargar la lista (HTTP ${resp.status})` });
      }
      texto = await resp.text();
    } catch (err) {
      return res.status(400).json({ ok: false, error: 'No se pudo descargar la URL: ' + err.message });
    }
  }

  if (!texto || !texto.trim()) {
    return res.status(400).json({ ok: false, error: 'Falta la URL o el contenido de la lista M3U' });
  }

  const items = parsearM3U(texto);
  if (items.length === 0) {
    return res.status(400).json({ ok: false, error: 'No se encontraron canales válidos en esa lista' });
  }

  const insertar = db.prepare(`
    INSERT INTO contenido (titulo, url_stream, tipo, categoria, logo, proveedor_id)
    VALUES (?, ?, 'live', ?, ?, ?)
  `);

  db.exec('BEGIN');
  try {
    for (const item of items) {
      insertar.run(item.titulo, item.url_stream, item.categoria, item.logo || null, proveedor_id || null);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ ok: false, error: 'Error guardando los canales: ' + err.message });
  }

  res.status(201).json({ ok: true, importados: items.length });
});

// POST /SNEOSMART5/admin/api/contenido
router.post('/', (req, res) => {
  const { titulo, url_stream, tipo, categoria, logo, proveedor_id } = req.body;
  if (!titulo || !url_stream) {
    return res.status(400).json({ ok: false, error: 'titulo y url_stream son obligatorios' });
  }
  const info = db.prepare(`
    INSERT INTO contenido (titulo, url_stream, tipo, categoria, logo, proveedor_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(titulo, url_stream, tipo || 'live', categoria || 'General', logo || null, proveedor_id || null);

  const nuevo = db.prepare('SELECT * FROM contenido WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ ok: true, contenido: nuevo });
});

// PUT /SNEOSMART5/admin/api/contenido/:id
router.put('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM contenido WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: 'No encontrado' });

  const { titulo, url_stream, tipo, categoria, logo, proveedor_id } = req.body;

  db.prepare(`
    UPDATE contenido
    SET titulo = ?, url_stream = ?, tipo = ?, categoria = ?, logo = ?, proveedor_id = ?
    WHERE id = ?
  `).run(
    titulo || c.titulo,
    url_stream || c.url_stream,
    tipo || c.tipo,
    categoria || c.categoria,
    logo !== undefined ? logo : c.logo,
    proveedor_id !== undefined ? proveedor_id : c.proveedor_id,
    req.params.id
  );

  const actualizado = db.prepare('SELECT * FROM contenido WHERE id = ?').get(req.params.id);
  res.json({ ok: true, contenido: actualizado });
});

// DELETE /SNEOSMART5/admin/api/contenido/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM contenido WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
  res.json({ ok: true });
});

module.exports = router;
