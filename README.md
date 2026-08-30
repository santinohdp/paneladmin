# SNEOSMART5 Backend

Backend en Node.js + Express + SQLite (usando el módulo nativo `node:sqlite`,
incluido en Node desde la versión 22.5 — **sin dependencias que requieran compilar
código nativo**, así que instala sin problemas en Windows sin Visual Studio Build Tools)
con panel administrativo y API pública compatible con `/SNEOSMART5/api/`, listo
para desplegar gratis en Render.com.

> Requisito: Node.js **22.5 o superior** (probado con Node 22 y 24). Vas a ver un
> aviso `ExperimentalWarning: SQLite is an experimental feature` al arrancar — es
> normal, no afecta el funcionamiento.

## Estructura

```
fenix-backend/
├── server.js                 # punto de entrada
├── database.js                # conexión SQLite, esquema y seed del admin
├── middleware/
│   └── auth.js                 # JWT para proteger el panel admin
├── routes/
│   ├── publicApi.js            # API de clientes: /SNEOSMART5/api
│   ├── adminAuth.js            # login/logout admin: /SNEOSMART5/admin/api/auth
│   ├── adminUsuarios.js        # CRUD usuarios: /SNEOSMART5/admin/api/usuarios
│   ├── adminProveedores.js     # CRUD proveedores: /SNEOSMART5/admin/api/proveedores
│   └── adminContenido.js       # CRUD contenido: /SNEOSMART5/admin/api/contenido
├── public/                    # frontend del panel (HTML + Tailwind CDN + JS vanilla)
│   ├── index.html               # login
│   ├── dashboard.html           # panel
│   └── js/
│       ├── login.js
│       └── dashboard.js
├── package.json
├── render.yaml                # blueprint de Render (opcional)
├── .env.example
└── .gitignore
```

## Correr en local

```bash
npm install
cp .env.example .env      # en Windows (CMD): copy .env.example .env
npm start
```

- Panel admin: `http://localhost:3000/SNEOSMART5/admin`
- API cliente: `http://localhost:3000/SNEOSMART5/api`
- Usuario admin por defecto: el que definas en `ADMIN_USERNAME` / `ADMIN_PASSWORD`
  (por defecto `admin` / `admin123`, **cambialo**).

## Desplegar en Render (plan Free)

1. Subí esta carpeta a un repo de GitHub (`git init && git add . && git commit -m "init" && git push`).
2. En Render: **New > Web Service**, conectá el repo.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: **Free**
3. En **Environment**, agregá las variables:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET` (cualquier cadena larga random)
   - `NODE_ENV=production`
4. Deploy. Render te da una URL tipo `https://tu-app.onrender.com`.
   - Panel: `https://tu-app.onrender.com/SNEOSMART5/admin`
   - API: `https://tu-app.onrender.com/SNEOSMART5/api`

Alternativa: si usás el archivo `render.yaml` incluido, Render puede crear el
servicio automáticamente vía **New > Blueprint**.

### ⚠️ Persistencia de la base de datos

El plan **Free** de Render usa disco efímero: cada vez que redeployás o el
servicio se reinicia (por inactividad), el archivo `sneosmart5.db` se pierde
y vuelve a crearse vacío (con el admin y el contenido demo). Si necesitás que
los usuarios/contenido persistan entre deploys, sumá un **Persistent Disk**
(requiere plan pago) y apuntá `DB_PATH` a esa ruta montada, por ejemplo
`/var/data/sneosmart5.db`.

## API pública `/SNEOSMART5/api`

### Login + config de sesión + listas (todo en una llamada)

```
GET/POST /SNEOSMART5/api/?username=USUARIO&password=CLAVE
```

Respuesta:
```json
{
  "ok": true,
  "user_info": { "username": "...", "status": "Active", "exp_date": "2026-12-31", "max_connections": 1 },
  "server_info": { "url": "...", "base_path": "/SNEOSMART5/api", "time_now": "..." },
  "categories": [{ "category_id": 1, "category_name": "General" }],
  "streams": [{ "id": 1, "titulo": "Canal Demo", "url_stream": "...", "categoria": "General", "proveedor_nombre": "..." }]
}
```

Si la cuenta no existe, la contraseña es incorrecta, está suspendida (`activo = 0`)
o `fecha_vencimiento` ya pasó, responde `401`/`403` con `{ "ok": false, "error": "..." }`.

### Compatibilidad estilo Xtream Codes

```
GET /SNEOSMART5/api/get_live_categories?username=&password=
GET /SNEOSMART5/api/get_live_streams?username=&password=&category_id=
```

## Panel admin

- `/SNEOSMART5/admin` → login y dashboard con 3 pestañas: **Usuarios**, **Contenido**, **Proveedores**.
- Usuarios: crear, editar credenciales, activar/suspender, borrar, definir `fecha_vencimiento` y `max_conexiones`.
- Contenido: crear/editar/eliminar streams (M3U8/MP4), categoría, tipo (live/movie/series) y proveedor asociado.
- Proveedores: alta/edición/borrado simple.

Todas las rutas `/SNEOSMART5/admin/api/*` (salvo `/auth/login`) están protegidas
con una cookie JWT httpOnly generada al iniciar sesión.
