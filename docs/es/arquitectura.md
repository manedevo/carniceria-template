# Arquitectura

## Visión general

Carnicería Artesanal es una aplicación web de tres capas: un frontend estático servido por el mismo proceso Express que también expone una API REST, respaldado por una base de datos MariaDB. No hay paso de compilación, ni framework de frontend, ni ORM — cada capa es delgada y fácil de entender.

```
Navegador
  │
  │  GET /          →  index.html (estático)
  │  GET /admin/**  →  páginas HTML del panel (estáticas, protegidas por JWT en cliente)
  │  GET /assets/** →  CSS, JS, imágenes (estáticos)
  │  GET /api/**    →  API JSON
  ▼
Express (Node.js 20)
  ├── helmet()             cabeceras de seguridad
  ├── cors()               política CORS
  ├── express.json()       parser de cuerpo
  ├── express.static()     sirve public/
  │
  ├── /api/products        router público de productos (+ datos de promo)
  ├── /api/orders          router público de pedidos (vincula user_id si hay JWT)
  ├── /api/auth            register · login · me
  │
  ├── authenticate()  ──── middleware JWT (aplicado a todas las rutas siguientes)
  ├── requireRole()   ──── middleware RBAC
  │
  ├── /api/admin/products    solo admin
  ├── /api/admin/orders      admin + ventas
  ├── /api/admin/promotions  solo admin
  └── /api/user/orders       solo cliente
        │
        ▼
  Pool de conexiones mysql2
        │
        ▼
  MariaDB 11
```

En Docker Compose, los dos servicios (`app` y `db`) comparten una red bridge definida por el usuario. El contenedor de la app nunca expone el puerto 3306; solo la máquina anfitriona puede llegar a la app en el puerto 3000.

---

## Backend

### Punto de entrada — `backend/index.js`

Registra el middleware en orden:

1. `helmet()` — cabeceras HTTP seguras (CSP desactivado para permitir Google Fonts)
2. `cors()` — permisivo en desarrollo; ajusta la opción `origin` para producción
3. `express.json()` — parsea los cuerpos de las peticiones
4. `express.static(PUBLIC_DIR)` — sirve todo lo que hay bajo `public/`
5. Rutas de API públicas (products, orders, auth)
6. Rutas de API protegidas (admin/*, user/*)
7. Catch-all `*` — devuelve `index.html` para la navegación del lado del cliente

### Base de datos — `backend/src/config/database.js`

Usa `mysql2/promise` en modo pool (hasta 10 conexiones simultáneas). Todas las credenciales provienen de variables de entorno; el archivo no tiene secretos codificados.

### Middleware de autenticación — `backend/src/middleware/authenticate.js`

Lee la cabecera `Authorization: Bearer <token>`, verifica la firma del JWT (JSON Web Token) con `JWT_SECRET` y adjunta el payload decodificado (`id`, `email`, `role`, `name`) en `req.user`. Devuelve HTTP 401 si el token está ausente o es inválido.

### Middleware RBAC — `backend/src/middleware/requireRole.js`

Acepta una lista de roles permitidos. Devuelve HTTP 403 si `req.user.role` no está en la lista. Se aplica después de `authenticate`.

### Ruta de productos — `GET /api/products`

Construye una consulta `SELECT` dinámica con filtros opcionales `category` y `search`. Tras obtener los productos, enriquece cada uno con la promoción activa de mayor prioridad que le aplique (producto específico > categoría > todos), añadiendo los campos `promo_name`, `promo_type`, `promo_value`, `promo_price` y `promo_applies_to`. Todos los parámetros usan marcadores `?`.

> **Nota:** la búsqueda de promoción ejecuta actualmente una consulta por producto (patrón N+1). Aceptable para el catálogo actual; un único JOIN es la optimización recomendada para catálogos más grandes.

### Ruta de pedidos — `POST /api/orders`

Valida los campos requeridos, calcula el total en el servidor e inserta el pedido. Si hay un JWT válido en la cabecera `Authorization`, el pedido se vincula al usuario mediante `user_id`; los pedidos anónimos establecen `user_id = NULL` por retrocompatibilidad.

### Rutas admin

Todas las rutas bajo `/api/admin/*` aplican `authenticate → requireRole(...)` como middleware de router. Las rutas individuales pueden aplicar un `requireRole` más estricto — por ejemplo, `PUT /api/admin/orders/:id/status` requiere `admin` aunque el router permita `admin` y `ventas`.

---

## Frontend

Sin bundler, sin transpilador, sin `node_modules` en el cliente. Tres archivos JS cubren toda la UI:

### `public/assets/js/auth.js`

Cargado en todas las páginas. Gestiona el ciclo de vida del JWT en `localStorage`:

- `setToken` / `getToken` / `clearToken`
- `getUser()` — decodifica el payload del JWT y comprueba la expiración
- `apiFetch()` — envuelve `fetch` para inyectar automáticamente la cabecera `Authorization` y redirigir a `/login.html` en HTTP 401
- `requireAuth(roles)` — protege páginas admin/cuenta en el cliente; redirige si el token está ausente o el rol no está permitido
- `updateAuthNav()` — actualiza el enlace "MI CUENTA" del nav de la tienda

### `public/assets/js/main.js`

Lógica de la tienda:

- **`escHtml()`** — cada dato del servidor se escapa antes de insertarse en el DOM.
- **`Map` para el estado del carrito** — indexado por ID de producto; búsquedas O(1).
- **Delegación de eventos** — listeners únicos en `#productGrid` y contenedores del carrito.
- **Búsqueda con debounce** — retardo de 320 ms para evitar aluvión de llamadas a la API.
- **Renderizado de promos** — lee `promo_name`, `promo_price`, `promo_applies_to`; renderiza badges de descuento, precio original tachado y banner superior (solo para promos globales; las de categoría/producto muestran mensaje genérico).
- **Indicador de stock** — muestra "Quedan X kg/pieza" cuando `stock_enabled = 1`.

### `public/assets/js/admin.js`

Cargado solo en páginas admin. Proporciona:

- Renderizado de tablas para productos, pedidos y promociones
- Edición inline de precio y stock
- Helpers de apertura/cierre de modales
- `loadDashboard()` — consciente del rol: obtiene pedidos para todos los roles admin; obtiene productos y promociones solo para `admin` (ventas tiene esas tarjetas eliminadas)
- Actualización de estado de pedidos y expand/colapso de filas de detalle

### Imágenes de productos

Las imágenes están en `public/assets/img_realistas/`. La columna `image_url` en `products` almacena solo el nombre del archivo. El frontend añade `/assets/img_realistas/` para formar la URL. Los productos con `image_url = NULL` usan un fondo CSS neutro.

---

## Esquema de la base de datos

Cinco tablas (el orden de creación respeta las dependencias de claves foráneas):

**`users`**

| Columna         | Tipo                               | Notas                        |
|-----------------|------------------------------------|------------------------------|
| `id`            | INT UNSIGNED PK                    | Auto-incremento              |
| `email`         | VARCHAR(255) UNIQUE                |                              |
| `password_hash` | VARCHAR(255)                       | bcrypt, coste 12             |
| `role`          | ENUM(admin, ventas, cliente)     | Por defecto: cliente         |
| `name`          | VARCHAR(120)                       |                              |
| `phone`         | VARCHAR(30) NULL                   |                              |
| `active`        | TINYINT(1)                         | Flag de borrado lógico       |
| `created_at`    | TIMESTAMP                          |                              |

**`products`**

| Columna         | Tipo                               | Notas                              |
|-----------------|------------------------------------|------------------------------------|
| `id`            | INT UNSIGNED PK                    | Auto-incremento                    |
| `name`          | VARCHAR(120)                       |                                    |
| `category`      | ENUM(Ternera…Embutidos)            |                                    |
| `price`         | DECIMAL(8,2)                       | EUR por kg o por unidad            |
| `unit_type`     | ENUM(kg, pieza)                    | Por defecto: kg                    |
| `stock_qty`     | DECIMAL(10,3) NULL                 | NULL = sin límite definido         |
| `stock_enabled` | TINYINT(1)                         | Mostrar stock al cliente si es 1   |
| `note`          | VARCHAR(255) NULL                  | Descripción corta                  |
| `image_url`     | VARCHAR(255) NULL                  | Nombre de archivo en `img_realistas/` |
| `active`        | TINYINT(1)                         | Flag de borrado lógico             |
| `created_at`    | TIMESTAMP                          |                                    |

**`orders`**

| Columna          | Tipo                               | Notas                              |
|------------------|------------------------------------|------------------------------------|
| `id`             | INT UNSIGNED PK                    | Auto-incremento                    |
| `user_id`        | INT UNSIGNED NULL FK → users       | NULL = pedido anónimo              |
| `customer_name`  | VARCHAR(120)                       |                                    |
| `phone`          | VARCHAR(30)                        |                                    |
| `address`        | TEXT                               |                                    |
| `zone`           | VARCHAR(80)                        | Nombre de la zona de entrega       |
| `time_slot`      | VARCHAR(60)                        | Ventana horaria legible            |
| `payment_method` | VARCHAR(40)                        |                                    |
| `items`          | JSON                               | Array de {id, name, price, qty}    |
| `total`          | DECIMAL(10,2)                      | Calculado en el servidor           |
| `status`         | ENUM(pendiente…cancelado)          | Por defecto: pendiente             |
| `created_at`     | TIMESTAMP                          |                                    |
| `updated_at`     | TIMESTAMP                          | Actualizado automáticamente        |

**`promotions`**

| Columna      | Tipo                               | Notas                              |
|--------------|------------------------------------|------------------------------------|
| `id`         | INT UNSIGNED PK                    | Auto-incremento                    |
| `name`       | VARCHAR(120)                       | Nombre visible                     |
| `type`       | ENUM(porcentaje, precio_fijo)      |                                    |
| `value`      | DECIMAL(8,2)                       | 15 = 15 % o 15 EUR de descuento    |
| `applies_to` | ENUM(todos, categoria, producto)   | Alcance del descuento              |
| `category`   | VARCHAR(80) NULL                   | Usado cuando applies_to = categoria|
| `active`     | TINYINT(1)                         | Solo se aplican promos activas     |
| `starts_at`  | TIMESTAMP NULL                     | NULL = sin restricción de inicio   |
| `ends_at`    | TIMESTAMP NULL                     | NULL = sin caducidad               |
| `created_at` | TIMESTAMP                          |                                    |

**`promotion_products`** (tabla de unión)

| Columna         | Tipo             | Notas                              |
|-----------------|------------------|------------------------------------|
| `promotion_id`  | INT UNSIGNED FK  | → promotions(id) CASCADE DELETE    |
| `product_id`    | INT UNSIGNED FK  | → products(id) CASCADE DELETE      |

---

## Configuración Docker

`docker-compose.yml` define dos servicios:

- **`db`** — MariaDB 11. Monta `backend/database/schema.sql` en `docker-entrypoint-initdb.d/` para que se ejecute exactamente una vez en el primer arranque. Los datos persisten en el volumen nombrado `db_data`.
- **`app`** — Node.js. Depende de `db` con una condición `service_healthy`. Monta `public/` como bind mount para poder actualizar los assets estáticos sin reconstruir la imagen.

Ambos servicios comparten la red bridge `carniceria_net`. Ningún contenedor se ejecuta como root.

---

## Modelo de seguridad

La aplicación sigue un enfoque de defensa en profundidad:

1. **Transporte** — HTTPS forzado vía Nginx en producción; cabecera HSTS establecida por `helmet`.
2. **Autenticación** — Contraseñas hasheadas con bcrypt (coste 12). Login limitado a 10 intentos / 15 min por IP.
3. **Autorización** — JWT verificado en cada petición protegida en el servidor; rol comprobado por ruta. El `requireAuth` del cliente proporciona protección UX únicamente (no es un límite de seguridad real).
4. **Manejo de entrada** — Todos los parámetros SQL usan marcadores `?`. Toda salida HTML se escapa con `escHtml()`.
5. **Secretos** — Todas las credenciales en `.env` (`.gitignore` garantizado). `JWT_SECRET` debe ser de 64 bytes aleatorios.
