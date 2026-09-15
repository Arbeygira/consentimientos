# Consentimiento informado

Aplicacion web para editar plantillas de consentimiento, diligenciar formularios, firmarlos y generar PDFs.

## Ejecutar localmente

Abra el proyecto mediante un servidor local, por ejemplo:

```text
http://localhost:8000/
```

## Supabase

- `supabase-client.js` contiene la URL y la clave publica del proyecto.
- Ejecute `supabase-schema.sql` en el SQL Editor de Supabase antes de usar el almacenamiento centralizado.
- La clave `publishable` puede estar en el frontend. Nunca publique una clave `service_role`.

## Publicar en GitHub Pages

1. Suba estos archivos a un repositorio de GitHub.
2. Abra **Settings > Pages**.
3. Seleccione **Deploy from a branch**.
4. Seleccione la rama `main` y la carpeta `/root`.

La aplicacion usa Supabase para centralizar plantillas y PDFs nuevos. Los datos locales existentes se conservan como respaldo del navegador.
