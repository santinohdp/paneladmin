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

**Importante:** el endpoint real que consumen las apps tipo Xtream Codes (Retrofit)
es `/SNEOSMART5/api/player_api.php`, no la raíz. La app arma la URL como
`_panelURL + "player_api.php"`, así que `_panelURL` debe terminar en `/`:

```
const-string v0, "https://tu-app.onrender.com/SNEOSMART5/api/"
```

### Login (sin parámetro `action`)

```
GET /SNEOSMART5/api/player_api.php?username=USUARIO&password=CLAVE
```

Responde **siempre 200 OK** (nunca 401/403, como hace Xtream real). El éxito o
fallo se comunica con `"auth": 1` o `"auth": 0` dentro del JSON:

```json
{
  "user_info": {
    "username": "...", "password": "...", "message": "",
    "auth": 1, "status": "Active",
    "exp_date": "1798675200", "is_trial": "0",
    "active_cons": "0", "created_at": "1788128080",
    "max_connections": "1",
    "allowed_output_formats": ["m3u8", "ts", "rtmp"]
  },
  "server_info": {
    "url": "...", "port": "80", "https_port": "443",
    "server_protocol": "https", "rtmp_port": "25461",
    "timezone": "America/Argentina/Buenos_Aires",
    "timestamp_now": 1788128080, "time_now": "..."
  }
}
```

`status` es `"Active"`, `"Expired"` o `"Disabled"` según corresponda.

### Categorías y streams (mismo endpoint, con `action`)

```
GET /SNEOSMART5/api/player_api.php?username=&password=&action=get_live_categories
GET /SNEOSMART5/api/player_api.php?username=&password=&action=get_live_streams
GET /SNEOSMART5/api/player_api.php?username=&password=&action=get_live_streams&category_id=1
```

Si las credenciales no son válidas, estas acciones devuelven `[]` (array vacío)
en vez de un error, para que la app no falle al pedir listas.

Las acciones de VOD y series (`get_vod_categories`, `get_vod_streams`,
`get_series_categories`, `get_series`) también responden `[]` — el panel
actualmente solo administra contenido `live`. Si necesitás películas/series,
avisá para sumarlas al esquema.

También quedan disponibles, por compatibilidad, `GET /SNEOSMART5/api/get_live_categories`
y `GET /SNEOSMART5/api/get_live_streams` como rutas sueltas.

## Panel admin

- `/SNEOSMART5/admin` → login y dashboard con 3 pestañas: **Usuarios**, **Contenido**, **Proveedores**.
- Usuarios: crear, editar credenciales, activar/suspender, borrar, definir `fecha_vencimiento` y `max_conexiones`.
- Contenido: crear/editar/eliminar streams (M3U8/MP4), categoría, tipo (live/movie/series) y proveedor asociado.
- Proveedores: alta/edición/borrado simple.

Todas las rutas `/SNEOSMART5/admin/api/*` (salvo `/auth/login`) están protegidas
con una cookie JWT httpOnly generada al iniciar sesión.
