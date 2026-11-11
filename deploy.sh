#!/bin/sh
# Compila, pone versión a los archivos (para que los móviles carguen siempre la última) y publica.
set -e
npm run build
V=$(date +%s)
sed -i -E "s#(styles\.css|app\.js|config\.js)(\?v=[^\"]*)?\"#\1?v=$V\"#g" docs/index.html
