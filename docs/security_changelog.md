# Security Changelog

Registro de correcciones de seguridad aplicadas al proyecto, con referencia a la auditoría original.

---

## 2026-06-30 — Auditoría `security_audit_1.md` (commit base `ef6439b`)

### V-01 🔴 CRÍTICO — Price injection en pedidos (`orders.js`)

**Problema:** El precio de cada línea de carrito llegaba del cliente (`item.price`) y el backend lo aceptaba sin validar contra la base de datos. Cualquier usuario podía hacer un pedido con precio 0.

**Solución aplicada:** `backend/src/routes/orders.js`

Por cada item recibido se realiza `SELECT id, name, price FROM products WHERE id = ? AND active = 1`. Si el producto no existe o está inactivo se devuelve HTTP 400. El total se calcula con `rows[0].price` de BD; `item.price` del cliente se ignora completamente. Los items que se persisten en la columna JSON usan también el precio de BD.

**Impacto:** Elimina la posibilidad de manipular precios vía body del POST. Añade N queries por pedido (una por línea de carrito) — aceptable con el volumen esperado.

---

### V-03 🟠 ALTO — Open redirect post-login (`login.html`)

**Problema:** El parámetro `?return=` aceptaba cualquier URL incluyendo `//evil.com` (protocolo relativo), habilitando phishing con URL de dominio legítimo.

**Solución aplicada:** `public/login.html` línea 70

```javascript
// antes
if (ret && ret.startsWith('/')) {

// después
if (ret && ret.startsWith('/') && !ret.startsWith('//')) {
```

`//evil.com` es interpretado por el browser como `https://evil.com`. La condición adicional bloquea este vector dejando pasar solo rutas relativas internas (e.g. `/admin/`, `/mi-cuenta.html`).

---

### V-10 🟡 MEDIO — `trust proxy` ausente (`index.js`)

**Problema:** Detrás de Nginx, `express-rate-limit` leía `req.ip = 127.0.0.1` (IP del proxy) en lugar de la IP real del cliente. El rate limit anti-brute-force no funcionaba por IP en producción.

**Solución aplicada:** `backend/index.js`

```javascript
app.set('trust proxy', 1);
```

Valor `1` = un hop de proxy (Internet → Nginx → Node), que es la topología estándar de este proyecto. Con esto Express lee `X-Forwarded-For` que Nginx añade y `req.ip` contiene la IP real del cliente.

**Nota de topología:** Si se añade un CDN delante de Nginx (e.g. Cloudflare), cambiar a `2`. Si Node queda expuesto directamente a Internet sin proxy, eliminar esta línea para evitar IP spoofing vía `X-Forwarded-For`. Documentado también en `docs/deployment.md` y `docs/architecture.md`.

---

---

### V-05 🟠 ALTO — CORS abierto (`index.js`)

**Problema:** `cors()` sin argumentos responde con `Access-Control-Allow-Origin: *`, permitiendo peticiones cross-origin desde cualquier dominio.

**Solución aplicada:** `backend/index.js`, `.env.example`, `deployment/setup/setup_sh/setup.sh`

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

`ALLOWED_ORIGIN` se configura en `.env` con el dominio público del proyecto (e.g. `https://tutienda.es`). Si la variable no está definida, `false` bloquea todos los orígenes — seguro por defecto. En desarrollo local no aplica porque el frontend vive en el mismo origen que la API.

---

---

### V-04 🟠 ALTO — Política de Seguridad de Contenido (CSP) deshabilitada (`index.js`)

**Problema:** `helmet({ contentSecurityPolicy: false })` deshabilitaba explícitamente la CSP, dejando al navegador sin instrucciones sobre qué orígenes son válidos para cargar scripts, estilos y fuentes. Cualquier script inyectado mediante Scripting entre Sitios (XSS) se ejecutaría sin restricción.

**Paso previo necesario:** Todos los archivos HTML cargaban Google Fonts con un bloque `<style>@import url(...)` inline. Habilitar la CSP sin `'unsafe-inline'` en `styleSrc` hubiera roto las fuentes. Se migró el import a `<link rel="stylesheet">` en los 8 archivos HTML del proyecto antes de activar la CSP.

**Solución aplicada:** `backend/index.js` + 8 archivos HTML en `public/`

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));
```

**Qué bloquea ahora:**
- Scripts de orígenes externos no autorizados (incluyendo scripts inyectados por XSS)
- Estilos externos salvo `fonts.googleapis.com`
- Fuentes externas salvo `fonts.gstatic.com`
- Peticiones de red (fetch/XHR) a dominios distintos del propio
- Imágenes externas (se permiten `data:` para los CSS que usen imágenes inline)

---

---

### — 🔴 Docker corriendo como root (`backend/Dockerfile`)

**Problema:** Sin directiva `USER`, Docker ejecuta el proceso Node como `root` dentro del contenedor. Una vulnerabilidad de Ejecución Remota de Código (RCE) en una dependencia daría acceso root al sistema de archivos del contenedor, incluyendo variables de entorno y credenciales.

**Verificación previa:** Se auditaron todas las operaciones que el proceso necesita:
- Puerto 3000 — no requiere root (solo puertos < 1024 lo exigen)
- Sin escrituras en disco en el código fuente de la aplicación
- Archivos estáticos en `./public` montados como volumen con permisos `755/644` — legibles por uid 1000
- `create-admin.js` — solo hace queries a la base de datos, sin acceso al sistema de archivos
- Variables de entorno inyectadas por docker-compose, el `.env` del host no necesita estar accesible dentro del contenedor

La imagen base `node:20-alpine` ya incluye el usuario `node` (uid=1000) creado para este propósito.

**Solución aplicada:** `backend/Dockerfile`

```dockerfile
COPY --chown=node:node . .   # archivos copiados con propietario node desde el build
USER node                     # proceso corre como usuario sin privilegios
```

**Resultado:** una RCE solo obtiene uid=1000, sin capacidad de escribir fuera de `/app` ni interactuar con el sistema operativo del host.

---

---

### — 🟡 Headers de seguridad en Nginx (`deployment/setup/setup_domain.sh`)

**Problema:** El bloque HTTPS generado por Certbot no incluía headers de seguridad — sin `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, ni `Strict-Transport-Security` (Seguridad de Transporte Estricto por HTTP o HSTS).

**Complejidad:** Certbot reescribe el archivo de configuración de Nginx al crear el bloque HTTPS, por lo que los headers no pueden pre-escribirse en el Paso 3. Se añadió un Paso 7 post-Certbot que:

1. Crea `/etc/nginx/snippets/carniceria-security.conf` con todos los headers — archivo separado del que Certbot toca, inmune a futuras renovaciones de certificado
2. Inyecta `include /etc/nginx/snippets/carniceria-security.conf;` en el bloque HTTPS usando `sed`, anclado en la línea `ssl_certificate` (única en el archivo)
3. Verifica la configuración con `nginx -t` antes de recargar

Si Certbot no completó (DNS sin propagar), el snippet se crea igualmente y el mensaje avisa de que hay que re-ejecutar el script cuando el DNS propague.

**Headers aplicados:**
- `X-Frame-Options: SAMEORIGIN` — bloquea clickjacking mediante iframes
- `X-Content-Type-Options: nosniff` — bloquea MIME sniffing por el navegador
- `Referrer-Policy: strict-origin-when-cross-origin` — controla la cabecera Referer en peticiones cross-origin
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — fuerza HTTPS durante 1 año
- `client_max_body_size 1m` — limita el tamaño del cuerpo de las peticiones

---

---

### V-08 🟡 MEDIO — Sin validación de longitud en campos de pedido (`orders.js`)

**Problema:** `POST /api/orders` aceptaba strings de longitud arbitraria en todos los campos de texto. Un atacante podía enviar payloads (cargas útiles) de varios megabytes, saturando memoria en Node y generando carga innecesaria en MariaDB.

**Solución aplicada:** `backend/src/routes/orders.js`, después de la validación de campos requeridos y antes de tocar la base de datos.

Límites alineados con las columnas del esquema de base de datos:
- `name` → 120 caracteres (igual que `VARCHAR(120)` en `users.name`)
- `phone` → 30 caracteres (igual que `VARCHAR(30)`)
- `address` → 500 caracteres (margen sobre `TEXT`, límite razonable para una dirección)
- `zone` → 80 caracteres (igual que `VARCHAR(80)`)
- `time_slot` → 60 caracteres (igual que `VARCHAR(60)`)
- `items.length` → máximo 50 líneas de carrito

---

---

### — 🟡 Rate limit en `POST /api/orders` (`orders.js`)

**Problema:** Sin límite de frecuencia, un script podía crear miles de pedidos por minuto saturando el panel de administración y la base de datos.

**Solución aplicada:** `backend/src/routes/orders.js`

Mismo patrón que `loginLimiter` en `auth.js` — `express-rate-limit` ya estaba instalado. Límite: 4 pedidos por IP por minuto. Mensaje orientado al cliente real (empático y explicativo) en lugar de un error técnico genérico.

---

---

### V-14 🔵 BAJO — Sin paginación en `GET /api/admin/orders`

**Problema:** El endpoint devolvía todos los registros históricos sin límite, con impacto en memoria y tiempo de respuesta a medida que crecen los pedidos. El dashboard cargaba todos los pedidos para calcular estadísticas en el lado del cliente (client-side).

**Complejidad:** El endpoint tenía dos consumidores con necesidades distintas — la tabla de pedidos (necesita paginar) y el dashboard (necesita stats exactas). Una paginación naive rompía las estadísticas del dashboard.

**Solución aplicada:**

`backend/src/routes/admin/orders.js` — `limit` (por defecto 50, máximo 200) y `offset` añadidos a la query SQL. Valores saneados con `parseInt` + clamps para evitar inyección de valores negativos o excesivos.

`public/assets/js/admin.js` — `loadDashboard` dividido en dos llamadas específicas:
- `status=pendiente&limit=200` → recuento de pedidos pendientes (exacto, acotado)
- `from=hoy&limit=200` → estadísticas del día e histórico reciente (exacto para el volumen diario de una carnicería)

`loadAdminOrders` — añadidos `offset` y botones Anterior/Siguiente. El botón Siguiente se deshabilita cuando el resultado devuelve menos registros que el límite (señal de última página), sin necesitar un contador total.

`public/admin/pedidos.html` — barra de paginación con botones Anterior/Siguiente y etiqueta de página actual, integrada visualmente dentro del `table-card` existente.

---

### — 🟡 Índices de rendimiento en base de datos (`schema.sql`)

**Problema:** Sin índices en las columnas más filtradas, cada consulta filtrada hace un escaneo completo de tabla (full table scan). Con volumen creciente de pedidos, el tiempo de respuesta del panel de administración y de la tienda degradaría linealmente.

**Columnas indexadas:**
- `orders.status` — filtro del dashboard (`WHERE status = 'pendiente'`) y tabla de pedidos
- `orders.created_at` — ordenación (`ORDER BY created_at DESC`) y filtros de fecha en panel
- `promotions(active, starts_at, ends_at)` — índice compuesto para la búsqueda de promoción activa que se ejecuta una vez por producto en cada carga de la tienda (patrón N+1 conocido, T-04)

**`orders.user_id` no indexado explícitamente:** InnoDB crea un índice implícito al definir la clave foránea (FK). Añadir uno explícito crearía un duplicado inútil.

**Dos archivos para cubrir instalaciones nuevas y existentes:**
- `backend/database/schema.sql` — `CREATE INDEX IF NOT EXISTS` al final, se aplica automáticamente en instalaciones nuevas
- `backend/database/migrations/001_add_indexes.sql` — mismo SQL, con instrucciones para ejecutar manualmente en instalaciones existentes vía `docker compose exec db mariadb ...`

---

## Mejoras a largo plazo (backlog)

Todos los hallazgos críticos y quick wins del audit han sido aplicados. Lo que sigue son mejoras arquitectónicas que requieren mayor esfuerzo o decisiones de diseño:

| ID | Severidad | Descripción | Esfuerzo estimado |
|---|---|---|---|
| V-06 | 🟠 ALTO | JWT en `localStorage` — migrar a cookie `httpOnly; Secure; SameSite=Strict` | Alto — requiere cambiar flujo de auth en frontend y backend |
| V-02 | 🔵 BAJO | Añadir validación de `JWT_SECRET` en startup (`process.exit(1)` si < 32 chars) | Bajo — 3 líneas en `index.js`, red de seguridad para instalaciones manuales |
| V-07 | 🟡 MEDIO | Decremento atómico de stock al crear pedido (`UPDATE ... WHERE stock_qty >= ?`) | Medio — requiere lógica transaccional en `orders.js` |
| V-11 | 🟡 MEDIO | Logger estructurado (pino/winston) con sanitización de PII — sustituye `console.error` | Medio — afecta todos los route handlers |
| — | 🔵 | Revocación de JWT — blocklist en Redis o tokens de corta duración + refresh token | Alto — requiere nueva infraestructura |
| — | 🔵 | Suite de tests (vitest + supertest) para endpoints críticos | Alto — desde cero |
| — | 🔵 | Versionado de API (`/api/v1/`) | Medio — breaking change coordinado |
| — | 🔵 | GDPR básico — endpoint de exportación/borrado de datos de usuario | Medio |
