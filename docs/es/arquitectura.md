# Arquitectura

## Visión general

Carnicería Artesanal es una aplicación web de tres capas: un frontend estático servido por el mismo proceso Express que también expone una API REST, respaldado por una base de datos MariaDB. No hay paso de compilación, ni framework de frontend, ni ORM — cada capa es delgada y fácil de entender.

```
Navegador
  │
  │  GET /  →  index.html (estático)
  │  GET /assets/**  →  CSS, JS, imágenes (estático)
  │  GET /api/**     →  API JSON
  ▼
Express (Node.js 20)
  ├── helmet()          cabeceras de seguridad
  ├── express.static()  sirve public/
  ├── /api/products     router de productos
  └── /api/orders       router de pedidos
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
5. Rutas de la API
6. Catch-all `*` — devuelve `index.html` para la navegación del lado del cliente

### Base de datos — `backend/src/config/database.js`

Usa `mysql2/promise` en modo pool (hasta 10 conexiones simultáneas). Todas las credenciales provienen de variables de entorno; el archivo no tiene secretos codificados.

### Ruta de productos — `GET /api/products`

Construye una consulta `SELECT` dinámica:

- Filtro base: `active = 1`
- Filtro opcional `category`: añadido con `AND category = ?`
- Filtro opcional `search`: `AND (name LIKE ? OR note LIKE ?)`
- `ORDER BY FIELD(category, …), name` garantiza un orden de visualización determinista (Ternera → Cerdo → Pollo → Cordero → Embutidos)

Todos los parámetros se pasan como marcadores `?` — nunca interpolados en la cadena SQL.

### Ruta de pedidos — `POST /api/orders`

Valida que los campos requeridos estén presentes, calcula el total del pedido en el servidor (nunca confiando en el total del cliente), serializa `items` como JSON e inserta una única fila.

---

## Frontend

Un único archivo HTML carga un archivo CSS y un archivo JS. Sin bundler, sin transpilador, sin `node_modules` en el cliente.

### `public/assets/js/main.js`

Decisiones de diseño clave:

- **`escHtml()`** — cada dato devuelto por el servidor se escapa antes de insertarse en el DOM. No hay `innerHTML` con valores crudos de la API en ningún lugar.
- **`Map` para el estado del carrito** — indexado por ID de producto; búsquedas O(1) e iteración limpia con `forEach`.
- **Delegación de eventos** — un único listener en `#productGrid` gestiona todos los clics de "añadir al carrito"; igual para los controles de cantidad del carrito.
- **Búsqueda con debounce** — retardo de 320 ms en el evento `input` para evitar un aluvión de llamadas a la API mientras el usuario escribe.
- **`Intl.NumberFormat`** — formato de euros con localización (`es-ES`, EUR) sin ninguna librería.

### Imágenes de productos

Las imágenes están en `public/assets/img/`. La columna `image_url` en `products` almacena solo el nombre del archivo (ej. `solomillo.jpg`). El frontend añade `/assets/img/` para formar la URL, de modo que la imagen es servida por `express.static` como cualquier otro asset. Los productos con `image_url` igual a `NULL` usan un color de fondo CSS neutro.

---

## Esquema de la base de datos

Dos tablas:

**`products`**

| Columna     | Tipo                  | Notas                                    |
|-------------|-----------------------|------------------------------------------|
| `id`        | INT UNSIGNED PK       | Auto-incremento                          |
| `name`      | VARCHAR(120)          | Nombre visible                           |
| `category`  | ENUM                  | Ternera / Cerdo / Pollo / Cordero / Embutidos |
| `price`     | DECIMAL(8,2)          | EUR por kg                               |
| `note`      | VARCHAR(255) NULL     | Descripción corta                        |
| `image_url` | VARCHAR(255) NULL     | Nombre de archivo en `public/assets/img/`|
| `active`    | TINYINT(1)            | Flag de borrado lógico                   |
| `created_at`| TIMESTAMP             | Asignado automáticamente al insertar     |

**`orders`**

| Columna          | Tipo                  | Notas                              |
|------------------|-----------------------|------------------------------------|
| `id`             | INT UNSIGNED PK       | Auto-incremento                    |
| `customer_name`  | VARCHAR(120)          |                                    |
| `phone`          | VARCHAR(30)           |                                    |
| `address`        | TEXT                  |                                    |
| `zone`           | VARCHAR(80)           | Nombre de la zona de entrega       |
| `time_slot`      | VARCHAR(60)           | Ventana horaria legible            |
| `payment_method` | VARCHAR(40)           | Efectivo / Bizum / Tarjeta / etc.  |
| `items`          | JSON                  | Array de `{id, name, price, qty}`  |
| `total`          | DECIMAL(10,2)         | Calculado en el servidor           |
| `status`         | ENUM                  | pendiente → confirmado → entregado |
| `created_at`     | TIMESTAMP             |                                    |
| `updated_at`     | TIMESTAMP             | Actualizado automáticamente        |

---

## Configuración Docker

`docker-compose.yml` define dos servicios:

- **`db`** — MariaDB 11. Monta `backend/database/schema.sql` en `docker-entrypoint-initdb.d/` para que se ejecute exactamente una vez en el primer arranque. Los datos persisten en el volumen nombrado `db_data`.
- **`app`** — Node.js. Depende de `db` con una condición `service_healthy`. Monta `public/` como bind mount para poder actualizar los assets estáticos sin reconstruir la imagen.

Ambos servicios comparten la red bridge `carniceria_net`. Ningún contenedor se ejecuta como root.
