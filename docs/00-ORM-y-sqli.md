# 00 — Por qué un ORM NO previene SQL Injection

## Idea central
Un ORM (Object-Relational Mapper) como **Sequelize** mapea objetos a filas y, en su
uso normal, genera **consultas parametrizadas**: el valor del usuario viaja como
*bind parameter* separado del texto SQL. Eso previene SQLi… **solo si se lo usa así**.

El ORM **no es una barrera mágica**. Ofrece varias "puertas traseras" hacia SQL crudo
que, mal usadas, reintroducen exactamente la misma vulnerabilidad que tendríamos con
concatenación manual de strings.

## ¿Cuándo se parametriza y cuándo no?

| Uso de Sequelize | ¿Seguro? | Por qué |
|---|---|---|
| `Model.findAll({ where: { name } })` | ✅ | `name` se envía como bind param |
| `Model.findOne({ where: { id } })` | ✅ | id parametrizado |
| `sequelize.query(sql, { replacements })` | ✅ | `:placeholder` / `?` parametrizados |
| `sequelize.query(\`... ${x} ...\`)` | ❌ | **interpolación**: `x` es parte del texto SQL |
| `where: literal(\`col = ${x}\`)` | ❌ | `literal()` inyecta SQL crudo sin escapar |
| `order: [[ userInput, 'ASC' ]]` | ❌ | **identificador**: los ORM NO parametrizan nombres de columna/orden |
| `Model.findAll({ where: userJson })` | ⚠️ | *operator injection* si el JSON del usuario llega sin filtrar |

### El caso estructural: identificadores (ORDER BY, nombres de columna/tabla)
El protocolo de *prepared statements* permite parametrizar **valores**, nunca
**identificadores** (nombres de columna, tabla, dirección de orden). Por eso, aunque
usemos el ORM "bien", un `ORDER BY ${columna}` tomada del usuario **no se puede**
parametrizar: la única defensa es una **whitelist** explícita. Es la clase de SQLi
más fácil de pasar por alto porque "parece" que el ORM nos cubre.

## Patrones de mala praxis en este laboratorio

**Explotables (las 2 vulnerabilidades del lab)** — `routes/vulnerable.js`:
1. **Raw query interpolada en el login** → `WHERE username='${u}' AND pass_plain='${p}'`.
   Comparar credenciales dentro del SQL habilita el *auth bypass* (`admin' -- `).
2. **Raw query interpolada en el buscador** → `WHERE name LIKE '%${q}%'`, permite
   `UNION SELECT` para extraer datos.

**De referencia (documentados, pero implementados de forma segura en el lab):**
3. **`literal()` interpolado** — `Model.findAll({ where: literal(\`...${x}\`) })`.
4. **Inyección de identificador en `ORDER BY`** — `order:[[literal(sort), order]]`; se
   mitiga con **whitelist** (ningún ORM parametriza identificadores). Ver `06`.

## CVEs reales de Sequelize (respaldo teórico)
No son solo malas prácticas del desarrollador; el propio ORM tuvo fallas explotables:

- **CVE-2019-10748** — *SQL injection* a través de claves de atributos no saneadas
  en operadores (`attributes` / claves controladas por el usuario).
- **CVE-2019-10749** — *operator injection*: JSON controlado por el usuario podía
  introducir operadores (`$gt`, etc.) y alterar la consulta (relacionado con el
  cambio al uso de `Symbol` para operadores, `Op`).
- **CVE-2023-22578 / 22579 / 25813** (versiones 6.x) — fallas de inyección por
  nombres de atributos / *replacements* mal procesados, corregidas endureciendo el
  parser de identificadores y *bind*.

> **Lección:** mantener el ORM actualizado **y** usar siempre `Op`, `replacements`/
> `bind` y whitelists. Las dos cosas: versión parcheada *y* uso correcto.

## Conclusión del capítulo
El ORM reduce la superficie de SQLi, pero la elimina **solo** si el desarrollador
evita el SQL crudo interpolado, no usa `literal()` con entrada del usuario, aplica
whitelists para identificadores y valida tipos. La remediación (capítulo 06) muestra
cada contramedida.
