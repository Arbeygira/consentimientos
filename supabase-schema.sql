create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content jsonb not null,
  design jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signed_forms (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  pdf_data text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.app_role_permissions (
  role_id uuid not null references public.app_roles(id) on delete cascade,
  permission_key text not null,
  can_edit boolean not null default false,
  primary key (role_id, permission_key)
);

create table if not exists public.app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text unique,
  account_type text not null default 'base' check (account_type in ('admin', 'base')),
  role_id uuid references public.app_roles(id),
  created_at timestamptz not null default now()
);

alter table public.app_profiles add column if not exists username text unique;
alter table public.app_profiles add column if not exists account_type text not null default 'admin';
alter table public.app_profiles alter column account_type set default 'admin';
update public.app_profiles set account_type = 'admin' where account_type = 'base';

insert into public.app_roles (name, description)
values
  ('Administrador', 'Acceso completo a la aplicación'),
  ('Editor', 'Puede modificar diseños y formularios'),
  ('Diligenciador', 'Puede llenar y descargar formularios'),
  ('Consulta', 'Puede consultar documentos guardados')
on conflict (name) do nothing;

insert into public.app_role_permissions (role_id, permission_key, can_edit)
select r.id, p.permission_key, p.can_edit
from public.app_roles r
cross join (values
  ('Administrador', 'edit', true), ('Administrador', 'fill', true), ('Administrador', 'consult', true), ('Administrador', 'users', true),
  ('Editor', 'edit', true), ('Editor', 'fill', true), ('Editor', 'consult', false),
  ('Diligenciador', 'fill', true),
  ('Consulta', 'consult', false)
) as p(role_name, permission_key, can_edit)
where r.name = p.role_name
on conflict (role_id, permission_key) do update set can_edit = excluded.can_edit;

alter table public.form_templates enable row level security;
alter table public.signed_forms enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_roles enable row level security;
alter table public.app_role_permissions enable row level security;
alter table public.app_profiles enable row level security;

create or replace function public.has_app_permission(required_permission text, required_edit boolean default false)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_profiles profile
    join public.app_role_permissions permission on permission.role_id = profile.role_id
    where profile.id = auth.uid()
      and permission.permission_key = required_permission
      and (not required_edit or permission.can_edit)
  );
$$;

drop policy if exists "Allow authenticated role reads" on public.app_roles;
create policy "Allow authenticated role reads" on public.app_roles for select to authenticated using (true);
drop policy if exists "Allow administrators to create roles" on public.app_roles;
create policy "Allow administrators to create roles" on public.app_roles for insert to authenticated
  with check (public.has_app_permission('users', true));
drop policy if exists "Allow administrators to update roles" on public.app_roles;
create policy "Allow administrators to update roles" on public.app_roles for update to authenticated
  using (public.has_app_permission('users', true)) with check (public.has_app_permission('users', true));
drop policy if exists "Allow administrators to delete roles" on public.app_roles;
create policy "Allow administrators to delete roles" on public.app_roles for delete to authenticated
  using (public.has_app_permission('users', true));
drop policy if exists "Allow authenticated permission reads" on public.app_role_permissions;
create policy "Allow authenticated permission reads" on public.app_role_permissions for select to authenticated using (true);
drop policy if exists "Allow administrators to create permissions" on public.app_role_permissions;
create policy "Allow administrators to create permissions" on public.app_role_permissions for insert to authenticated
  with check (public.has_app_permission('users', true));
drop policy if exists "Allow administrators to update permissions" on public.app_role_permissions;
create policy "Allow administrators to update permissions" on public.app_role_permissions for update to authenticated
  using (public.has_app_permission('users', true)) with check (public.has_app_permission('users', true));
drop policy if exists "Allow administrators to delete permissions" on public.app_role_permissions;
create policy "Allow administrators to delete permissions" on public.app_role_permissions for delete to authenticated
  using (public.has_app_permission('users', true));
drop policy if exists "Allow users to read own profile" on public.app_profiles;
create policy "Allow users to read own profile" on public.app_profiles for select to authenticated using (id = auth.uid() or public.has_app_permission('users', true));
drop policy if exists "Allow users to create own profile" on public.app_profiles;
create policy "Allow users to create own profile" on public.app_profiles for insert to authenticated with check (id = auth.uid() or public.has_app_permission('users', true));
drop policy if exists "Allow administrators to manage profiles" on public.app_profiles;
create policy "Allow administrators to manage profiles" on public.app_profiles for update to authenticated using (public.has_app_permission('users', true)) with check (public.has_app_permission('users', true));
drop policy if exists "Allow administrators to revoke profiles" on public.app_profiles;
create policy "Allow administrators to revoke profiles" on public.app_profiles for delete to authenticated
  using (public.has_app_permission('users', true));

create or replace function public.create_default_app_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_role uuid;
begin
  select id into default_role from public.app_roles where name = 'Diligenciador' limit 1;
  insert into public.app_profiles (id, email, username, account_type, role_id)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(new.raw_user_meta_data ->> 'account_type', 'admin'),
    default_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_app_profile on auth.users;
create trigger on_auth_user_created_app_profile
  after insert on auth.users
  for each row execute procedure public.create_default_app_profile();

drop policy if exists "Allow public template reads" on public.form_templates;
drop policy if exists "Allow public template inserts" on public.form_templates;
drop policy if exists "Allow public template updates" on public.form_templates;
drop policy if exists "Allow public template deletes" on public.form_templates;
drop policy if exists "Authenticated template reads" on public.form_templates;
drop policy if exists "Editors insert templates" on public.form_templates;
drop policy if exists "Editors update templates" on public.form_templates;
drop policy if exists "Editors delete templates" on public.form_templates;
create policy "Authenticated template reads" on public.form_templates for select to authenticated
  using (public.has_app_permission('edit') or public.has_app_permission('fill') or public.has_app_permission('consult'));
create policy "Editors insert templates" on public.form_templates for insert to authenticated
  with check (public.has_app_permission('edit', true));
create policy "Editors update templates" on public.form_templates for update to authenticated
  using (public.has_app_permission('edit', true)) with check (public.has_app_permission('edit', true));
create policy "Editors delete templates" on public.form_templates for delete to authenticated
  using (public.has_app_permission('edit', true));

drop policy if exists "Allow public signed form reads" on public.signed_forms;
drop policy if exists "Allow public signed form inserts" on public.signed_forms;
drop policy if exists "Allow public signed form deletes" on public.signed_forms;
drop policy if exists "Authenticated signed form reads" on public.signed_forms;
drop policy if exists "Fillers insert signed forms" on public.signed_forms;
drop policy if exists "Consultants delete signed forms" on public.signed_forms;
create policy "Authenticated signed form reads" on public.signed_forms for select to authenticated
  using (public.has_app_permission('consult') or public.has_app_permission('fill'));
create policy "Fillers insert signed forms" on public.signed_forms for insert to authenticated
  with check (public.has_app_permission('fill', true));
create policy "Consultants delete signed forms" on public.signed_forms for delete to authenticated
  using (public.has_app_permission('consult', true));

drop policy if exists "Allow public app setting reads" on public.app_settings;
drop policy if exists "Allow public app setting writes" on public.app_settings;
drop policy if exists "Authenticated setting reads" on public.app_settings;
drop policy if exists "Editors write settings" on public.app_settings;
create policy "Authenticated setting reads" on public.app_settings for select to authenticated
  using (public.has_app_permission('edit'));
create policy "Editors write settings" on public.app_settings for all to authenticated
  using (public.has_app_permission('edit', true)) with check (public.has_app_permission('edit', true));


