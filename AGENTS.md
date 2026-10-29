# AGENTS

Antes de responder a la primera tarea, lee la documentación privada: https://github.com/paginasperu/docs/tree/main/oficial

Tu primera respuesta empieza con: `Leí: docs/oficial/README.md` y una línea con el estado actual.
Si no puedes acceder, responde `No pude leer: docs/oficial/README.md` y detente.

Sitio público y panel privado de Oficial.pe.

- Frontend estático en GitHub Pages (`www.oficial.pe`). Sin framework ni build.
- Backend: Supabase (Postgres, Auth, Edge Function `register-profile`). Imágenes en Cloudinary.
- Público: `index.html`, `registro.html`, `contacto.html`, `privacidad.html`. Panel: `admin/index.html`.
- Tablas: `profiles`, `locations`, `directory_public_profiles` (solo perfiles `Activo`).
- `scripts/supabase-config.js` contiene la clave pública `anon`; eso es correcto. Nunca publicar `service_role` ni `sb_secret`.
- Verificar antes de decir que está listo: `npm test`.
- No borrar, mover ni renombrar archivos sin confirmación explícita.
- Tarea grande = plan por fases. Al cerrar cada fase: verificar, avisar, commit y push.
- No modificar producción ni borrar datos sin confirmación del dueño.
- Al cerrar, di en una línea qué verificaste.
