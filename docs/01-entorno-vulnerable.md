# 01 — Entorno vulnerable: arquitectura y vulnerabilidades

## Stack
- **Node.js + Express** (servidor web, vistas EJS).
- **Sequelize** (ORM) + **MySQL 8**.
- Frontend server-rendered (mini-tienda "ShopLab") para interceptar peticiones reales.

## Servicios (ver `docker-compose.yml`)
- `app-vuln` (puerto **3000**): rutas en `app/src/routes/vulnerable.js`. Usuario de BD
  `app_root` con `ALL PRIVILEGES` + `FILE`. `multipleStatements: true`.
- `waf` (puerto **8080**): ModSecurity + OWASP CRS como reverse proxy de la app vulnerable.
- `app-secure` (puerto **3001**): rutas en `routes/secure.js`, usuario `app_least` (mínimo privilegio).
- `db` (MySQL): esquema `shopdb` con tablas `users`, `products`, `orders`, `secrets`.

## Modelo de datos
```
users(id, username, pass_plain, password_hash, email, role)
products(id, name, description, price, stock, category)
orders(id, user_id, product_id, quantity, total)
secrets(id, label, secret_value, api_token)   <- objetivo del volcado
```
`pass_plain` (texto plano) lo usa la app vulnerable; `password_hash` (bcrypt) lo usa la
app remediada.

## Las DOS vulnerabilidades (y solo esas)

| # | Endpoint | Parámetro | Contexto SQL | Técnica | Objetivo |
|---|---|---|---|---|---|
| 1 | `POST /login` | `username`, `password` | string entre comillas | Bypass de autenticación | Entrar sin contraseña |
| 2 | `GET /?q=` | `q` | string dentro de `LIKE '%...%'` | **UNION-based** | Extraer datos de la BD |

### Consultas crudas generadas (visibles en el "modo debug")
- Login:
  `SELECT id, username, role FROM users WHERE username = '<u>' AND pass_plain = '<p>'`
- Buscador:
  `SELECT id,name,description,price,stock,category FROM products WHERE name LIKE '%<q>%' ORDER BY <sort> <order>`

> En el login, ambos campos se concatenan → `admin' -- ` o `' OR '1'='1' -- ` evaden el
> password. En el buscador, `q` se interpola → permite cerrar el string y agregar
> `UNION SELECT ...` para traer columnas de otras tablas.

## Lo que NO es vulnerable (a propósito)
Para acotar el laboratorio a 2 inyecciones, el resto se implementó de forma segura en
**ambas** apps:
- **Detalle de producto** `GET /products/:id`: validación de tipo + `findByPk(id)`.
- **Ordenamiento** `sort`/`order`: **whitelist** de columnas y dirección (un ORM no
  parametriza identificadores; ver `06-remediacion-codigo.md`).

## Cómo seguir
- Explotación manual con Burp → `02-explotacion-manual-burp.md`
- Explotación automatizada con SQLMap → `03-explotacion-sqlmap.md`
