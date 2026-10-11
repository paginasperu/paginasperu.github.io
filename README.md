# Directorio Oficial de Publicidad

Sitio estático publicado con GitHub Pages. El sitio no requiere compilación; Node se usa solo para las herramientas locales de vista previa y sincronización del backend.

## Herramientas del proyecto

- Repositorio: `https://github.com/paginasperu/paginasperu.github.io`
- Sitio publicado: `https://oficial.pe` (GitHub Pages).
- Base de datos: Google Sheets, documento `directorio`; la pestaña `perfiles` guarda datos de gestión y `publico` es la vista destinada a publicación.
- Backend: Google Apps Script, proyecto `registro`. Su código se gestiona desde `apps-script/` con `clasp`.
- Hosting de imágenes: Cloudinary, cloud name `dahrgg4v5`; [abrir Media Library](https://console.cloudinary.com/app/c-f32bcfa51f430c6fcfe18ca29cdbfa/assets/media_library/search?q=&view_mode=mosaic). El formulario usa el preset unsigned `directorio`. No incluyas el API Secret en GitHub.

## Estructura

- `index.html`, `contacto.html`, `registro.html` y `privacidad.html`: páginas públicas en la raíz para que GitHub Pages resuelva las rutas limpias.
- `styles/`: estilos compartidos y estilos específicos por página.
- `scripts/`: módulos del directorio y del formulario de registro.
- `scripts/preview-server.mjs`: vista previa local con soporte para las rutas limpias de GitHub Pages.
- `apps-script/`: ubicación de la copia local del backend de Google Apps Script, sincronizada con `clasp` después de autorizar la cuenta.
- `.clasp.json`: identifica el proyecto remoto y su carpeta local; el Script ID no es una credencial.
- `package.json` y `package-lock.json`: fijan la versión de Node tooling necesaria para vista previa y sincronización. No son necesarios para servir el sitio publicado.
- `data/`: catálogo público de perfiles y catálogo de departamentos, provincias y distritos.
- `404.html`: página de error y redirecciones de enlaces cortos como `/instagram`. Las rutas limpias de las páginas las resuelve GitHub Pages usando los HTML de la raíz.
- `CNAME`: dominio personalizado de GitHub Pages.

## Datos y comportamiento

El directorio lee `data/perfiles.csv`; el formulario lee `data/distritos.csv`. Conserva los encabezados actuales de estos archivos: los módulos los usan para mostrar perfiles y enviar registros al Apps Script configurado. El formulario también usa el nombre del bucket y el preset unsigned de Cloudinary definidos en `scripts/registro.js`. No guardes secretos de API en archivos públicos.

## Retomar el proyecto en otra laptop

1. Instala Git, Node.js 20 o posterior y un navegador moderno.
2. Clona el repositorio y entra a la carpeta:

   ```powershell
   git clone https://github.com/paginasperu/paginasperu.github.io.git
   Set-Location paginasperu.github.io
   ```

3. Instala las herramientas fijadas por el proyecto e inicia el servidor local:

   ```powershell
   npm ci
   npm run preview
   ```

4. Abre `http://127.0.0.1:8000`. El servidor local entrega las páginas, módulos y CSV, y permite probar `/registro`, `/contacto` y `/privacidad`. Usa `Ctrl+C` para detenerlo. Si el puerto 8000 está ocupado, inicia PowerShell con `$env:PORT = 8001` y vuelve a ejecutar el comando.
5. Revisa el estado antes de editar o publicar:

   ```powershell
   git status --short --branch
   git pull --ff-only
   ```

   Si `git status` muestra cambios propios, revísalos antes de actualizar para no sobrescribir trabajo pendiente.

## Qué necesita acceso adicional

- **Publicar el sitio:** acceso de escritura al repositorio de GitHub. GitHub Pages debe estar habilitado para publicar la rama `main` desde la raíz. Comprueba esto en Settings → Pages; no publiques secretos en el repositorio.
- **Recibir registros:** el proyecto de Google Apps Script y la hoja privada están identificados. El código se descarga a `apps-script/` después de autorizar `clasp`.
- **Sincronizar el backend:** ejecuta `npm run apps-script:login` una vez en cada equipo y autoriza `clasp` con la cuenta Google propietaria. Después usa `npm run apps-script:pull` para descargar el código. La autenticación queda en `.clasprc.json`, excluido de Git. `npm run apps-script:push` sube el código local al proyecto remoto; revisa siempre el diff antes de usarlo. La publicación de una nueva versión web es un paso aparte.
- **Subir imágenes:** acceso administrativo a Cloudinary para revisar el preset unsigned que usa el formulario. El cloud name y preset son identificadores públicos del flujo, no claves privadas. Nunca incluyas el API Secret en este repositorio.
- **Trabajar con una IA nueva:** comparte el enlace del repositorio y esta guía. Indica que el sitio es estático, que las páginas deben mantener sus rutas públicas, que `data/perfiles.csv` es público y que el Apps Script y la hoja contienen lógica/datos privados fuera de este repo. Pide revisar `git status` antes de cambiar archivos.

## Comprobación antes de publicar

Ejecuta `npm test` y consulta [la revisión crítica y recuperación](REVISION-CRITICA.md). `npm run check:live` comprueba disponibilidad; `npm run backup:public` respalda el CSV y sus imágenes públicas. Al modificar `data/distritos.csv`, ejecuta `npm run sync:locations` antes de desplegar el backend.

Revisa en local el directorio, el formulario, contacto y privacidad; confirma las rutas limpias, filtros, búsqueda, modal y vista móvil. Después inspecciona `git diff`, confirma que el CSV público no contiene datos internos, y publica solo cuando los cambios estén aprobados. La publicación ocurre al subir los cambios a la fuente configurada en Settings → Pages.
