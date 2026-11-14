# WAF - ModSecurity + OWASP Core Rule Set (CRS)

Se utiliza la imagen oficial `owasp/modsecurity-crs:4.25-nginx-alpine-lts` como **reverse proxy**
delante de la aplicacion vulnerable (`app-vuln:3000`), publicado en el puerto **8080**.

## Configuracion (via variables de entorno en docker-compose.yml)

| Variable | Valor | Efecto |
|---|---|---|
| `BACKEND` | `http://app-vuln:3000` | Upstream protegido por el WAF |
| `MODSEC_RULE_ENGINE` | `On` | Motor en modo **bloqueo** (no solo deteccion) |
| `PARANOIA` | `1` | Nivel de paranoia base del CRS |
| `BLOCKING_PARANOIA` | `1` | Nivel al que se bloquea |
| `ANOMALY_INBOUND` | `5` | Umbral de scoring de anomalias de entrada |
| `MODSEC_AUDIT_LOG` | `/dev/stdout` | Log de auditoria visible con `docker logs sqli-waf` |

## Reglas relevantes
Las reglas que detectan SQLi pertenecen al archivo CRS
`REQUEST-942-APPLICATION-ATTACK-SQLI.conf` (familia **942xxx**). Cada payload SQLi
suma "anomaly score"; al superar el umbral (5) la peticion se responde con **403**.

## Modo deteccion (opcional)
Para auditar sin bloquear (ver que dispararia sin cortar trafico), cambiar en compose:
`MODSEC_RULE_ENGINE: "DetectionOnly"` y releer `docker logs -f sqli-waf`.

## Evasion (parte ofensiva)
El WAF es una capa de **defensa en profundidad**, NO un reemplazo de la correccion
del codigo. En `docs/05-tampers-waf.md` se demuestra como los *tampers* de SQLMap
(`space2comment`, `charencode`, `between`, ...) ofuscan los payloads para evadir
estas reglas, reforzando que la unica solucion real es la **parametrizacion** (app `app-secure`).
