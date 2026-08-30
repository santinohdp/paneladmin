const API_BASE = '/SNEOSMART5/admin/api';

// ---------- Utilidades ----------
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = '/index.html';
    throw new Error('No autenticado');
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Error en la solicitud');
  }
  return data;
}

function openModal(html) {
  document.getElementById('modalBox').innerHTML = html;
  document.getElementById('modalOverlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

function badgeEstado(estado) {
  const map = {
    activo: 'bg-emerald-500/20 text-emerald-400',
    suspendido: 'bg-slate-500/20 text-slate-400',
    vencido: 'bg-red-500/20 text-red-400',
  };
  return `<span class="px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] || ''}">${estado}</span>`;
}

// ---------- Sesión ----------
(async () => {
  try {
    const data = await apiFetch(`${API_BASE}/auth/me`);
    document.getElementById('adminName').textContent = data.admin.username;
  } catch (_) {}
})();

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  window.location.href = '/index.html';
});

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.className = 'tab-btn px-4 py-2 rounded-lg bg-slate-800 text-sm font-medium');
    btn.className = 'tab-btn px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium';
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');

    if (btn.dataset.tab === 'usuarios') cargarUsuarios();
    if (btn.dataset.tab === 'contenido') cargarContenido();
    if (btn.dataset.tab === 'proveedores') cargarProveedores();
  });
});

/* =========================================================
   USUARIOS
   ========================================================= */
async function cargarUsuarios() {
  const buscar = document.getElementById('buscarUsuario').value.trim();
  const url = buscar ? `${API_BASE}/usuarios?buscar=${encodeURIComponent(buscar)}` : `${API_BASE}/usuarios`;
  const { usuarios } = await apiFetch(url);

  const tbody = document.getElementById('usuariosTbody');
  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td class="px-4 py-3 font-medium">${u.username}</td>
      <td class="px-4 py-3">${badgeEstado(u.estado)}</td>
      <td class="px-4 py-3 text-slate-400">${u.fecha_vencimiento}</td>
      <td class="px-4 py-3 text-slate-400">${u.max_conexiones}</td>
      <td class="px-4 py-3 text-right space-x-2">
        <button class="text-indigo-400 hover:underline text-xs" onclick="editarUsuario(${u.id})">Editar</button>
        <button class="text-amber-400 hover:underline text-xs" onclick="toggleUsuario(${u.id}, ${!u.activo})">
          ${u.activo ? 'Suspender' : 'Activar'}
        </button>
        <button class="text-red-400 hover:underline text-xs" onclick="borrarUsuario(${u.id})">Eliminar</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Sin usuarios</td></tr>`;
}

document.getElementById('buscarUsuario').addEventListener('input', () => cargarUsuarios());

function formUsuarioHTML(u = {}) {
  return `
    <h2 class="text-lg font-semibold">${u.id ? 'Editar usuario' : 'Nuevo usuario'}</h2>
    <form id="usuarioForm" class="space-y-3">
      <div>
        <label class="block text-sm text-slate-400 mb-1">Usuario</label>
        <input name="username" value="${u.username || ''}" required
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">${u.id ? 'Nueva contraseña (opcional)' : 'Contraseña'}</label>
        <input name="password" type="text" ${u.id ? '' : 'required'}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">Fecha de vencimiento</label>
        <input name="fecha_vencimiento" type="date" value="${u.fecha_vencimiento || ''}" required
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">Máx. conexiones</label>
        <input name="max_conexiones" type="number" min="1" value="${u.max_conexiones || 1}" required
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">Notas</label>
        <textarea name="notas" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">${u.notas || ''}</textarea>
      </div>
      <p id="usuarioFormError" class="text-red-400 text-sm hidden"></p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 text-sm">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium">Guardar</button>
      </div>
    </form>
  `;
}

document.getElementById('nuevoUsuarioBtn').addEventListener('click', () => {
  openModal(formUsuarioHTML());
  bindUsuarioForm();
});

async function editarUsuario(id) {
  const { usuario } = await apiFetch(`${API_BASE}/usuarios/${id}`);
  openModal(formUsuarioHTML(usuario));
  bindUsuarioForm(id);
}

function bindUsuarioForm(id) {
  document.getElementById('usuarioForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    const errorEl = document.getElementById('usuarioFormError');
    try {
      if (id) {
        if (!payload.password) delete payload.password;
        await apiFetch(`${API_BASE}/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch(`${API_BASE}/usuarios`, { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal();
      cargarUsuarios();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

async function toggleUsuario(id, activo) {
  await apiFetch(`${API_BASE}/usuarios/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ activo }) });
  cargarUsuarios();
}

async function borrarUsuario(id) {
  if (!confirm('¿Eliminar este usuario?')) return;
  await apiFetch(`${API_BASE}/usuarios/${id}`, { method: 'DELETE' });
  cargarUsuarios();
}

/* =========================================================
   PROVEEDORES
   ========================================================= */
async function cargarProveedores() {
  const { proveedores } = await apiFetch(`${API_BASE}/proveedores`);
  const tbody = document.getElementById('proveedoresTbody');
  tbody.innerHTML = proveedores.map(p => `
    <tr>
      <td class="px-4 py-3 font-medium">${p.nombre}</td>
      <td class="px-4 py-3 text-slate-400">${p.descripcion || '—'}</td>
      <td class="px-4 py-3 text-slate-400">${p.total_contenido}</td>
      <td class="px-4 py-3 text-right space-x-2">
        <button class="text-indigo-400 hover:underline text-xs" onclick="editarProveedor(${p.id}, '${p.nombre.replace(/'/g, "\\'")}', '${(p.descripcion || '').replace(/'/g, "\\'")}')">Editar</button>
        <button class="text-red-400 hover:underline text-xs" onclick="borrarProveedor(${p.id})">Eliminar</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="px-4 py-6 text-center text-slate-500">Sin proveedores</td></tr>`;

  // refrescar selector de proveedor en el modal de contenido si existe
  window._proveedoresCache = proveedores;
}

function formProveedorHTML(nombre = '', descripcion = '') {
  return `
    <h2 class="text-lg font-semibold">${nombre ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
    <form id="proveedorForm" class="space-y-3">
      <div>
        <label class="block text-sm text-slate-400 mb-1">Nombre</label>
        <input name="nombre" value="${nombre}" required
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">Descripción</label>
        <textarea name="descripcion" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">${descripcion}</textarea>
      </div>
      <p id="proveedorFormError" class="text-red-400 text-sm hidden"></p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 text-sm">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium">Guardar</button>
      </div>
    </form>
  `;
}

document.getElementById('nuevoProveedorBtn').addEventListener('click', () => {
  openModal(formProveedorHTML());
  bindProveedorForm();
});

function editarProveedor(id, nombre, descripcion) {
  openModal(formProveedorHTML(nombre, descripcion));
  bindProveedorForm(id);
}

function bindProveedorForm(id) {
  document.getElementById('proveedorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    const errorEl = document.getElementById('proveedorFormError');
    try {
      if (id) {
        await apiFetch(`${API_BASE}/proveedores/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch(`${API_BASE}/proveedores`, { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal();
      cargarProveedores();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

async function borrarProveedor(id) {
  if (!confirm('¿Eliminar este proveedor? El contenido asociado quedará sin proveedor.')) return;
  await apiFetch(`${API_BASE}/proveedores/${id}`, { method: 'DELETE' });
  cargarProveedores();
}

/* =========================================================
   CONTENIDO
   ========================================================= */
async function cargarContenido() {
  if (!window._proveedoresCache) await cargarProveedores();

  const buscar = document.getElementById('buscarContenido').value.trim();
  const categoria = document.getElementById('filtroCategoria').value;
  const params = new URLSearchParams();
  if (buscar) params.set('buscar', buscar);
  if (categoria) params.set('categoria', categoria);

  const { contenido } = await apiFetch(`${API_BASE}/contenido?${params.toString()}`);
  const { categorias } = await apiFetch(`${API_BASE}/contenido/categorias`);

  const filtroCat = document.getElementById('filtroCategoria');
  const seleccion = filtroCat.value;
  filtroCat.innerHTML = `<option value="">Todas las categorías</option>` +
    categorias.map(c => `<option value="${c}" ${c === seleccion ? 'selected' : ''}>${c}</option>`).join('');

  const tbody = document.getElementById('contenidoTbody');
  tbody.innerHTML = contenido.map(c => `
    <tr>
      <td class="px-4 py-3 font-medium">${c.titulo}</td>
      <td class="px-4 py-3 text-slate-400">${c.tipo}</td>
      <td class="px-4 py-3 text-slate-400">${c.categoria}</td>
      <td class="px-4 py-3 text-slate-400">${c.proveedor_nombre || '—'}</td>
      <td class="px-4 py-3 text-slate-500 max-w-xs truncate" title="${c.url_stream}">${c.url_stream}</td>
      <td class="px-4 py-3 text-right space-x-2">
        <button class="text-indigo-400 hover:underline text-xs" onclick='editarContenido(${JSON.stringify(c)})'>Editar</button>
        <button class="text-red-400 hover:underline text-xs" onclick="borrarContenido(${c.id})">Eliminar</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">Sin contenido</td></tr>`;
}

document.getElementById('buscarContenido').addEventListener('input', () => cargarContenido());
document.getElementById('filtroCategoria').addEventListener('change', () => cargarContenido());

function formContenidoHTML(c = {}) {
  const proveedoresOptions = (window._proveedoresCache || []).map(p =>
    `<option value="${p.id}" ${c.proveedor_id === p.id ? 'selected' : ''}>${p.nombre}</option>`
  ).join('');

  return `
    <h2 class="text-lg font-semibold">${c.id ? 'Editar contenido' : 'Nuevo contenido'}</h2>
    <form id="contenidoForm" class="space-y-3">
      <div>
        <label class="block text-sm text-slate-400 mb-1">Título</label>
        <input name="titulo" value="${c.titulo || ''}" required
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">URL del stream (M3U8, MP4, etc.)</label>
        <input name="url_stream" value="${c.url_stream || ''}" required
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-slate-400 mb-1">Tipo</label>
          <select name="tipo" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
            <option value="live" ${c.tipo === 'live' ? 'selected' : ''}>Canal en vivo</option>
            <option value="movie" ${c.tipo === 'movie' ? 'selected' : ''}>Película</option>
            <option value="series" ${c.tipo === 'series' ? 'selected' : ''}>Serie</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-slate-400 mb-1">Categoría</label>
          <input name="categoria" value="${c.categoria || 'General'}" required
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">Proveedor</label>
        <select name="proveedor_id" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="">Sin proveedor</option>
          ${proveedoresOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1">Logo (URL, opcional)</label>
        <input name="logo" value="${c.logo || ''}"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
      </div>
      <p id="contenidoFormError" class="text-red-400 text-sm hidden"></p>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg bg-slate-800 text-sm">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium">Guardar</button>
      </div>
    </form>
  `;
}

document.getElementById('nuevoContenidoBtn').addEventListener('click', async () => {
  if (!window._proveedoresCache) await cargarProveedores();
  openModal(formContenidoHTML());
  bindContenidoForm();
});

async function editarContenido(c) {
  if (!window._proveedoresCache) await cargarProveedores();
  openModal(formContenidoHTML(c));
  bindContenidoForm(c.id);
}

function bindContenidoForm(id) {
  document.getElementById('contenidoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    if (!payload.proveedor_id) payload.proveedor_id = null;
    const errorEl = document.getElementById('contenidoFormError');
    try {
      if (id) {
        await apiFetch(`${API_BASE}/contenido/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch(`${API_BASE}/contenido`, { method: 'POST', body: JSON.stringify(payload) });
      }
      closeModal();
      cargarContenido();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

async function borrarContenido(id) {
  if (!confirm('¿Eliminar este contenido?')) return;
  await apiFetch(`${API_BASE}/contenido/${id}`, { method: 'DELETE' });
  cargarContenido();
}

// ---------- Carga inicial ----------
cargarUsuarios();
