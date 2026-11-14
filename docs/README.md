# Informe TPI — SQL Injection sobre un ORM (Sequelize)

Índice del informe. Leer en orden:

| # | Documento | Fase |
|---|---|---|
| 00 | [ORM y SQLi](00-ORM-y-sqli.md) | Marco teórico |
| 01 | [Entorno vulnerable](01-entorno-vulnerable.md) | Ofensiva — setup |
| 02 | [Explotación manual (Burp)](02-explotacion-manual-burp.md) | Ofensiva — manual |
| 03 | [Explotación con SQLMap](03-explotacion-sqlmap.md) | Ofensiva — automatizada |
| 04 | [Evaluación de impacto](04-impacto.md) | Ofensiva — impacto |
| 05 | [Tampers y WAF](05-tampers-waf.md) | Ofensiva/Defensiva — evasión |
| 06 | [Remediación de código](06-remediacion-codigo.md) | Defensiva — código |
| 07 | [Remediación de infraestructura](07-remediacion-infraestructura.md) | Defensiva — infra |
| 08 | [Conclusiones](08-conclusiones.md) | Cierre |

Evidencia reproducible: `../evidencias/run-demo.sh` → `../evidencias/salida.txt`.
