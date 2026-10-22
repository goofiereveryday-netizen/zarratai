create table if not exists public.user_preferences (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  preference_key text not null check (length(preference_key) between 1 and 100),
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_user_key_unique unique (user_id, preference_key)
);

alter table public.user_preferences enable row level security;

create policy "Users can read their own preferences"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own preferences"
  on public.user_preferences for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_preferences to authenticated;
