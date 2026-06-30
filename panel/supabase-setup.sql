-- Setup inicial del panel JG Barbería. Pegar y correr una sola vez en el SQL Editor de Supabase.

create extension if not exists pgcrypto;

create table if not exists servicios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists turnos (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  telefono text,
  fecha date not null,
  hora time not null,
  servicio_id uuid references servicios(id),
  servicio_nombre text not null,
  precio numeric not null default 0,
  estado text not null default 'pendiente',
  notas text,
  facturado boolean not null default false,
  finanza_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  instagram text,
  email text,
  notas text,
  created_at timestamptz not null default now()
);

alter table clientes add column if not exists instagram text;
alter table clientes add column if not exists email text;

create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  comentario text not null,
  calificacion int not null check (calificacion between 1 and 5),
  aprobado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  descripcion text not null,
  fecha date,
  completada boolean not null default false,
  created_at timestamptz not null default now()
);

alter table tareas enable row level security;
drop policy if exists "anon_all_tareas" on tareas;
drop policy if exists "auth_all_tareas" on tareas;
create policy "auth_all_tareas" on tareas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tareas') then
    alter publication supabase_realtime add table tareas;
  end if;
end $$;

create table if not exists finanzas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  fecha date not null,
  monto numeric not null default 0,
  descripcion text not null,
  categoria text,
  origen text not null default 'manual',
  turno_id uuid,
  created_at timestamptz not null default now()
);

alter table servicios enable row level security;
alter table turnos enable row level security;
alter table finanzas enable row level security;

-- Login obligatorio: cualquier usuario logueado (empleado o dueño) tiene
-- acceso completo a Servicios, Turnos, Finanzas y Clientes.
drop policy if exists "auth_all_servicios" on servicios;
drop policy if exists "anon_all_servicios" on servicios;
create policy "auth_all_servicios" on servicios for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_turnos" on turnos;
drop policy if exists "anon_all_turnos" on turnos;
create policy "auth_all_turnos" on turnos for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "auth_all_finanzas" on finanzas;
drop policy if exists "anon_all_finanzas" on finanzas;
create policy "auth_all_finanzas" on finanzas for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table clientes enable row level security;
drop policy if exists "auth_all_clientes" on clientes;
drop policy if exists "anon_all_clientes" on clientes;
create policy "auth_all_clientes" on clientes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- profiles: guarda el rol ('empleado' o 'dueno') de cada usuario de Supabase Auth.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('empleado', 'dueno')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
drop policy if exists "select_own_profile" on profiles;
create policy "select_own_profile" on profiles for select using (auth.uid() = id);

-- Reseñas: cualquiera puede dejar una (clientes públicos, sin login).
-- Ver/aprobar/eliminar reseñas queda solo para el rol 'dueno'.
alter table resenas enable row level security;
drop policy if exists "anon_all_resenas" on resenas;
drop policy if exists "public_select_resenas" on resenas;
drop policy if exists "auth_update_resenas" on resenas;
drop policy if exists "auth_delete_resenas" on resenas;
drop policy if exists "public_insert_resenas" on resenas;
create policy "public_insert_resenas" on resenas for insert with check (true);

drop policy if exists "dueno_select_resenas" on resenas;
create policy "dueno_select_resenas" on resenas for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'dueno')
);
drop policy if exists "dueno_update_resenas" on resenas;
create policy "dueno_update_resenas" on resenas for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'dueno')
);
drop policy if exists "dueno_delete_resenas" on resenas;
create policy "dueno_delete_resenas" on resenas for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'dueno')
);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'servicios') then
    alter publication supabase_realtime add table servicios;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'turnos') then
    alter publication supabase_realtime add table turnos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'finanzas') then
    alter publication supabase_realtime add table finanzas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'clientes') then
    alter publication supabase_realtime add table clientes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'resenas') then
    alter publication supabase_realtime add table resenas;
  end if;
end $$;
