# 01 — Entorno vulnerable: arquitectura y mapa de vulnerabilidades

## Stack
- **Node.js + Express** (servidor web, vistas EJS).
- **Sequelize** (ORM) + **MySQL 8**.
- Frontend server-rendered (mini-tienda "ShopLab") para interceptar peticiones reales.

## Servicios (ver `docker-compose.yml`)
- `app-vuln` (puerto **3000**): rutas en `app/src/routes/vulnerable.js`. Usuario de BD
  `app_root` con `ALL PRIVILEGES` + `FILE`. `multipleStatements: true`.
- `db` (MySQL): esquema `shopdb` con tablas `users`, `products`, `orders`, `secrets`.

## Modelo de datos
```
users(id, username, pass_plain, password_hash, email, role)
products(id, name, description, price, stock, category)
orders(id, user_id, product_id, quantity, total)
secrets(id, label, secret_value, api_token)   <- objetivo del volcado
```
Nota: `pass_plain` (texto plano) lo usa la app vulnerable; `password_hash` (bcrypt) lo
usa la app remediada. Ambas son malas/buenas prácticas contrastadas.

## Mapa de puntos de inyección

| # | Endpoint | Parámetro(s) | Contexto SQL | Técnicas aplicables |
|---|---|---|---|---|
| 1 | `POST /login` | `username`, `password` | string entre comillas | Auth bypass, Error, Boolean |
| 2 | `GET /?q=` | `q` | string dentro de `LIKE '%...%'` | **UNION**, Error, Boolean |
| 3 | `GET /?sort=&order=` | `sort`, `order` | **identificador** en `ORDER BY` | Boolean blind, identifier |
| 4 | `GET /products/:id` | `id` | **numérico** (sin comillas) | **Error-based**, Boolean, Time |
| 5 | `GET /api/products?minStock=` | `minStock` | numérico (en `literal()`) | **Time-based blind** |

## Consultas crudas generadas (visibles en el "modo debug")
- Login:
  `SELECT id, username, role FROM users WHERE username = '<u>' AND pass_plain = '<p>'`
- Búsqueda + orden:
  `SELECT id,name,description,price,stock,category FROM products WHERE name LIKE '%<q>%' ORDER BY <sort> <order>`
- Detalle:
  `SELECT ... FROM products WHERE id = <id>`
- API:
  `SELECT id,name,price,stock FROM products WHERE stock >= <minStock>`  (vía `literal()`)

En `app-vuln` el panel inferior muestra la consulta real ejecutada, útil para explicar
visualmente la concatenación durante la demo.

## Cómo seguir
- Explotación manual con Burp → `02-explotacion-manual-burp.md`
- Explotación automatizada con SQLMap → `03-explotacion-sqlmap.md`
