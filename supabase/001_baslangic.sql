-- Mel Shop: hesaplar, ürünler, kullanıcı ayarları, site ayarları, fotoğraf deposu
-- (Supabase'de "melshop_baslangic" geçişi olarak uygulandı, 15.11.2026)

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('signups_open', 'true'::jsonb);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.user_meta (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb,
  primary key (user_id, key)
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;

-- Kayıt kapısı: yeni kayıtlar kapalıysa hesap oluşturulamaz.
create or replace function public.guard_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select (s.value)::boolean from public.app_settings s where s.key = 'signups_open'), false) then
    raise exception 'signups_closed';
  end if;
  return new;
end;
$$;

-- Yeni hesap: profil oluştur. İlk hesap admin olur ve kayıtlar kendiliğinden kapanır.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, is_admin) values (new.id, first_user);
  if first_user then
    update public.app_settings set value = 'false'::jsonb, updated_at = now() where key = 'signups_open';
  end if;
  return new;
end;
$$;

create trigger guard_signup before insert on auth.users for each row execute function public.guard_signup();
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke execute on function public.guard_signup() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.user_meta enable row level security;

create policy "site ayarlari herkese acik okunur" on public.app_settings for select to anon, authenticated using (true);
create policy "site ayarlarini admin degistirir" on public.app_settings for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "kendi profilini gorur" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "kendi urunlerini gorur" on public.items for select to authenticated using (user_id = (select auth.uid()));
create policy "kendi urununu ekler" on public.items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "kendi urununu gunceller" on public.items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "kendi urununu siler" on public.items for delete to authenticated using (user_id = (select auth.uid()));
create policy "kendi ayarlarini gorur" on public.user_meta for select to authenticated using (user_id = (select auth.uid()));
create policy "kendi ayarini ekler" on public.user_meta for insert to authenticated with check (user_id = (select auth.uid()));
create policy "kendi ayarini gunceller" on public.user_meta for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "kendi ayarini siler" on public.user_meta for delete to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
create policy "kendi fotograflarini gorur" on storage.objects for select to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "kendi fotografini yukler" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "kendi fotografini gunceller" on storage.objects for update to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "kendi fotografini siler" on storage.objects for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
