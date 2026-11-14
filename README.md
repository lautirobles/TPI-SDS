# ShopLab — Laboratorio de SQL Injection sobre un ORM (Sequelize)

Trabajo Práctico Integrador — *Seguridad en el Desarrollo de Software*.

Aplicación web **vulnerable a SQL Injection** construida con **Node.js + Express + Sequelize (ORM) + MySQL**, con su **versión remediada** y defensa de infraestructura (**mínimo privilegio** + **WAF ModSecurity/OWASP CRS**).

> ⚠️ **Advertencia:** entorno inseguro a propósito. Úsese solo en local, con fines educativos. No exponer a Internet.

---

## Tesis del trabajo: *un ORM no previene SQLi por sí solo*

Sequelize sólo protege **cuando se lo usa correctamente**. La app vulnerable usa el ORM
**mal** (`sequelize.query(\`...${input}...\`)`), reintroduciendo SQLi; la remediada lo usa
**bien** (parámetros/`Op`, validación, `bcrypt`).

## Las 2 vulnerabilidades (app vulnerable, :3000)

| # | Punto de entrada | Técnica | Impacto |
|---|---|---|---|
| 1 | **Login** `POST /login` (`username`/`password`) | Bypass de autenticación (`admin' --`) | Acceder a cuentas **sin conocer la contraseña** |
| 2 | **Buscador** `GET /?q=` | **UNION-based** | **Extraer datos** de la BD (users, secrets, ...) |

El resto del sitio (detalle de producto, ordenamiento) es **seguro** en ambas apps.

---

## Topología (Docker Compose)

| Servicio | URL | Rol | Usuario BD |
|---|---|---|---|
| `app-vuln` | http://localhost:3000 | App **vulnerable** (2 inyecciones) | `app_root` (ALL + **FILE**) |
| `waf` | http://localhost:8080 | **ModSecurity + CRS** → proxy a la app vulnerable | — |
| `app-secure` | http://localhost:3001 | App **remediada** | `app_least` (**mínimo privilegio**) |
| `db` | localhost:3306 | MySQL 8 (esquema + seed + grants) | — |

---

## Puesta en marcha

```bash
docker compose up -d --build      # levanta los 4 servicios
docker compose ps                 # db y app-vuln deben estar healthy
```

Abrir en el navegador:
- http://localhost:3000 — entorno **vulnerable** (banner rojo)
- http://localhost:8080 — la vulnerable **detrás del WAF**
- http://localhost:3001 — entorno **remediado** (banner verde)

Apagar / resetear:
```bash
docker compose down          # detiene
docker compose down -v        # detiene y borra la BD (reinicia el seed)
```

### Usuarios de prueba (login)
| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Adm1n!Pass2024` | admin |
| `jlopez` | `juan1234` | user |
| `mgarcia` | `maria2024` | user |

**Modo debug:** la app vulnerable muestra en pantalla la **consulta SQL cruda** ejecutada
(panel tipo terminal al pie), para *ver* cómo la entrada se concatena en el SQL.

---

## Reproducir las pruebas automáticamente
```bash
bash evidencias/run-demo.sh | tee evidencias/salida.txt
```
Recorre: login bypass, extracción UNION (users + secrets), resistencia de la app segura,
impacto del privilegio FILE (`LOAD_FILE`) y bloqueo del WAF.

## SQLMap (no incluido en el compose)
Instalarlo en el host (`pipx install sqlmap` o `git clone` del repo oficial) o usar
Kali/Parrot. Apunta a `http://localhost:3000`. Comandos en
[docs/03-explotacion-sqlmap.md](docs/03-explotacion-sqlmap.md).

---

## El informe (carpeta `docs/`)

| Archivo | Contenido |
|---|---|
| [00](docs/00-ORM-y-sqli.md) | Por qué un ORM no previene SQLi; CVEs de Sequelize |
| [01](docs/01-entorno-vulnerable.md) | Arquitectura y las 2 vulnerabilidades |
| [02](docs/02-explotacion-manual-burp.md) | Explotación manual con Burp (login bypass, UNION) |
| [03](docs/03-explotacion-sqlmap.md) | SQLMap: level/risk, técnicas, comandos |
| [04](docs/04-impacto.md) | Volcado, file R/W, `--os-shell`, análisis por privilegio |
| [05](docs/05-tampers-waf.md) | WAF (CRS), bloqueo y tampers |
| [06](docs/06-remediacion-codigo.md) | Antes/después del código |
| [07](docs/07-remediacion-infraestructura.md) | Mínimo privilegio y WAF |
| [08](docs/08-conclusiones.md) | Conclusiones |

---

## Estructura del proyecto

```
.
├─ docker-compose.yml        # 4 servicios: db, app-vuln, waf, app-secure
├─ db/                       # 01-schema, 02-seed (bcrypt), 03-grants (privilegios)
├─ app/                      # Node + Express + Sequelize (modos vulnerable/secure)
│  └─ src/
│     ├─ routes/vulnerable.js   # 2 vulnerabilidades (login + buscador)
│     ├─ routes/secure.js       # uso correcto del ORM
│     ├─ db/ (sequelize.js, models/)
│     ├─ views/ (EJS) + public/style.css   # frontend
│     └─ tools/genseed.js
├─ waf/                      # notas de ModSecurity + CRS
├─ docs/                     # el informe completo
└─ evidencias/              # run-demo.sh + salida.txt
```

## Troubleshooting
- **El WAF (:8080) responde 502 tras un `--build`:** nginx del WAF cachea la IP del
  backend. Si recreás `app-vuln`, reiniciá el WAF: `docker compose restart waf`.
- **La BD no re-seedea:** el volumen persiste → `docker compose down -v && docker compose up -d --build`.
- **Puerto ocupado (3000/3001/8080/3306):** cambiá el mapeo en `docker-compose.yml`.
