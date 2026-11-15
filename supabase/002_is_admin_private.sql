-- is_admin() yalnızca güvenlik kurallarında kullanılsın; sitenin API'sinden çağrılamasın.
-- (Supabase'de "is_admin_api_disina" geçişi olarak uygulandı, 15.11.2026)
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

drop policy "site ayarlarini admin degistirir" on public.app_settings;
create policy "site ayarlarini admin degistirir" on public.app_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

drop function public.is_admin();
