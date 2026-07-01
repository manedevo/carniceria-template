# Carnicería Artesanal — Aplicación Web Full-Stack

Plataforma de pedidos lista para producción para una carnicería artesanal en Madrid. Los clientes navegan por el catálogo, construyen su carrito y envían pedidos a domicilio. Los clientes autenticados pueden consultar su historial de pedidos. Un panel de administración permite al propietario gestionar productos, stock, promociones y pedidos con control de acceso basado en roles.

Desarrollado como proyecto personal de portafolio para demostrar desarrollo web de extremo a extremo: diseño de API REST, autenticación JWT (JSON Web Token), RBAC (Control de Acceso Basado en Roles), bases de datos relacionales, despliegue con Docker y JavaScript Vanilla limpio en el frontend.

---

## Qué hace

- **Catálogo de productos** con filtro por categoría, búsqueda en tiempo real y badges de promoción en vivo
- **Carrito de compra** con añadir/eliminar y control de cantidades
- **Formulario de pedido** con zona de entrega, horario y método de pago
- **Autenticación** — registro e inicio de sesión de clientes mediante JWT
- **Control de acceso por roles** — tres roles: `admin`, `ventas`, `cliente`
- **Panel de administración** — gestión de productos (CRUD + stock), pedidos (flujo de estados) y promociones
- **Motor de promociones** — descuentos por porcentaje o precio fijo, aplicables a toda la tienda, una categoría o productos concretos; reflejados en tiempo real en el escaparate
- **Cuenta de cliente** — página de historial de pedidos para clientes autenticados
- **API REST** (Node.js + Express) respaldada por MariaDB
- **Documentación bilingüe** (inglés + español)
- **Despliegue en un comando** con Docker Compose o Vagrant

---

## Stack tecnológico

| Capa        | Tecnología                                        |
|-------------|---------------------------------------------------|
| Runtime     | Node.js 20 LTS                                    |
| Framework   | Express 4                                         |
| Base datos  | MariaDB 11 (pool mysql2/promise)                  |
| Auth        | bcryptjs · jsonwebtoken · express-rate-limit      |
| Frontend    | JavaScript Vanilla (ES2020, sin build)            |
| Estilos     | CSS puro (variables, CSS Grid)                    |
| Fuentes     | Google Fonts — Cormorant Garamond + Montserrat    |
| Contenedor  | Docker + Docker Compose v2                        |
| Seguridad   | Helmet.js, consultas parametrizadas, bcrypt coste 12 |
| VM dev      | Vagrant + VirtualBox / VMware (Ubuntu 22.04)      |

---

## Estructura del proyecto

```
carniceria-template/
├── backend/
│   ├── index.js                    Punto de entrada Express — registra todas las rutas
│   ├── Dockerfile
│   ├── package.json
│   ├── database/
│   │   └── schema.sql              5 tablas + 30 productos de ejemplo
│   ├── scripts/
│   │   └── create-admin.js         Herramienta CLI para crear el primer usuario admin
│   └── src/
│       ├── config/
│       │   └── database.js         Pool de conexiones mysql2
│       ├── middleware/
│       │   ├── authenticate.js     Middleware de verificación JWT
│       │   ├── requireRole.js      Middleware de control de roles RBAC
│       │   └── hasPermission.js    Comprobación de permisos granulares por usuario (rol ventas)
│       └── routes/
│           ├── products.js         GET /api/products (público, incluye datos de promo)
│           ├── orders.js           POST /api/orders (público, vincula user_id si hay sesión)
│           ├── auth.js             POST /register, /login · GET /me
│           ├── admin/
│           │   ├── products.js     CRUD — admin + ventas (cambio de precio solo admin)
│           │   ├── orders.js       Todos los pedidos — admin + ventas; cambio de estado sujeto a permiso
│           │   ├── promotions.js   Gestión de promociones — solo admin
│           │   └── users.js        Gestión de usuarios (CRUD + rol/permisos) — solo admin
│           └── user/
│               └── orders.js       Historial del cliente — solo cliente autenticado
├── public/                         Servido como estáticos por Express
│   ├── index.html                  Tienda (banner promo, badges de stock, nav con auth)
│   ├── login.html
│   ├── registro.html
│   ├── mi-cuenta.html              Historial de pedidos del cliente
│   ├── admin/
│   │   ├── index.html              Dashboard (estadísticas + últimos pedidos)
│   │   ├── productos.html          Tabla de productos con edición inline
│   │   ├── pedidos.html            Lista de pedidos con filtros y selector de estado
│   │   ├── promociones.html        Creador de promociones
│   │   └── usuarios.html           Gestión de usuarios (roles + permisos granulares)
│   └── assets/
│       ├── css/
│       │   ├── main.css            Estilos de la tienda
│       │   └── admin.css           Estilos del panel admin
│       ├── js/
│       │   ├── main.js             Lógica de la tienda (carrito, productos, promos)
│       │   ├── auth.js             Helpers JWT (localStorage, apiFetch, requireAuth)
│       │   └── admin.js            Lógica del panel admin (todas las páginas)
│       └── img_realistas/          Imágenes de productos
├── backend/tests/                  Tests de integración con Vitest + Supertest
│   ├── auth.test.js
│   ├── admin-products.test.js
│   ├── admin-orders.test.js
│   ├── admin-users.test.js
│   ├── roles.test.js
│   ├── dashboard.test.js
│   └── orders.test.js
├── backend/vitest.config.mjs
├── deployment/
│   ├── setup/setup_sh/setup.sh     Instalador automatizado para VPS Linux
│   └── Vm_tests/
│       └── Vagrantfile             VM de pruebas local, Linux/macOS (detecta VirtualBox / VMware)
├── docs/                           Documentación en inglés
│   ├── architecture.md
│   └── deployment.md
├── docs/es/                        Documentación en español
│   ├── arquitectura.md
│   └── despliegue.md
├── tasks/                          Planificación de desarrollo (excluido por .gitignore)
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Inicio rápido (Docker)

**Requisitos:** Docker Engine 24+ y Docker Compose v2.

```bash
git clone https://github.com/manedevo/carniceria-template.git
cd carniceria-template
cp .env.example .env
```

Edita `.env`: establece `DB_PASSWORD` y genera un `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# pega el resultado como JWT_SECRET en .env
```

Luego arranca:

```bash
docker compose up -d --build
```

Abre [http://localhost:3000](http://localhost:3000).

### Crear el primer usuario admin

Con los contenedores en marcha:

```bash
docker compose exec app \
  node scripts/create-admin.js admin@carniceria.es MiContraseña123 "Nombre Admin"
```

Luego inicia sesión en [http://localhost:3000/login.html](http://localhost:3000/login.html).

---

## Inicio rápido (Vagrant — VM local)

¿Sin Docker? Levanta una VM Ubuntu completa. Solo Linux/macOS — con Vagrant ya instalado:

```bash
cd deployment/Vm_tests
vagrant up
```

El Vagrantfile detecta automáticamente el hipervisor. El primer arranque tarda 15–20 minutos. La app estará en [http://localhost:8080](http://localhost:8080).

---

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

| Variable          | Por defecto     | Descripción                                              |
|-------------------|-----------------|----------------------------------------------------------|
| `DB_HOST`         | `db`            | Host de MariaDB (usa `db` con Docker)                    |
| `DB_PORT`         | `3306`          | Puerto de MariaDB                                        |
| `DB_USER`         | `carniceria`    | Usuario de la base de datos                              |
| `DB_PASSWORD`     | _(requerido)_   | Contraseña de la base de datos                           |
| `DB_NAME`         | `carniceria_db` | Nombre de la base de datos                               |
| `PORT`            | `3000`          | Puerto HTTP en el que escucha la app                     |
| `NODE_ENV`        | `production`    | Entorno de Node                                          |
| `JWT_SECRET`      | _(requerido)_   | Secreto aleatorio de 64 bytes — **generar, nunca reutilizar** |
| `JWT_EXPIRES_IN`  | `8h`            | Duración del token                                       |
| `BCRYPT_ROUNDS`   | `12`            | Factor de trabajo bcrypt (mayor = más lento = más seguro)|

---

## Referencia de la API

### Endpoints públicos

| Método | Endpoint                    | Descripción                                              |
|--------|-----------------------------|----------------------------------------------------------|
| GET    | `/api/products`             | Productos activos con campos de promo opcionales         |
| GET    | `/api/products?category=X`  | Filtrar por categoría                                    |
| GET    | `/api/products?search=X`    | Búsqueda en nombre y nota                                |
| GET    | `/api/products/categories`  | Categorías distintas activas                             |
| POST   | `/api/orders`               | Crear pedido (vincula user_id si hay JWT en cabecera)    |

### Endpoints de autenticación

| Método | Endpoint              | Descripción                        |
|--------|-----------------------|------------------------------------|
| POST   | `/api/auth/register`  | Registrar cuenta de cliente        |
| POST   | `/api/auth/login`     | Iniciar sesión — devuelve JWT      |
| GET    | `/api/auth/me`        | Datos del usuario actual (requiere JWT) |

### Endpoints admin — requieren `Authorization: Bearer <token>`

| Método | Endpoint                          | Roles                                                        |
|--------|-----------------------------------|----------------------------------------------------------------|
| GET    | `/api/admin/products`             | admin, ventas                                                   |
| POST   | `/api/admin/products`             | admin                                                           |
| PUT    | `/api/admin/products/:id`         | admin, ventas (ventas no puede cambiar `price`)                 |
| DELETE | `/api/admin/products/:id`         | admin                                                           |
| PATCH  | `/api/admin/products/:id/stock`   | admin, ventas con permiso `change_stock`                        |
| GET    | `/api/admin/orders`               | admin, ventas                                                   |
| GET    | `/api/admin/orders/:id`           | admin, ventas                                                   |
| PUT    | `/api/admin/orders/:id/status`    | admin, ventas con permiso `change_order_status`                 |
| GET    | `/api/admin/promotions`           | admin                                                           |
| POST   | `/api/admin/promotions`           | admin                                                           |
| PUT    | `/api/admin/promotions/:id`       | admin                                                           |
| DELETE | `/api/admin/promotions/:id`       | admin                                                           |
| GET    | `/api/admin/users`                | admin                                                           |
| POST   | `/api/admin/users`                | admin — crea un usuario de cualquier rol                        |
| PUT    | `/api/admin/users/:id`            | admin — actualiza nombre/teléfono/rol/activo/permisos (no su propio rol) |
| DELETE | `/api/admin/users/:id`            | admin — borrado físico (no su propia cuenta); pedidos quedan con `user_id = NULL` |

**Permisos granulares para `ventas`:** cada usuario `ventas` tiene una columna JSON opcional `permissions` (`change_order_status`, `change_stock`, `change_prices`). Si no está definida, los valores por defecto son `change_order_status: true, change_stock: true, change_prices: false`. `admin` siempre evita esta comprobación.

### Endpoints de cliente — requieren JWT con rol `cliente`

| Método | Endpoint               | Descripción                               |
|--------|------------------------|-------------------------------------------|
| GET    | `/api/user/orders`     | Pedidos del cliente autenticado           |
| GET    | `/api/user/orders/:id` | Detalle de un pedido (verifica propiedad) |

---

## Matriz de roles (RBAC)

| Funcionalidad                          | admin | ventas                      | cliente | anónimo |
|-----------------------------------------|-------|-----------------------------|---------|---------|
| Navegar catálogo / añadir al carrito     | ✓     | ✓                           | ✓       | ✓       |
| Realizar un pedido                      | ✓     | ✓                           | ✓       | ✓       |
| Ver historial propio                    | —     | —                           | ✓       | —       |
| Ver todos los pedidos                   | ✓     | ✓                           | —       | —       |
| Cambiar estado de pedido                | ✓     | si tiene `change_order_status` | —    | —       |
| Gestionar productos (nombre/categoría/etc.) | ✓ | ✓ (no `price`)             | —       | —       |
| Gestionar stock                         | ✓     | si tiene `change_stock`     | —       | —       |
| Gestionar promociones                   | ✓     | —                           | —       | —       |
| Gestionar usuarios                      | ✓     | —                           | —       | —       |

Los permisos de `ventas` (`change_order_status`, `change_stock`, `change_prices`) son por usuario y los asigna un admin desde el panel "Usuarios". Valores por defecto si no se definen: los dos primeros en `true`, `change_prices` en `false` (y el cambio de precio está bloqueado siempre, ver referencia de la API arriba).

---

## Imágenes de productos

Deposita archivos `.jpg` o `.webp` en `public/assets/img_realistas/`. El nombre del archivo debe coincidir con la columna `image_url` en la tabla `products`. Los productos sin imagen usan un fondo neutro.

---

## Despliegue en producción

Consulta [docs/es/despliegue.md](docs/es/despliegue.md) para:

- Ejecutar el script de instalación automatizado en un VPS
- Configuración de proxy inverso Nginx + SSL con Let's Encrypt
- Creación del usuario admin en el primer arranque
- PM2 (opción sin Docker)
- Reglas de cortafuegos y cron de copias de seguridad

---

## Seguridad

| Medida                     | Implementación                                                       |
|----------------------------|----------------------------------------------------------------------|
| Hash de contraseñas        | bcrypt coste 12 — nunca MD5 ni SHA plano                             |
| Sesiones sin estado        | JWT firmado con secreto aleatorio de 64 bytes, expira en 8 h        |
| Protección fuerza bruta    | `express-rate-limit`: 10 intentos de login / 15 min por IP          |
| Inyección SQL              | Todos los parámetros usan marcadores `?` vía `mysql2`               |
| XSS                        | `escHtml()` aplicado a cada valor del servidor antes de insertar en el DOM |
| Cabeceras de seguridad     | `helmet()` — X-Frame-Options, X-Content-Type-Options, HSTS, etc.   |
| Secretos                   | `.env` nunca en el repositorio (`.gitignore`)                       |
| Rutas admin                | JWT verificado en el servidor en cada petición; rol comprobado por ruta |

---

## Ejecutar los tests

Los tests de integración (Vitest + Supertest) cubren auth, RBAC, productos/pedidos/usuarios admin y el dashboard.

```bash
cd backend
npm test          # ejecución única
npm run test:watch
```

---

## Autor

**Manuel Reyes Vielma**
Desarrollador full-stack — [GitHub](https://github.com/manedevo) · [LinkedIn](https://linkedin.com/in/manedevo) · [maneprojects.es](https://maneprojects.es)

---

## Licencia

MIT — úsalo como quieras. Consulta [LICENSE](LICENSE) para el texto completo (incluye una petición de cortesía de avisar sobre mejoras significativas, no una condición legal de uso).
