-- Aplicada en Supabase como migración «helpers_privados» (después de 001_esquema.sql).
-- Mueve is_coach() y my_client_id() al esquema «private» (no expuesto por la API REST)
-- y rehace las políticas RLS para usarlas. link_me() y my_profile() siguen en public (se llaman por RPC
-- y solo devuelven datos del propio usuario).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where user_id = auth.uid());
$$;
create or replace function private.my_client_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid() and estado <> 'baja' limit 1;
$$;
revoke all on function private.is_coach(), private.my_client_id() from public, anon;
grant execute on function private.is_coach(), private.my_client_id() to authenticated;

do $$ declare t text; begin
  foreach t in array array['clients','plans','workouts','wellness','weights','measurements','photos','reviews','reports','tests','events','payments'] loop
    execute format('drop policy if exists coach_all on public.%I', t);
    execute format('create policy coach_all on public.%I for all to authenticated using ((select private.is_coach())) with check ((select private.is_coach()))', t);
  end loop;
  foreach t in array array['workouts','wellness','weights','measurements','photos'] loop
    execute format('drop policy if exists client_rw on public.%I', t);
    execute format('create policy client_rw on public.%I for all to authenticated using (client_id = (select private.my_client_id())) with check (client_id = (select private.my_client_id()))', t);
  end loop;
end $$;
drop policy if exists client_read on public.plans;
create policy client_read on public.plans for select to authenticated using (client_id = (select private.my_client_id()));
drop policy if exists client_read on public.reports;
create policy client_read on public.reports for select to authenticated using (client_id = (select private.my_client_id()) and publicado);
drop policy if exists client_read on public.tests;
create policy client_read on public.tests for select to authenticated using (client_id = (select private.my_client_id()));
drop policy if exists client_read on public.events;
create policy client_read on public.events for select to authenticated using (client_id = (select private.my_client_id()) and visible_cliente);
drop policy if exists fotos_coach on storage.objects;
create policy fotos_coach on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and (select private.is_coach())) with check (bucket_id = 'fotos' and (select private.is_coach()));
drop policy if exists fotos_cliente on storage.objects;
create policy fotos_cliente on storage.objects for all to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select private.my_client_id()))
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select private.my_client_id()));

create or replace function public.link_me() returns text
language plpgsql security definer set search_path = public as $$
declare cid text; em text;
begin
  if auth.uid() is null then return null; end if;
  em := lower(coalesce(auth.jwt() ->> 'email', ''));
  if em = '' then return null; end if;
  update public.clients set user_id = auth.uid(), updated_at = now() where email = em and user_id is null returning id into cid;
  return coalesce(cid, private.my_client_id());
end $$;
create or replace function public.limit_daily_rows() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if private.is_coach() then return new; end if;
  execute format('select count(*) from public.%I where client_id = $1 and created_at > now() - interval ''1 day''', TG_TABLE_NAME) into n using new.client_id;
  if n >= 60 then raise exception 'Demasiados registros hoy'; end if;
  return new;
end $$;
drop function if exists public.is_coach();
drop function if exists public.my_client_id();
