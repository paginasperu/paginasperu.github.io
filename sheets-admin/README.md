# Panel privado de gestión de perfiles

Este proyecto vinculado a la hoja `directorio` conserva el menú y la ficha lateral actuales, y añade una aplicación web completa con HTML, CSS y JavaScript propios. La vista pública del directorio, el panel de administración, Apps Script y Sheets son las dos interfaces y las capas de ejecución/datos del mismo sistema. El panel nuevo mantiene la hoja como fuente de datos y no cambia sus pestañas ni encabezados.

## Aplicación web de gestión

- Archivos de interfaz: `Admin.html`, `AdminStyles.html` y `AdminClient.html`.
- La ruta pública `www.oficial.pe/admin` es solo una puerta de entrada que redirige a la aplicación web privada de Apps Script; no contiene datos ni autentica usuarios. La URL final cambia a `script.google.com` y Google limita el acceso a la cuenta que la desplegó.
- `doGet()` sirve el panel con Apps Script HTML Service; el navegador llama al servidor mediante `google.script.run`.
- El acceso de despliegue recomendado queda en `MYSELF` y ejecuta como la cuenta que lo despliega. No crea contraseña aparte: se entra con la cuenta Google autorizada.
- La aplicación abre únicamente el ID de hoja fijado en `REVIEW_SPREADSHEET_ID`; las funciones de listado devuelven metadatos mínimos y los datos privados solo se cargan al abrir una ficha.
- El manifiesto solicita `spreadsheets` porque las aplicaciones web de un script vinculado no tienen una hoja activa y `openById()` requiere ese alcance. Google define este alcance para las hojas a las que la cuenta puede acceder, por lo que el código limita el uso a la hoja indicada y el despliegue a la cuenta propietaria. No concedas este alcance a más usuarios.
- Antes de autorizar o desplegar la aplicación por primera vez, revisa la pantalla de permisos y el acceso `Solo yo`. Mantén el Apps Script público del formulario (`apps-script/`) separado; este panel no debe desplegarse como endpoint anónimo.

Para abrir la interfaz local sin conectar ni modificar Google Sheets, ejecuta `npm run demo:admin` y abre `http://127.0.0.1:8000/sandbox/admin-panel/`. La vista previa usa datos públicos de demostración y tres solicitudes sintéticas; los cambios se guardan solo en el almacenamiento de este navegador.

## Flujo

1. Para la aplicación web, iniciar sesión con la cuenta Google propietaria y abrir su URL de despliegue. El acceso queda limitado por Google a la cuenta que desplegó la aplicación. Para la ficha lateral existente, abrir la hoja y elegir **Gestión de perfiles → Abrir ficha de revisión**.
2. Revisar la cola `Pendiente` y abrir cada registro en la ficha.
3. Cambiar estado, verificación, destacado, posición o notas y guardar.
4. Cuando se quiera actualizar la web, descargar el CSV público y reemplazar `data/perfiles.csv` en el repositorio; aprobar en Sheets no publica automáticamente la web.

El CSV se crea desde `perfiles`, filtrando estrictamente el estado `Activo` y una lista permitida de 22 campos públicos. Comprueba IDs únicos antes de exportar; no depende de que la fórmula de `publico` esté actualizada. El panel no implementa publicación automática en GitHub ni almacena credenciales de GitHub.

Si Google presenta el aviso de aplicación no verificada, la persona propietaria de la hoja debe decidir si confía en este script antes de continuar. La autorización necesaria está limitada a la hoja actual y a mostrar la barra lateral.

## Sincronización

La carpeta usa un archivo `.clasp.json` propio y un `rootDir` local, separado de `apps-script/`, que contiene el receptor público del formulario. Para descargar cambios del proyecto vinculado:

```powershell
cd sheets-admin
npx clasp --auth ..\.clasprc.json login
npx clasp --auth ..\.clasprc.json pull
```

Para publicar cambios al panel vinculado:

```powershell
cd sheets-admin
npx clasp --auth ..\.clasprc.json push
```

La autenticación de `clasp` permanece fuera del repositorio en `.clasprc.json`; en un equipo nuevo, el primer comando inicia el acceso de esa cuenta de Google. El proyecto de panel debe desplegarse como aplicación web con acceso `Solo yo`; nunca lo publiques anónimo.
