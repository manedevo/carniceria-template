# Carnicería Artesanal — Aplicación Web Full-Stack

Plataforma de pedidos lista para producción para una carnicería artesanal en Madrid. Los clientes navegan por el catálogo de productos en directo, construyen su carrito y envían pedidos a domicilio, todo desde una interfaz de una sola página sin dependencias externas ni frameworks pesados.

Desarrollado como proyecto personal de portafolio para demostrar desarrollo web de extremo a extremo: diseño de API REST, bases de datos relacionales, despliegue con Docker y JavaScript Vanilla limpio en el frontend.

---

## Qué hace

- **Catálogo de productos** con filtro por categoría y búsqueda en tiempo real
- **Carrito de compra** con añadir/eliminar y control de cantidades
- **Formulario de pedido** con zona de entrega, horario y método de pago
- **API REST** (Node.js + Express) respaldada por MariaDB
- **Documentación bilingüe** (inglés + español)
- **Despliegue en un comando** con Docker Compose o Vagrant

---

## Stack tecnológico

| Capa        | Tecnología                              |
|-------------|-----------------------------------------|
| Runtime     | Node.js 20 LTS                          |
| Framework   | Express 4                               |
| Base datos  | MariaDB 11 (pool mysql2/promise)        |
| Frontend    | JavaScript Vanilla (ES2020, sin build)  |
| Estilos     | CSS puro (variables, CSS Grid)          |
| Fuentes     | Google Fonts — Playfair Display + Inter |
| Contenedor  | Docker + Docker Compose v2              |
| Seguridad   | Helmet.js, consultas parametrizadas     |
| VM dev      | Vagrant + VirtualBox (Ubuntu 22.04)     |

---

## Estructura del proyecto

```
carniceria-template/
├── backend/
│   ├── index.js                  Punto de entrada Express
│   ├── Dockerfile
│   ├── package.json
│   ├── database/
│   │   └── schema.sql            Tablas + 30 productos de ejemplo
│   └── src/
│       ├── config/
│       │   └── database.js       Pool de conexiones mysql2
│       └── routes/
│           ├── products.js       GET /api/products, /api/products/categories
│           └── orders.js         POST /api/orders
├── public/                       Servido como estáticos por Express
│   ├── index.html
│   └── assets/
│       ├── css/main.css
│       ├── js/main.js
│       └── img/                  Deposita aquí las imágenes de productos
├── deployment/
│   ├── setup.sh                  Instalador automatizado para Linux
│   └── Vm_tests/
│       └── Vagrantfile           VM de pruebas local
├── docs/                         Documentación en inglés
├── docs/es/                      Documentación en español
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
cp .env.example .env        # edita al menos DB_PASSWORD
docker compose up -d --build
```

Abre [http://localhost:3000](http://localhost:3000).

El esquema y los datos de ejemplo se aplican automáticamente en el primer arranque.

---

## Inicio rápido (Vagrant — VM local)

¿No tienes Docker instalado? Levanta una VM Ubuntu completa:

```bash
cd deployment/Vm_tests
vagrant up          # aprovisiona todo (15–20 min en el primer arranque)
```

La app estará disponible en [http://localhost:8080](http://localhost:8080) desde tu máquina.

---

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

| Variable      | Por defecto     | Descripción                              |
|---------------|-----------------|------------------------------------------|
| `DB_HOST`     | `db`            | Host de MariaDB (usa `db` con Docker)    |
| `DB_PORT`     | `3306`          | Puerto de MariaDB                        |
| `DB_USER`     | `carniceria`    | Usuario de la base de datos              |
| `DB_PASSWORD` | _(requerido)_   | Contraseña de la base de datos           |
| `DB_NAME`     | `carniceria_db` | Nombre de la base de datos               |
| `PORT`        | `3000`          | Puerto HTTP en el que escucha la app     |
| `NODE_ENV`    | `production`    | Entorno de Node                          |

---

## Referencia de la API

### Productos

| Método | Endpoint                   | Descripción                                |
|--------|----------------------------|--------------------------------------------|
| GET    | `/api/products`            | Lista de productos activos (filtrable)     |
| GET    | `/api/products?category=X` | Filtrar por categoría                      |
| GET    | `/api/products?search=X`   | Búsqueda en nombre y nota del producto     |
| GET    | `/api/products/categories` | Categorías distintas activas               |

### Pedidos

| Método | Endpoint      | Descripción           |
|--------|---------------|-----------------------|
| POST   | `/api/orders` | Crear un nuevo pedido |

---

## Imágenes de productos

Deposita archivos `.jpg` o `.webp` en `public/assets/img/`. El nombre del archivo debe coincidir con la columna `image_url` en la tabla `products`. Los productos sin imagen usan un fondo neutro.

---

## Despliegue en producción

Consulta [docs/es/despliegue.md](docs/es/despliegue.md) para:

- Ejecutar el script de instalación automatizado en un VPS
- Configuración de proxy inverso Nginx
- SSL con Let's Encrypt y Certbot
- PM2 (opción sin Docker)
- Reglas de firewall

---

## Seguridad

- **Inyección SQL** — todas las consultas usan marcadores de posición `?` vía `mysql2`
- **XSS** — todos los datos del usuario pasan por `escHtml()` antes de insertarse en el DOM
- **Cabeceras HTTP** — `helmet()` establece `X-Frame-Options`, `X-Content-Type-Options`, etc.
- **Secretos** — las credenciales están en `.env`, nunca en el repositorio (`.gitignore`)

---

## Licencia

MIT — úsalo como quieras. Un enlace de vuelta es bienvenido pero no obligatorio.
