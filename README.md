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
- En **Authentication > Users** cree el primer usuario administrador y confirme su correo si el proyecto lo exige. El trigger del esquema le asigna inicialmente el rol `Diligenciador`; asígnele `Administrador` ejecutando este SQL, sustituyendo el correo:

```sql
update public.app_profiles
set role_id = (select id from public.app_roles where name = 'Administrador')
where email = 'admin@ejemplo.com';
```

- Los usuarios nuevos se crean desde **Usuarios y roles**. La política de confirmación de correo de Supabase debe estar configurada según el flujo deseado; si está activa, el usuario deberá confirmar su correo antes de ingresar.
- El administrador ingresa con su correo real. Los usuarios base ingresan únicamente con su nombre de usuario y clave; internamente se usa una cuenta técnica de Supabase para conservar la seguridad de las políticas, pero no se les solicita ni verifica correo.
- Para que los usuarios base puedan ingresar sin correo, vaya a **Supabase > Authentication > Providers > Email** y desactive **Confirm email**. La aplicación genera una cuenta técnica interna para cada usuario base y conserva la sesión del administrador al crearlo.
- Debe desplegar la función `supabase/functions/create-base-user/index.ts` con Supabase CLI. Desde la raíz del proyecto ejecute `supabase functions deploy create-base-user`. La función usa automáticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del proyecto para crear usuarios base sin enviar correos.
- Para convertir un perfil administrativo existente, ejecute este SQL sustituyendo el correo:

```sql
update public.app_profiles
set account_type = 'admin'
where email = 'admin@ejemplo.com';
```
- En **Usuarios y roles** un administrador puede cambiar el rol de un usuario, revocar su acceso, crear o editar roles y definir sus permisos. Al eliminar un rol, primero reasigne los usuarios que lo utilizan.
- La opción **Revocar acceso** elimina el perfil de la aplicación, por lo que el usuario ya no puede ingresar. La eliminación física de la cuenta de `auth.users` requiere una Edge Function protegida con `service_role` y no debe hacerse desde este frontend.

## Publicar en GitHub Pages

1. Suba estos archivos a un repositorio de GitHub.
2. Abra **Settings > Pages**.
3. Seleccione **Deploy from a branch**.
4. Seleccione la rama `main` y la carpeta `/root`.

La aplicacion usa Supabase para centralizar plantillas y PDFs nuevos. Los datos locales existentes se conservan como respaldo del navegador.
