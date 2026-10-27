-- UKR ONLY. Review and apply to an independent NEW development project.
-- No SQL was executed by the transfer. Enable anonymous sign-in and abuse controls separately.
create extension if not exists pgcrypto;
create table if not exists public.chat_admin_identities(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.chat_admin_identities enable row level security;
revoke all on public.chat_admin_identities from anon, authenticated;
create or replace function public.get_chat_admin_name() returns text language sql stable security definer set search_path=public as $$
 select case when exists(select 1 from public.chat_admin_identities where user_id=auth.uid()) then 'station admin' else '' end;
$$;
revoke all on function public.get_chat_admin_name() from public, anon;
grant execute on function public.get_chat_admin_name() to authenticated;
create or replace function public.is_reserved_chat_nickname(value text) returns boolean language sql immutable as $$
 select lower(btrim(value)) ~ '(admin|moderator|official|urban.?kanto|station.?staff)';
$$;
create or replace function public.is_chat_admin_nickname_allowed(value text, uid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select uid=auth.uid() and public.get_chat_admin_name() <> '';
$$;
revoke all on function public.is_chat_admin_nickname_allowed(text,uuid) from public, anon;
grant execute on function public.is_chat_admin_nickname_allowed(text,uuid) to authenticated;
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 24),
  avatar_seed text not null check (char_length(btrim(avatar_seed)) between 2 and 40),
  avatar_url text not null default '' check (char_length(avatar_url) <= 500),
  reply_to_id uuid,
  reply_to_nickname text not null default '' check (char_length(reply_to_nickname) <= 24),
  reply_to_message text not null default '' check (char_length(reply_to_message) <= 90),
  message text not null check (char_length(btrim(message)) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.chat_messages
  add column if not exists avatar_url text not null default '' check (char_length(avatar_url) <= 500);

alter table public.chat_messages
  add column if not exists reply_to_id uuid;

alter table public.chat_messages
  add column if not exists reply_to_nickname text not null default '' check (char_length(reply_to_nickname) <= 24);

alter table public.chat_messages
  add column if not exists reply_to_message text not null default '' check (char_length(reply_to_message) <= 90);

alter table public.chat_messages
  drop constraint if exists chat_messages_reserved_nickname_check;

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_authenticated" on public.chat_messages;
create policy "chat_messages_select_authenticated"
on public.chat_messages
for select
to authenticated
using (true);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
on public.chat_messages
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    not public.is_reserved_chat_nickname(nickname)
    or public.is_chat_admin_nickname_allowed(nickname, auth.uid())
  )
);

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null,
  reaction text not null check (reaction in ('❤️', '🔥', '😂', '👏', '🇵🇭', '🤪', '😎', '🥳', '🤯', '😭', '😅', '🙃', '🫶', '🕺', '💃')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, user_id, reaction)
);

alter table public.chat_reactions
  drop constraint if exists chat_reactions_reaction_check;

alter table public.chat_reactions
  add constraint chat_reactions_reaction_check
  check (reaction in ('❤️', '🔥', '😂', '👏', '🇵🇭', '🤪', '😎', '🥳', '🤯', '😭', '😅', '🙃', '🫶', '🕺', '💃'));

create index if not exists chat_reactions_message_id_idx
  on public.chat_reactions (message_id);

create unique index if not exists chat_reactions_one_per_user_idx
  on public.chat_reactions (message_id, user_id);

alter table public.chat_reactions enable row level security;

drop policy if exists "chat_reactions_select_authenticated" on public.chat_reactions;
create policy "chat_reactions_select_authenticated"
on public.chat_reactions
for select
to authenticated
using (true);

drop policy if exists "chat_reactions_insert_own" on public.chat_reactions;
create policy "chat_reactions_insert_own"
on public.chat_reactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "chat_reactions_delete_own" on public.chat_reactions;
create policy "chat_reactions_delete_own"
on public.chat_reactions
for delete
to authenticated
using (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.chat_reactions;
exception
  when duplicate_object then null;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-avatars',
  'chat-avatars',
  true,
  40960,
  array['image/webp','image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_avatars_select_public" on storage.objects;
create policy "chat_avatars_select_public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'chat-avatars');

drop policy if exists "chat_avatars_insert_own" on storage.objects;
create policy "chat_avatars_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "chat_avatars_update_own" on storage.objects;
create policy "chat_avatars_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'chat-avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);


-- Bound traffic at the database, not just the browser. Serialize inserts per identity.
create or replace function public.ukr_chat_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or new.user_id <> auth.uid() then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if not exists(select 1 from public.chat_messages where id=new.id and user_id=auth.uid())
 and exists(select 1 from public.chat_messages where user_id=auth.uid() and created_at > now()-interval '4 seconds') then
  raise exception 'Please wait before sending another message';
 end if;
 new.created_at=now(); return new;
end $$;
revoke all on function public.ukr_chat_guard() from public, anon, authenticated;
drop trigger if exists ukr_chat_guard on public.chat_messages;
create trigger ukr_chat_guard before insert on public.chat_messages for each row execute function public.ukr_chat_guard();
create policy "ukr_moderator_delete" on public.chat_messages for delete to authenticated using (public.get_chat_admin_name() <> '');
grant select,insert,delete on public.chat_messages to authenticated;
grant select,insert,delete on public.chat_reactions to authenticated;
