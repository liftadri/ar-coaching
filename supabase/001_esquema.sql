-- =====================================================================
-- Adrián Rodríguez Coaching · Esquema y seguridad (Supabase / Postgres)
-- Principio: el servidor decide qué ve cada uno (Row Level Security).
--   · Entrenador (tabla coaches): ve y edita todo.
--   · Cliente: solo sus propias filas, y nunca las notas privadas.
-- Ejecutar una vez en el editor SQL de Supabase (o con el conector).
-- =====================================================================

-- ---------- Roles ----------
create table if not exists public.coaches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default 'Entrenador',
  created_at timestamptz not null default now()
);

-- Ficha completa (PRIVADA del entrenador: salud, notas, pagos, histórico...)
create table if not exists public.clients (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  nombre text not null,
  email text not null unique check (email = lower(email)),
  user_id uuid unique references auth.users(id) on delete set null,
  estado text not null default 'activo' check (estado in ('activo','pausa','baja')),
  ficha jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Lo que el cliente SÍ puede ver de su planificación
create table if not exists public.plans (
  client_id text primary key references public.clients(id) on delete cascade,
  objetivo text not null default '',
  programa jsonb not null default '{}'::jsonb,       -- {nombre, semana, notas, dias:[{nombre, calentamiento, ejercicios:[{nombre,sxr,rir,descanso,notas}]}]}
  bloques jsonb not null default '[]'::jsonb,        -- [{nombre, inicio, fin, semanas:[{nombre,inicio,fin,tipo,foco}]}]
  habitos jsonb not null default '[]'::jsonb,        -- ["Dormir 7 h", ...]
  updated_at timestamptz not null default now()
);

-- ---------- Registros del cliente ----------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null default current_date,
  dia text not null default '',
  sets jsonb not null default '[]'::jsonb check (jsonb_typeof(sets) = 'array'),  -- [{ejercicio, serie, kg, reps, rir}]
  rpe_sesion numeric check (rpe_sesion between 0 and 10),
  duracion_min integer check (duracion_min between 0 and 600),
  comentario text not null default '' check (length(comentario) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists workouts_client_fecha on public.workouts (client_id, fecha desc);

create table if not exists public.wellness (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null default current_date,
  sueno_h numeric check (sueno_h between 0 and 16),
  sueno numeric check (sueno between 1 and 5),        -- 5 = mejor estado en todos
  fatiga numeric check (fatiga between 1 and 5),
  dolor numeric check (dolor between 1 and 5),
  estres numeric check (estres between 1 and 5),
  animo numeric check (animo between 1 and 5),
  motivacion numeric check (motivacion between 1 and 5),
  articular numeric check (articular between 1 and 5),
  fc numeric check (fc between 25 and 220),
  hrv numeric check (hrv between 1 and 300),
  molestia_zona text not null default '' check (length(molestia_zona) <= 120),
  molestia_0a10 numeric check (molestia_0a10 between 0 and 10),
  comentario text not null default '' check (length(comentario) <= 1000),
  created_at timestamptz not null default now(),
  unique (client_id, fecha)
);

create table if not exists public.weights (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null default current_date,
  kg numeric not null check (kg between 25 and 350),
  created_at timestamptz not null default now(),
  unique (client_id, fecha)
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null default current_date,
  cintura numeric check (cintura between 30 and 250),
  cadera numeric check (cadera between 30 and 250),
  pecho numeric check (pecho between 30 and 250),
  brazo numeric check (brazo between 10 and 80),
  muslo numeric check (muslo between 20 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null default current_date,
  vista text not null default 'frente' check (vista in ('frente','perfil','espalda','otra')),
  path text not null,
  created_at timestamptz not null default now()
);

-- ---------- Del entrenador ----------
-- Revisión técnica completa (privada)
create table if not exists public.reviews (
  id text primary key,                                -- <client_id>-<AAAA-MM-DD>
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null,
  semana text not null default '',
  datos jsonb not null default '{}'::jsonb,           -- medias semanales, ejercicios, molestias...
  analisis text not null default '',
  mensaje text not null default '',
  estado text not null default 'borrador' check (estado in ('borrador','analizada','enviada','importada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Informe para el cliente (solo lo ve cuando publicado = true)
create table if not exists public.reports (
  id text primary key,                                -- mismo id que la revisión
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null,
  semana text not null default '',
  titular text not null default '',
  logros jsonb not null default '[]'::jsonb,          -- ["frase | explicación"]
  mejorar jsonb not null default '[]'::jsonb,
  tener_en_cuenta jsonb not null default '[]'::jsonb,
  foco jsonb not null default '[]'::jsonb,
  mensaje text not null default '',
  kpis jsonb not null default '{}'::jsonb,
  mostrar_peso boolean not null default true,
  publicado boolean not null default false,
  publicado_en timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  nombre text not null,
  fecha date,
  categoria text not null default 'fuerza',
  valor numeric, unidad text not null default '', izq numeric, der numeric,
  notas text not null default '',
  mejor_es_menos boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  client_id text references public.clients(id) on delete cascade,
  titulo text not null, tipo text not null default 'otro',
  fecha date not null, fin date, notas text not null default '',
  visible_cliente boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(id) on delete cascade,
  fecha date not null default current_date,
  importe numeric not null, metodo text not null default '', concepto text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- Funciones de seguridad ----------
create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where user_id = auth.uid());
$$;

create or replace function public.my_client_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid() and estado <> 'baja' limit 1;
$$;

-- Vincula la cuenta recién iniciada con su ficha (solo si el email coincide y aún no está vinculada)
create or replace function public.link_me() returns text
language plpgsql security definer set search_path = public as $$
declare cid text; em text;
begin
  if auth.uid() is null then return null; end if;
  em := lower(coalesce(auth.jwt() ->> 'email', ''));
  if em = '' then return null; end if;
  update public.clients set user_id = auth.uid(), updated_at = now()
   where email = em and user_id is null
  returning id into cid;
  return coalesce(cid, public.my_client_id());
end $$;

-- Datos mínimos de su propia ficha que el cliente puede ver
create or replace function public.my_profile() returns table (id text, nombre text, estado text, es_entrenador boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre, c.estado, false from public.clients c where c.user_id = auth.uid() and c.estado <> 'baja'
  union all
  select null, co.nombre, 'activo', true from public.coaches co where co.user_id = auth.uid();
$$;

revoke all on function public.link_me() from public, anon;
revoke all on function public.my_profile() from public, anon;
revoke all on function public.is_coach() from public, anon;
revoke all on function public.my_client_id() from public, anon;
grant execute on function public.link_me(), public.my_profile(), public.is_coach(), public.my_client_id() to authenticated;

-- ---------- Row Level Security ----------
alter table public.coaches enable row level security;
alter table public.clients enable row level security;
alter table public.plans enable row level security;
alter table public.workouts enable row level security;
alter table public.wellness enable row level security;
alter table public.weights enable row level security;
alter table public.measurements enable row level security;
alter table public.photos enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.tests enable row level security;
alter table public.events enable row level security;
alter table public.payments enable row level security;

-- Nadie anónimo toca nada
revoke all on all tables in schema public from anon;

-- Entrenador: todo
do $$ declare t text; begin
  foreach t in array array['clients','plans','workouts','wellness','weights','measurements','photos','reviews','reports','tests','events','payments'] loop
    execute format('drop policy if exists coach_all on public.%I', t);
    execute format('create policy coach_all on public.%I for all to authenticated using (public.is_coach()) with check (public.is_coach())', t);
  end loop;
end $$;
drop policy if exists coach_self on public.coaches;
create policy coach_self on public.coaches for select to authenticated using (user_id = auth.uid());

-- Cliente: solo lectura de su plan, sus informes publicados, sus tests y eventos visibles
drop policy if exists client_read on public.plans;
create policy client_read on public.plans for select to authenticated using (client_id = public.my_client_id());
drop policy if exists client_read on public.reports;
create policy client_read on public.reports for select to authenticated using (client_id = public.my_client_id() and publicado);
drop policy if exists client_read on public.tests;
create policy client_read on public.tests for select to authenticated using (client_id = public.my_client_id());
drop policy if exists client_read on public.events;
create policy client_read on public.events for select to authenticated using (client_id = public.my_client_id() and visible_cliente);

-- Cliente: lee, crea, corrige y borra SUS registros (nunca los de otro: el client_id se comprueba también al escribir)
do $$ declare t text; begin
  foreach t in array array['workouts','wellness','weights','measurements','photos'] loop
    execute format('drop policy if exists client_rw on public.%I', t);
    execute format('create policy client_rw on public.%I for all to authenticated using (client_id = public.my_client_id()) with check (client_id = public.my_client_id())', t);
  end loop;
end $$;
-- (clients, reviews y payments: sin política de cliente = invisibles para él)

-- Cliente no puede cambiar el client_id de una fila existente a otro cliente (lo impide el WITH CHECK de arriba).
-- Límite de registros por día para frenar abusos desde un móvil comprometido
create or replace function public.limit_daily_rows() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if public.is_coach() then return new; end if;
  execute format('select count(*) from public.%I where client_id = $1 and created_at > now() - interval ''1 day''', TG_TABLE_NAME)
    into n using new.client_id;
  if n >= 60 then raise exception 'Demasiados registros hoy'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['workouts','wellness','weights','measurements','photos'] loop
    execute format('drop trigger if exists limit_rows on public.%I', t);
    execute format('create trigger limit_rows before insert on public.%I for each row execute function public.limit_daily_rows()', t);
  end loop;
end $$;

-- updated_at automático
create or replace function public.touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists touch_clients on public.clients; create trigger touch_clients before update on public.clients for each row execute function public.touch();
drop trigger if exists touch_plans on public.plans; create trigger touch_plans before update on public.plans for each row execute function public.touch();
drop trigger if exists touch_reviews on public.reviews; create trigger touch_reviews before update on public.reviews for each row execute function public.touch();

-- ---------- Fotos: bucket privado, una carpeta por cliente ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 8388608, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic'];

drop policy if exists fotos_coach on storage.objects;
create policy fotos_coach on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and public.is_coach()) with check (bucket_id = 'fotos' and public.is_coach());
drop policy if exists fotos_cliente on storage.objects;
create policy fotos_cliente on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.my_client_id())
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.my_client_id());
