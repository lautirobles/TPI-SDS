# 06 — Remediación a nivel de código

Causa raíz: **datos del usuario que se convierten en código SQL**. La solución es
**separar datos de código** mediante consultas parametrizadas, y usar correctamente el
ORM. Comparación por endpoint (`routes/vulnerable.js` → `routes/secure.js`).

## 6.1 — Login

**Vulnerable** (interpolación + password comparado en SQL):
```js
const sql =
  "SELECT id, username, role FROM users " +
  "WHERE username = '" + username + "' AND pass_plain = '" + password + "'";
const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
```
**Remediado** (consulta parametrizada por el ORM + bcrypt en la app):
```js
const user = await User.findOne({ where: { username } });      // username = bind param
const ok = user && bcrypt.compareSync(password, user.password_hash);
```
Claves: el `username` nunca entra al texto SQL; la contraseña se verifica con **bcrypt**,
no comparando strings en la BD. Mensaje de error **genérico** (no revela si el usuario existe).

## 6.2 — Búsqueda (`q`)

**Vulnerable** (UNION-able):
```js
const sql = "SELECT ... FROM products WHERE name LIKE '%" + q + "%' ...";
```
**Remediado** (operador `Op.like`, valor como parámetro):
```js
const products = await Product.findAll({
  where: { name: { [Op.like]: '%' + q + '%' } },   // q viaja como bind param, Sequelize lo escapa
});
```
Alternativa con raw query segura:
```js
sequelize.query("SELECT ... WHERE name LIKE :q", { replacements: { q: '%'+q+'%' } });
```

## 6.3 — Orden (`sort` / `order`)  — el caso que el ORM NO parametriza

**Vulnerable** (identificador inyectable):
```js
const sql = "SELECT ... ORDER BY " + sort + " " + order;
```
**Remediado** (whitelist obligatoria — única defensa válida para identificadores):
```js
const SORT_WHITELIST  = new Set(['id','name','price','stock','category']);
const ORDER_WHITELIST = new Set(['ASC','DESC']);
const sort  = SORT_WHITELIST.has(req.query.sort)  ? req.query.sort  : 'id';
const order = ORDER_WHITELIST.has((req.query.order||'').toUpperCase())
  ? req.query.order.toUpperCase() : 'ASC';
const products = await Product.findAll({ order: [[sort, order]] });
```
> Un *prepared statement* NO puede parametrizar nombres de columna ni la dirección de
> orden. Por eso aquí la whitelist no es opcional.

## 6.4 — Detalle por id (contexto numérico)

**Vulnerable**:
```js
const sql = "SELECT ... FROM products WHERE id = " + id;   // numérico sin validar
```
**Remediado** (validación de tipo + consulta parametrizada):
```js
const id = Number.parseInt(req.params.id, 10);
if (!Number.isInteger(id) || id < 1) return res.status(400)...;
const product = await Product.findByPk(id);
```

## 6.5 — API minStock (uso de `literal()`)

**Vulnerable** (`literal()` con interpolación):
```js
const products = await Product.findAll({ where: literal('stock >= ' + minStock) });
```
**Remediado** (operador `Op.gte` + validación):
```js
const minStock = Number.parseInt(req.query.minStock, 10);
if (!Number.isInteger(minStock)) return res.status(400)...;
const products = await Product.findAll({ where: { stock: { [Op.gte]: minStock } } });
```

## 6.6 — Verificación de la remediación  [DEMOSTRADO]
Mismos payloads contra `:3001`:
- Login `admin' -- ` → **HTTP 401** (no hay bypass).
- `/?q=... UNION SELECT ...` → **0 resultados**, sin error (el payload es tratado como
  texto de búsqueda literal).
- `/products/1 AND extractvalue(...)` → se valida el id (parseInt=1) → sin inyección.

## 6.7 — Checklist de código seguro (Sequelize)
- [ ] Nunca `sequelize.query(\`...${x}...\`)`. Usar `replacements`/`bind`.
- [ ] Nunca `literal()`/`where()` con entrada del usuario.
- [ ] Filtros y comparaciones con operadores `Op` (`Op.like`, `Op.gte`, ...).
- [ ] Identificadores (ORDER BY, columnas) → **whitelist**.
- [ ] Validar tipos (enteros, longitudes, formato).
- [ ] Contraseñas con **bcrypt/argon2**, nunca comparadas en SQL ni en texto plano.
- [ ] Errores genéricos al usuario; el detalle va al log del servidor.
- [ ] Mantener Sequelize actualizado (ver CVEs en `00-ORM-y-sqli.md`).
