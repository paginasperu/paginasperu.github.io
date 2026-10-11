# Panel privado de revisión de perfiles

Proyecto de Apps Script vinculado a la hoja `directorio`. Añade el menú `Gestión de perfiles` y una ficha vertical para revisar solicitudes sin cambiar el esquema que consume el formulario (`perfiles`) ni la vista pública (`publico`).

## Flujo

1. Abrir la hoja y elegir **Gestión de perfiles → Abrir ficha de revisión**. La primera vez, Google solicita autorizar el acceso a la hoja y a su interfaz para abrir la barra lateral.
2. Revisar la cola `Pendiente` y abrir cada registro en la ficha.
3. Cambiar estado, verificación, destacado, posición o notas y guardar.
4. Cuando se quiera actualizar la web, descargar el CSV público y reemplazar `data/perfiles.csv` en el repositorio; aprobar en Sheets no publica automáticamente la web.

El CSV se crea solo desde `publico`, que funciona como lista permitida de campos públicos. El panel no implementa publicación automática en GitHub ni almacena credenciales de GitHub.

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

La autenticación de `clasp` permanece fuera del repositorio en `.clasprc.json`; en un equipo nuevo, el primer comando inicia el acceso de esa cuenta de Google. El script de revisión es privado y no despliega un endpoint web.
