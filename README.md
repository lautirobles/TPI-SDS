# ShopLab — Laboratorio de SQL Injection sobre un ORM (Sequelize)

Trabajo Práctico Integrador — *Seguridad en el Desarrollo de Software*.

Aplicación web **deliberadamente vulnerable a SQL Injection** construida con **Node.js + Express + Sequelize (ORM) + MySQL**, acompañada de su **versión remediada** y de defensa de infraestructura (**mínimo privilegio** + **WAF ModSecurity/OWASP CRS**). El objetivo es estudiar SQLi en profundidad desde lo ofensivo y lo defensivo.

> ⚠️ **Advertencia:** el entorno es inseguro a propósito. Úsese solo en local, con fines educativos. No exponer a Internet.

---

## Tesis del trabajo: *un ORM no previene SQLi por sí solo*

Sequelize (como cualquier ORM) sólo protege **cuando se lo usa correctamente**. Este laboratorio demuestra los patrones reales de **mala praxis** que reintroducen SQLi aun usando un ORM:

- `sequelize.query(\`... ${input} ...\`)` → SQL crudo con interpolación.
- `Model.findAll({ where: literal(\`${input}\`) })` → `literal()` interpolado.
- `order: [[ input, 'ASC' ]]` → **inyección de identificador** en `ORDER BY` (un ORM **no puede** parametrizar nombres de columna).

La remediación muestra el uso correcto: *bind params* / `replacements`, operadores `Op`, **whitelist** de columnas, validación de tipos y `bcrypt`.

---

## Topología (Docker Compose)

| Servicio | URL | Rol | Usuario BD |
|---|---|---|---|
| `app-vuln` | http://localhost:3000 | App **vulnerable** desnuda | `app_root` (ALL + **FILE**) |
| `waf` | http://localhost:8080 | **ModSecurity + CRS** → proxy a la app vulnerable | — |
| `app-secure` | http://localhost:3001 | App **remediada** | `app_least` (**mínimo privilegio**) |
| `db` | localhost:3306 | MySQL 8 (esquema + seed + grants) | — |

Recorrido pedagógico: **3000** (explotación) → **8080** (WAF + evasión con tampers) → **3001** (remediación definitiva).

---

## Puesta en marcha

```bash
docker compose up -d --build      # levanta los 4 servicios
docker compose ps                 # verifica estado (db debe estar healthy)
docker compose logs -f app-vuln   # logs de la app vulnerable
```

Abrir en el navegador:
- http://localhost:3000 — entorno vulnerable (banner rojo)
- http://localhost:8080 — mismo sitio detrás del WAF
- http://localhost:3001 — entorno remediado (banner verde)

Apagar / resetear:
```bash
docker compose down        # detiene
docker compose down -v      # detiene y borra la BD (reinicia el seed)
```

### Usuarios de prueba (login)
| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Adm1n!Pass2024` | admin |
| `jlopez` | `juan1234` | user |
| `mgarcia` | `maria2024` | user |

---

## Puntos de entrada vulnerables (app-vuln)

| Endpoint | Parámetro | Técnica destacada | Mala praxis de ORM |
|---|---|---|---|
| `POST /login` | `username`, `password` | Auth bypass, error/boolean | `sequelize.query` interpolado; password comparado en SQL |
| `GET /?q=` | `q` | **UNION-based** (volcado) | interpolación en `sequelize.query` |
| `GET /?sort=&order=` | `sort`, `order` | **ORDER BY / identifier injection** | identificador no parametrizable |
| `GET /products/:id` | `id` | **Error-based** / boolean blind | interpolación en contexto numérico |
| `GET /api/products?minStock=` | `minStock` | **Time-based blind** (`SLEEP`) | `literal()` interpolado |

**Modo debug:** la app vulnerable muestra en pantalla la **consulta SQL cruda** ejecutada (panel violeta al pie), para *ver* cómo la entrada se concatena en el SQL. Se desactiva con `DEBUG_SQL=false`.

**Filtro ingenuo (blacklist):** poner `NAIVE_FILTER=true` en el servicio `app-vuln` del compose activa una blacklist de palabras; sirve para demostrar su evasión con *tampers* (ver `docs/05`).

---

## El informe (carpeta `docs/`)

| Archivo | Contenido |
|---|---|
| `00-ORM-y-sqli.md` | Por qué un ORM no previene SQLi; patrones de mala praxis; CVEs de Sequelize |
| `01-entorno-vulnerable.md` | Arquitectura, modelos y mapa de vulnerabilidades |
| `02-explotacion-manual-burp.md` | Explotación manual con Burp Suite (login bypass, UNION) |
| `03-explotacion-sqlmap.md` | SQLMap: level/risk, técnicas U/E/B/T, comandos por endpoint |
| `04-impacto.md` | Volcado de esquema/tablas, file R/W, intento de `--os-shell`, análisis por privilegio |
| `05-tampers-waf.md` | WAF (CRS), payloads bloqueados y evasión con tampers |
| `06-remediacion-codigo.md` | Antes/después del código (parametrización + ORM correcto) |
| `07-remediacion-infraestructura.md` | Mínimo privilegio y WAF |
| `08-conclusiones.md` | Conclusiones y checklist defensivo |

---

## Estructura del proyecto

```
.
├─ docker-compose.yml        # 4 servicios
├─ db/                       # 01-schema, 02-seed (bcrypt), 03-grants (privilegios)
├─ app/                      # Node + Express + Sequelize (modos vulnerable/secure)
│  └─ src/
│     ├─ routes/vulnerable.js   # anti-ejemplo intencional
│     ├─ routes/secure.js       # uso correcto del ORM
│     ├─ middleware/naiveFilter.js
│     ├─ db/ (sequelize.js, models/)
│     ├─ views/ (EJS) + public/style.css
│     └─ tools/genseed.js
├─ waf/                      # notas de ModSecurity + CRS
└─ docs/                     # el informe completo
```

---

## Puertos y escenarios (resumen)

| Puerto | Servicio | Escenario |
|---|---|---|
| 3000 | `app-vuln` | Vulnerable **desnuda** (explotación manual + SQLMap) |
| 3002 | `app-vuln-filter` | Vulnerable + **blacklist ingenua** (demo de tamper `lowercase`) |
| 8080 | `waf` | Vulnerable detrás de **ModSecurity + CRS** |
| 3001 | `app-secure` | **Remediada** (parametrización + mínimo privilegio) |

## Reproducir las pruebas automáticamente
```bash
bash evidencias/run-demo.sh | tee evidencias/salida.txt
```
Recorre: login bypass, UNION dump, error-based, time-based, ORDER BY injection,
impacto FILE (LOAD_FILE), evasión del filtro ingenuo, bloqueo del WAF y resistencia
de la app remediada.

## SQLMap (no incluido en el compose)
Instalarlo en el host (`pipx install sqlmap` o `git clone` del repo oficial) o usar una
distro de pentesting (Kali/Parrot). Apunta a `http://localhost:3000`. Comandos en
`docs/03-explotacion-sqlmap.md`.

## Troubleshooting
- **El WAF (:8080) responde 502 tras un `--build`:** nginx del WAF cachea la IP del
  backend. Si recreás `app-vuln`, reiniciá el WAF:
  ```bash
  docker compose restart waf
  ```
- **La BD no seedea de nuevo:** el volumen persiste. Para resetear:
  ```bash
  docker compose down -v && docker compose up -d --build
  ```
- **Puerto ocupado (3000/3001/3002/8080/3306):** cambiá el mapeo en `docker-compose.yml`.
