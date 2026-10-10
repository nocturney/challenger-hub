#!/bin/bash
set -u
root='/Users/chris/Library/Application Support/OfficeOps/CraftSuite/Center'
url='http://127.0.0.1:17873'
if ! /usr/bin/curl -fsS --max-time 2 "$url/api/health" >/dev/null 2>&1; then
  /usr/bin/nohup /usr/local/bin/node "$root/server.js" >>"$root/server.log" 2>&1 </dev/null &
  /bin/disown 2>/dev/null || true
fi
for i in $(seq 1 40); do
  if /usr/bin/curl -fsS --max-time 2 "$url/api/health" >/dev/null 2>&1; then
    if [ "${CRAFT_NO_BROWSER:-0}" != "1" ]; then /usr/bin/open "$url/"; fi
    exit 0
  fi
  /bin/sleep 0.25
done
echo 'Craft Update Center failed to start. Check server.log.' >&2
exit 1