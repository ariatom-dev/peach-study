-- Run this in the SQL Editor of a SEPARATE Supabase project for Peach Study.
-- It creates a private-per-user table for study sets and enables row-level security.

create table if not exists public.study_decks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  cards jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint study_decks_cards_is_array check (jsonb_typeof(cards) = 'array')
);

alter table public.study_decks enable row level security;

drop policy if exists "Users can read their own study decks" on public.study_decks;
create policy "Users can read their own study decks"
on public.study_decks for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own study decks" on public.study_decks;
create policy "Users can create their own study decks"
on public.study_decks for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own study decks" on public.study_decks;
create policy "Users can update their own study decks"
on public.study_decks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own study decks" on public.study_decks;
create policy "Users can delete their own study decks"
on public.study_decks for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.study_decks to authenticated;
