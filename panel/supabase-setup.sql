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
  notas text,
  created_at timestamptz not null default now()
);

create table if not exists resenas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  comentario text not null,
  calificacion int not null check (calificacion between 1 and 5),
  aprobado boolean not null default false,
  created_at timestamptz not null default now()
);

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

-- Acceso abierto (sin login en el panel, temporalmente).
drop policy if exists "auth_all_servicios" on servicios;
drop policy if exists "anon_all_servicios" on servicios;
create policy "anon_all_servicios" on servicios for all using (true) with check (true);

drop policy if exists "auth_all_turnos" on turnos;
drop policy if exists "anon_all_turnos" on turnos;
create policy "anon_all_turnos" on turnos for all using (true) with check (true);

drop policy if exists "auth_all_finanzas" on finanzas;
drop policy if exists "anon_all_finanzas" on finanzas;
create policy "anon_all_finanzas" on finanzas for all using (true) with check (true);

alter table clientes enable row level security;
drop policy if exists "auth_all_clientes" on clientes;
drop policy if exists "anon_all_clientes" on clientes;
create policy "anon_all_clientes" on clientes for all using (true) with check (true);

-- Reseñas: igual que antes, cualquiera puede dejar una. Por ahora el panel
-- (sin login) también puede ver y moderar todas, no solo las aprobadas.
alter table resenas enable row level security;
drop policy if exists "public_insert_resenas" on resenas;
create policy "public_insert_resenas" on resenas for insert with check (true);
drop policy if exists "public_select_resenas" on resenas;
drop policy if exists "auth_update_resenas" on resenas;
drop policy if exists "auth_delete_resenas" on resenas;
create policy "anon_all_resenas" on resenas for all using (true) with check (true);

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
