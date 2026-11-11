-- Aplicada como migración «alta_con_codigo_y_tareas».
-- Registro con email + contraseña + código de alta (el email no basta para vincular una cuenta),
-- invitación de entrenador de un solo uso, tareas del entrenador y opciones del plan.
create or replace function private.nuevo_codigo() returns text language sql volatile as $$
  select upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
$$;
alter table public.clients add column if not exists codigo_alta text;
update public.clients set codigo_alta = private.nuevo_codigo() where codigo_alta is null;
alter table public.clients alter column codigo_alta set default private.nuevo_codigo();

create table if not exists private.invitacion_entrenador (codigo text primary key, nombre text not null, usado_en timestamptz);
revoke all on private.invitacion_entrenador from public, anon, authenticated;

create or replace function public.link_me() returns text
language sql stable security definer set search_path = public as $$ select private.my_client_id(); $$;

create or replace function public.alta_atleta(p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare cid text; em text; inv record; c text;
begin
  if auth.uid() is null then return null; end if;
  c := upper(trim(coalesce(p_codigo,'')));
  if length(c) < 6 then return null; end if;
  select * into inv from private.invitacion_entrenador where codigo = c and usado_en is null for update;
  if found then
    insert into public.coaches(user_id, nombre) values (auth.uid(), inv.nombre) on conflict do nothing;
    update private.invitacion_entrenador set usado_en = now() where codigo = c;
    return 'entrenador';
  end if;
  em := lower(coalesce(auth.jwt() ->> 'email', ''));
  update public.clients set user_id = auth.uid(), codigo_alta = private.nuevo_codigo(), updated_at = now()
   where email = em and codigo_alta = c and user_id is null and estado <> 'baja'
   returning id into cid;
  return cid;
end $$;
revoke all on function public.alta_atleta(text) from public, anon;
grant execute on function public.alta_atleta(text) to authenticated;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  titulo text not null check (length(titulo) between 1 and 200),
  detalle text not null default '',
  tipo text not null default 'tarea' check (tipo in ('tarea','habito','control','formulario')),
  fecha date,
  hecho boolean not null default false,
  hecho_en timestamptz,
  respuesta text not null default '' check (length(respuesta) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists tasks_client_idx on public.tasks(client_id, fecha);
alter table public.tasks enable row level security;
create policy coach_all on public.tasks for all to authenticated using ((select private.is_coach())) with check ((select private.is_coach()));
create policy client_read on public.tasks for select to authenticated using (client_id = (select private.my_client_id()));

create or replace function public.completar_tarea(p_id uuid, p_hecho boolean, p_respuesta text default '') returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.tasks set hecho = p_hecho, hecho_en = case when p_hecho then now() end, respuesta = left(coalesce(p_respuesta,''), 2000)
   where id = p_id and client_id = private.my_client_id();
  return found;
end $$;
revoke all on function public.completar_tarea(uuid, boolean, text) from public, anon;
grant execute on function public.completar_tarea(uuid, boolean, text) to authenticated;

alter table public.plans add column if not exists nutricion jsonb;
alter table public.plans add column if not exists progreso_visible jsonb not null default '["peso","fuerza","medidas","fotos","bienestar","tests"]'::jsonb;
