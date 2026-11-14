# 07 — Remediación a nivel de infraestructura

La corrección del código (cap. 06) elimina la causa raíz. La infraestructura aporta
**defensa en profundidad**: reduce el impacto si algo falla y bloquea ataques conocidos.

## 7.1 — Principio de mínimo privilegio (usuario de BD)

Archivo: `db/03-grants.sql`.

| | `app_root` (app vulnerable) | `app_least` (app remediada) |
|---|---|---|
| Privilegios | `ALL PRIVILEGES ON shopdb.*` + **`FILE`** + `PROCESS` | `SELECT, INSERT, UPDATE, DELETE ON shopdb.*` |
| `--is-dba` | True | False |
| `FILE` (LOAD_FILE / OUTFILE) | Sí | **No** |
| Acceso a otros esquemas | Sí | No |
| `multipleStatements` (driver) | true | **false** |

**Impacto demostrado del mínimo privilegio** (ver cap. 04):
```
app_root : LOAD_FILE('/etc/passwd')  -> 575 bytes     (compromiso del host)
app_least: LOAD_FILE('/etc/passwd')  -> NULL          (sin privilegio FILE)
```
Aunque existiera una inyección en la app remediada, el atacante **no** podría leer/
escribir archivos ni intentar `--os-shell`.

### Buenas prácticas adicionales (producción)
- Un usuario por aplicación, con permisos sólo sobre su esquema.
- Revocar `FILE`, `PROCESS`, `SUPER`, `FILE`, `GRANT OPTION` salvo necesidad real.
- `secure_file_priv` apuntando a un directorio controlado (o deshabilitar import/export).
- Deshabilitar `multipleStatements`/stacked queries en el driver.
- Separar cuentas de lectura y de escritura cuando aplique.

## 7.2 — WAF: ModSecurity + OWASP CRS

Servicio `waf` (imagen `owasp/modsecurity-crs:4.25-nginx-alpine-lts`) como reverse proxy
delante de la app vulnerable (puerto 8080). Configuración por variables de entorno
(ver `docker-compose.yml` y `waf/README.md`):

| Variable | Valor | Efecto |
|---|---|---|
| `MODSEC_RULE_ENGINE` | `On` | Modo bloqueo |
| `PARANOIA` / `BLOCKING_PARANOIA` | `1` | Nivel de reglas |
| `ANOMALY_INBOUND` | `5` | Umbral de scoring |

**Resultado (cap. 05):** CRS bloquea (403) payloads SQLi evidentes y normaliza para
resistir tampers simples. **Limitación:** no cubre el 100% (un error-based por la ruta
pasó). El WAF **complementa**, no sustituye, la parametrización.

### Operación del WAF
```
docker compose logs -f waf        # ver 403 y reglas 942xxx disparadas
# modo auditoría (no bloquea): MODSEC_RULE_ENGINE=DetectionOnly
```

## 7.3 — Otras capas recomendadas
- **TLS** en el proxy (terminación HTTPS).
- **Rate limiting** / detección de automatización (SQLMap genera mucho tráfico).
- **Logging y alertas** centralizados (detectar patrones de inyección).
- **Hardening de la BD**: red interna (la BD no expuesta a Internet), credenciales en
  secretos gestionados, backups cifrados.
- **Cabeceras de seguridad** y gestión de sesiones robusta en la app.

## 7.4 — Defensa en profundidad (resumen)
```
   Internet
      |
   [ WAF / CRS ]        <- bloquea ataques conocidos (reduce ruido)
      |
   [ App: ORM parametrizado + validación ]   <- ELIMINA la causa raíz
      |
   [ BD: usuario de mínimo privilegio ]      <- limita el impacto residual
```
Cada capa asume que la anterior puede fallar.
