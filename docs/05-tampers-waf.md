# 05 — WAF (ModSecurity + CRS) y tampers

Capa defensiva de infraestructura: un **WAF real** (ModSecurity + OWASP Core Rule Set)
como reverse proxy delante de la app vulnerable, en el puerto **8080**. El código sigue
siendo vulnerable: el WAF es *defensa en profundidad*, para evaluar qué bloquea y qué no.

## 5.1 — Configuración
Imagen `owasp/modsecurity-crs:4.25-nginx-alpine-lts`, en modo **bloqueo** (anomaly
scoring). Las reglas que detectan SQLi son la familia **942xxx**
(`REQUEST-942-APPLICATION-ATTACK-SQLI`). Cada payload suma puntaje; al superar el umbral
(`ANOMALY_INBOUND=5`) la petición se responde con **403**.

## 5.2 — ¿Qué es un tamper?
Un *tamper* de SQLMap transforma el payload para evadir filtros sin cambiar su efecto SQL:

| Tamper | Transformación | Apunta a |
|---|---|---|
| `lowercase` / `randomcase` | `UNION`→`union`/`uNiOn` | blacklists case-sensitive |
| `space2comment` | espacio → `/**/` | filtros que exigen espacios |
| `charencode` | caracteres → `CHAR()`/URL-encode | filtros de texto plano |
| `between` | `>` → `NOT BETWEEN 0 AND` | bloqueo de operadores |
| `versionedkeywords` | `UNION`→`/*!UNION*/` | filtros simples de palabras |

Uso: `--tamper=space2comment,charencode,between`.

## 5.3 — Resultados contra el WAF  [DEMOSTRADO]

### El WAF bloquea la extracción por UNION (incluso con tampers)
| Petición a `:8080` (buscador) | Resultado |
|---|---|
| `GET /?q=teclado` (normal) | **200** |
| `/?q=zzz' UNION SELECT 1,2,3,4,5,6-- -` | **403** |
| `/?q=zzz' uNiOn SeLeCt ...` (`randomcase`) | **403** |
| `/?q=zzz'/**/UNION/**/SELECT/**/...` (`space2comment`) | **403** |
| `/?q=zzz' UNION SELECT CHAR(97),... ` (`charencode`) | **403** |

A diferencia de una blacklist ingenua, **CRS normaliza** (minúsculas, comentarios,
encoding) antes de evaluar: los tampers simples **no** lo evaden a paranoia 1. Un WAF bien
configurado es una barrera seria contra la automatización.

### Pero el WAF NO es infalible: el bypass de login SÍ pasa
| Petición a `:8080` (login) | Resultado |
|---|---|
| `POST /login` con `username=admin' -- ` | **302 → bypass exitoso** |
| `POST /login` con `password=' OR '1'='1` | **403** |

El payload de *auth bypass* `admin' -- ` es **quirúrgico** (una comilla + comentario, sin
palabras clave ruidosas) y **atraviesa el CRS**, logrando el acceso como admin a través
del WAF. En cambio `' OR '1'='1` sí dispara las reglas.

> **Conclusión central:** el WAF reduce el ruido y frena ataques evidentes (UNION,
> `OR 1=1`), pero **no cubre el 100%** y **no reemplaza corregir el código**. La causa raíz
> se elimina parametrizando (app `app-secure`, cap. 06).

## 5.4 — Metodología con SQLMap a través del WAF
```
# Detectar el WAF
sqlmap -u "http://localhost:8080/?q=teclado" -p q --batch --identify-waf

# Intentar evasión con tampers (a PL1 de CRS puede seguir bloqueando)
sqlmap -u "http://localhost:8080/?q=teclado" -p q --batch \
       --tamper=space2comment,charencode,between,randomcase \
       --random-agent --level 5 --risk 3
```
Para estudiar evasión real se puede bajar el nivel de paranoia del CRS o relajar reglas,
y comparar; el objetivo didáctico es entender que el *tampering* es la técnica de evasión
y que un ruleset robusto la resiste.

## 5.5 — Lectura comparativa
| Control | ¿Frena la extracción UNION? | ¿Frena el bypass de login? | ¿Mitiga la causa raíz? |
|---|---|---|---|
| Sin defensa (`:3000`) | No | No | No |
| WAF CRS (`:8080`) | **Sí** | **No** (pasa `admin' --`) | No |
| **Parametrización (`:3001`)** | **Sí** | **Sí** | **Sí** |

El orden correcto: **corregir el código** (causa raíz) + **mínimo privilegio** + **WAF**
como capa adicional.
