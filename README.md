# Adrián Rodríguez Coaching

App móvil (PWA) para clientes y entrenador sobre Supabase.

- `docs/` → la app publicada con GitHub Pages (rama `main`, carpeta `/docs`).
- `src/main.js` → código fuente; `npm run build` genera `docs/app.js`.
- `supabase/001_esquema.sql` → tablas y seguridad por cliente (Row Level Security).

Este repositorio no contiene datos de clientes. La clave de `docs/config.js` es la clave pública (anon) de Supabase: la seguridad la ponen las políticas RLS del servidor. Nunca subas aquí la clave `service_role` ni exportaciones de datos.
