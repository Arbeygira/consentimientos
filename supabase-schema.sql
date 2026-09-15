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

alter table public.form_templates enable row level security;
alter table public.signed_forms enable row level security;

drop policy if exists "Allow public template reads" on public.form_templates;
drop policy if exists "Allow public template inserts" on public.form_templates;
drop policy if exists "Allow public template updates" on public.form_templates;
drop policy if exists "Allow public template deletes" on public.form_templates;
drop policy if exists "Allow public signed form reads" on public.signed_forms;
drop policy if exists "Allow public signed form inserts" on public.signed_forms;
drop policy if exists "Allow public signed form deletes" on public.signed_forms;

create policy "Allow public template reads"
  on public.form_templates for select
  using (true);

create policy "Allow public template inserts"
  on public.form_templates for insert
  with check (true);

create policy "Allow public template updates"
  on public.form_templates for update
  using (true)
  with check (true);

create policy "Allow public template deletes"
  on public.form_templates for delete
  using (true);

create policy "Allow public signed form reads"
  on public.signed_forms for select
  using (true);

create policy "Allow public signed form inserts"
  on public.signed_forms for insert
  with check (true);

create policy "Allow public signed form deletes"
  on public.signed_forms for delete
  using (true);
