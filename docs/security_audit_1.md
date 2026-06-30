# Informe de Auditoría de Seguridad y Buenas Prácticas
## Carnicería Artesanal — Auditoría Completa

**Fecha:** 2026-06-30 | **Commit base:** `ef6439b`

> **⚠️ Contexto de la auditoría:** Realizada sobre entorno **local/desarrollo**, no sobre producción.
> El `.env` analizado es el de desarrollo (con `JWT_SECRET` placeholder).
> En producción, `setup.sh` genera automáticamente `JWT_SECRET` con `openssl rand -hex 64`,
> por lo que **V-02 no aplica a instalaciones realizadas con el script oficial**.
> El resto de hallazgos aplican igualmente en producción.

---

## 1. Resumen Ejecutivo

| Dimensión | Puntuación |
|---|---|
| Seguridad global | **5.5 / 10** |
| Calidad de código | **7.0 / 10** |

### Top 3 riesgos críticos

1. **🔴 CRÍTICO — Price injection en pedidos:** El precio de cada línea de carrito llega del cliente y el backend lo acepta sin validar contra la base de datos. Cualquier usuario puede hacer un pedido con precio 0.
2. **🟠 ALTO — Open redirect post-login:** El parámetro `?return=` en `login.html:71` acepta cualquier URL sin validación de dominio, habilitando phishing con URL legítima.
3. **🟠 ALTO — CSP deshabilitada + CORS abierto:** Amplifica el impacto de cualquier XSS futuro y permite peticiones cross-origin sin restricción de origen.

### Estado general

El stack técnico tiene bases sólidas (queries parametrizadas en todo el código, bcrypt coste 12, RBAC correcto, helmet activo). En producción con `setup.sh`, el `JWT_SECRET` se genera correctamente. El riesgo principal es un defecto de diseño económico crítico (precio cliente-confiado) y varios gaps de hardening que deben corregirse.

---

## 2. Auditoría de Seguridad

### 2.1 OWASP Top 10 (2021)

| # | Categoría | Estado | Hallazgo |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ Parcial | RBAC correcto en backend. Open redirect en `login.html:71`. |
| A02 | Cryptographic Failures | ⚠️ Parcial | bcrypt coste 12 correcto. JWT en localStorage. `JWT_SECRET` placeholder solo en dev — `setup.sh` lo genera con `openssl rand -hex 64` en producción. |
| A03 | Injection | ✅ Bien | Todas las queries usan parameterized statements. Sin SQLi identificado. |
| A04 | Insecure Design | ❌ Vulnerable | Precio calculado desde datos del cliente en `orders.js:27`. Sin recálculo server-side. |
| A05 | Security Misconfiguration | ⚠️ Parcial | `helmet({ contentSecurityPolicy: false })`. CORS abierto. Sin headers en Nginx. |
| A06 | Vulnerable Components | ⚠️ Parcial | 3 CVEs `moderate` en dependencias (qs DoS, brace-expansion DoS). Sin críticos. |
| A07 | Auth & Session Failures | ⚠️ Parcial | Rate limit solo en `/login` y `/register`. Sin revocación de JWT. Sin `trust proxy`. |
| A08 | Software/Data Integrity | ✅ Bien | Sin deserialización insegura. Esquema BD con ENUM constraints. |
| A09 | Logging & Monitoring | ⚠️ Parcial | `console.error(err)` puede exponer detalles de esquema en logs. Sin log estructurado. |
| A10 | SSRF | ✅ Bien | Sin peticiones HTTP server-side iniciadas desde input de usuario. |

---

### 2.2 Tabla de Vulnerabilidades

| ID | Severidad | Categoría | Descripción | Archivo:Línea | Explotabilidad |
|---|---|---|---|---|---|
| V-01 | 🔴 CRÍTICO | Insecure Design | Precio de items viene del cliente, backend no valida contra `products.price` | `orders.js:27` | Trivial — modificar body del POST |
| V-02 | 🔵 BAJO *(solo dev)* | Crypto Failures | `JWT_SECRET` placeholder en `.env` local. En producción `setup.sh` genera valor seguro con `openssl rand -hex 64`. Solo aplica a instalaciones manuales sin el script. | `.env:10` | N/A en prod con `setup.sh` |
| V-03 | 🟠 ALTO | Broken Access Control | Open redirect: `?return=` acepta cualquier URL incluyendo dominios externos | `login.html:71` | Media (requiere ingeniería social) |
| V-04 | 🟠 ALTO | Security Misconfig | CSP deshabilitada explícitamente. Amplifica impacto de cualquier XSS futuro. | `index.js:19` | No explotable solo |
| V-05 | 🟠 ALTO | Security Misconfig | CORS abierto (`cors()` sin whitelist). Peticiones cross-origin no restringidas. | `index.js:20` | Media |
| V-06 | 🟠 ALTO | Auth Failures | JWT en `localStorage`. Token robado por XSS es válido 8h sin revocación posible. | `auth.js:3-7` | Media (requiere XSS previo) |
| V-07 | 🟡 MEDIO | Insecure Design | Sin decremento de stock. Overselling: pedidos aceptados para productos sin stock. | `orders.js` (ausente) | Trivial |
| V-08 | 🟡 MEDIO | Validation | Sin validación de longitud en campos de pedido. Strings de varios MB aceptados. | `orders.js:19-22` | Media |
| V-09 | 🟡 MEDIO | Validation | Sin validación de que `items[].id` corresponde a un producto real y activo. | `orders.js:19-32` | Trivial |
| V-10 | 🟡 MEDIO | Auth Failures | `trust proxy` ausente: rate limit ve `127.0.0.1` en producción. Brute-force viable. | `index.js` (ausente) | Media |
| V-11 | 🟡 MEDIO | Logging | `console.error(err)` puede emitir mensajes MariaDB con nombres de tablas/columnas. | Todos los route handlers | Baja |
| V-12 | 🔵 BAJO | Auth | `parseJwt()` frontend decodifica sin verificar firma — riesgo de confusión devs. | `auth.js:9-14` | N/A |
| V-13 | 🔵 BAJO | Dependency | `qs` y `brace-expansion` con CVEs moderate (DoS). Transitivas de express. | `package.json` | Baja |
| V-14 | 🔵 BAJO | Insecure Design | `GET /api/admin/orders` sin paginación devuelve todos los registros. | `admin/orders.js:12` | Baja |
| V-15 | 🔵 BAJO | Deployment | `.env.example` tiene `DB_PASSWORD=secret` que un operador puede copiar a producción. | `.env.example:4` | Baja |

---

### 2.3 Análisis Detallado por Área

#### Autenticación y Sesiones

**JWT en localStorage** (`auth.js:3-7`): Accesible desde cualquier JS en la página, incluyendo scripts de terceros. El riesgo práctico es moderado porque `escHtml` se usa consistentemente, pero no hay CSP que bloquee scripts inyectados. Google Fonts se carga sin atributo `integrity`.

**`trust proxy` ausente** (`index.js`): En producción detrás de Nginx, `express-rate-limit` lee `req.ip = 127.0.0.1` (IP del proxy) en lugar de la IP real del cliente. La protección anti-brute-force basada en IP no funciona como se diseñó.

**Revocación de JWT**: El logout elimina el token del localStorage pero el token sigue siendo válido en el servidor 8 horas. Sin lista negra ni mecanismo de invalidación.

---

#### Evidencia técnica — V-01: Price Injection (CRÍTICO)

```javascript
// backend/src/routes/orders.js:27
// El precio viene del body del cliente sin validación contra BD
const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
```

Explotación directa:

```bash
curl -X POST https://demoapp.es/api/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test",
    "phone": "600000000",
    "address": "X",
    "zone": "Chamartín / Salamanca",
    "time_slot": "Mañana (9:00–12:00)",
    "items": [{"id": 4, "name": "Solomillo", "price": 0.01, "qty": 10}]
  }'
# Resultado: pedido de 10 solomillos (22.90 €/kg real) por 0.10 € total
```

---

#### Evidencia técnica — V-02: JWT_SECRET Placeholder *(solo entorno local)*

> **Nota:** Este hallazgo se observó en el `.env` de desarrollo. En producción, `setup.sh` ejecuta `openssl rand -hex 64` y escribe el secreto real automáticamente. **No aplica a instalaciones realizadas con el script oficial.**

Solo es un riesgo en instalaciones manuales donde el operador copie el `.env.example` sin cambiar el valor:

```bash
# .env:10 — entorno local/dev
JWT_SECRET=cambia-este-secreto-por-64-caracteres-aleatorios-en-produccion
```

Si ese placeholder llegara a producción, cualquier atacante podría forjar tokens admin:

```python
import jwt
token = jwt.encode({'id': 1, 'role': 'admin'}, 'cambia-este-secreto...', algorithm='HS256')
# Token aceptado por authenticate.js como admin válido
```

**Mitigación recomendada** igualmente: añadir validación en startup (`index.js`) que haga `process.exit(1)` si `JWT_SECRET.length < 32`, como red de seguridad ante instalaciones manuales.

---

## 3. Auditoría de Buenas Prácticas

### 3.1 Arquitectura

| | |
|---|---|
| ✅ Positivo | Separación clara de rutas públicas/admin/usuario. Middleware de auth como capas independientes. Pool de conexiones centralizado. Soft delete consistente. |
| ⚠️ Deuda | Sin capa de servicios — lógica de negocio (cálculo de total, stock) directamente en route handlers. Sin repositorio de datos. Sin modelo de error unificado. |

### 3.2 Calidad del Código

| | |
|---|---|
| ✅ Positivo | Código conciso y legible. `async/await` consistente. `optionalUser()` es un patrón limpio. Transacción correcta en `admin/promotions.js:37-63`. `escHtml()` aplicado consistentemente. |
| ⚠️ Deuda | N+1 en `openEditModal()` — petición completa a `/api/admin/products` para un solo producto (`admin.js:121`). N+1 en carga de `promotion_products`. Sin ningún test. |

### 3.3 REST API

| | |
|---|---|
| ✅ Bien | Verbos HTTP correctos, status codes apropiados, respuestas JSON consistentes. |
| ❌ Mal | Sin versionado (`/api/v1/`). `PUT` en lugar de `PATCH` para actualización parcial de status. Sin paginación en ningún endpoint de lista. |

### 3.4 Base de Datos

| | |
|---|---|
| ✅ Positivo | FKs con CASCADE correctas, ENUM constraints, `utf8mb4`, transacción en POST promociones. |
| ⚠️ Deuda | Sin índices en `orders.status`, `orders.created_at`, `orders.user_id`, ni en `promotions(active, starts_at, ends_at)`. Con volumen, full table scans en todas las queries filtradas. Sin `updated_at` en `promotions`. |

### 3.5 Tests

> **Cero tests.** No existe ningún fichero de test, ningún script `test` en `package.json`, ningún framework instalado. Es el gap de calidad más relevante del proyecto.

---

## 4. Tabla de Dependencias

| Paquete | Versión | Estado | CVEs | Recomendación |
|---|---|---|---|---|
| express | ^4.19.2 | ⚠️ | GHSA-q8mj (transitivo, DoS) | Actualizar a ^4.21.x |
| mysql2 | ^3.9.7 | ✅ | Ninguno | Mantener |
| bcryptjs | ^3.0.3 | ✅ | Ninguno | Mantener |
| jsonwebtoken | ^9.0.3 | ✅ | Ninguno | Mantener |
| express-rate-limit | ^8.5.2 | ✅ | Ninguno | Mantener |
| helmet | ^7.1.0 | ✅ | Ninguno | Mantener |
| cors | ^2.8.5 | ⚠️ | Ninguno | Configurar con whitelist de origen |

---

## 5. Recomendaciones Priorizadas

### 🔴 Must Fix — Crítico/Alto (antes de tráfico real)

**1. Validar precios server-side** — `orders.js:27`

```javascript
// Para cada item, consultar el precio real en BD
const [rows] = await db.query(
  'SELECT id, price FROM products WHERE id = ? AND active = 1',
  [item.id]
);
if (!rows[0]) return res.status(400).json({ error: `Producto ${item.id} no disponible` });
// Usar rows[0].price — nunca item.price del cliente
```

**2. Validación de JWT_SECRET en startup** — `index.js`

```javascript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET no configurado. Saliendo.');
  process.exit(1);
}
```

**3. Validar open redirect** — `login.html:71`

```javascript
const ret = params.get('return');
if (ret && ret.startsWith('/') && !ret.startsWith('//')) {
  window.location.href = ret;
} else {
  window.location.href = user.role === 'admin' ? '/admin/' : '/mi-cuenta.html';
}
```

**4. Configurar `trust proxy` y CORS con whitelist** — `index.js`

```javascript
app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://demoapp.es',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

**5. Habilitar CSP mínimo** — `index.js:19`

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
    },
  },
}));
```

**6. Node non-root en Docker** — `backend/Dockerfile`

```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# ... COPY ...
USER appuser
```

---

### 🟡 Quick Wins — Medio (1-2h cada uno)

**1. Headers de seguridad en Nginx** (bloque `server` HTTPS en `setup_domain.sh`):

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
client_max_body_size 1m;
```

**2. Validación de longitud en pedidos** — `orders.js:19`

```javascript
if (name.length > 120 || phone.length > 30 || address.length > 500)
  return res.status(400).json({ error: 'Campo demasiado largo' });
```

**3. Paginación en `GET /api/admin/orders`** — `admin/orders.js:12`

```javascript
const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
const offset = parseInt(req.query.offset) || 0;
```

**4. Rate limit en `POST /api/orders`** — `orders.js`

```javascript
const orderLimiter = rateLimit({ windowMs: 60_000, max: 5 });
router.post('/', orderLimiter, async (req, res) => { ... });
```

**5. Índices en BD** — `schema.sql`

```sql
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_user_id    ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_promos_active     ON promotions(active, starts_at, ends_at);
```

**6. Eliminar credenciales débiles del `.env.example`** — reemplazar `secret` y `rootsecret` por `CAMBIAR_EN_PRODUCCION`.

---

### 🔵 Mejoras a Largo Plazo

1. **Migrar JWT a `httpOnly` cookies** — elimina el riesgo de XSS token theft completamente.
2. **Suite de tests** — `vitest` + `supertest` para endpoints críticos (pedidos, auth, precios).
3. **Logger estructurado** — `pino` o `winston` con sanitización de PII.
4. **Revocación de JWT** — blocklist en Redis o tokens de corta duración + refresh tokens.
5. **Decremento atómico de stock** — `UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?`
6. **Versionado de API** — `/api/v1/` para evolucionar sin breaking changes.
7. **GDPR básico** — endpoint de exportación/borrado de datos de usuario.
8. **Gestión de usuarios en panel admin** — activar/desactivar, cambiar rol sin CLI.

---

## 6. Checklist de Cumplimiento

| Control | Estado | Notas |
|---|---|---|
| Contraseñas hasheadas (bcrypt coste adaptativo) | ✅ | Coste 12 |
| Rate limiting en auth | ✅ | 10/15min en login y register |
| JWT con secreto robusto | ❌ | Placeholder en `.env` actual |
| Tokens con expiración razonable | ✅ | 8h |
| Logout invalida sesión server-side | ❌ | Solo borra localStorage |
| RBAC aplicado server-side | ✅ | `authenticate` + `requireRole` |
| Usuario accede solo a sus propios datos | ✅ | `user/orders` filtra por `user_id` |
| Precio calculado en servidor | ❌ | Viene del cliente |
| Queries parametrizadas | ✅ | `mysql2` parameterized en todo |
| Output escapado (XSS) | ✅ | `escHtml` consistente |
| HTTPS habilitado | ✅ | Certbot + Nginx |
| Security headers (CSP, HSTS, X-Frame) | ❌ | CSP deshabilitada, sin headers en Nginx |
| CORS restringido | ❌ | Abierto a todos los orígenes |
| `trust proxy` configurado | ❌ | Rate limit inefectivo detrás de Nginx |
| Node non-root en Docker | ❌ | Proceso corre como `root` |
| Tests automatizados | ❌ | Ninguno |
| Sin CVEs críticos en dependencias | ✅ | Solo moderate/DoS |
| Credenciales fuera del repositorio | ✅ | `.env` en `.gitignore` |
| Paginación en endpoints de lista | ❌ | Devuelve todos los registros |

---

*Archivos auditados: 20 | Líneas analizadas: ~1,400 backend + ~900 frontend | Sin modificaciones al código*

**Acción inmediata:** Los dos hallazgos que deben corregirse antes de cualquier transacción real son **V-01** (precio del cliente) y **V-02** (`JWT_SECRET` placeholder). El resto puede abordarse en sprints posteriores por orden de severidad.
