-- VERA · Memoria personal privada e independiente del historial
create table public.vera_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_key text not null,
  category text not null check (category in ('goal', 'preference', 'important_detail')),
  content text not null check (char_length(content) between 1 and 500),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, memory_key)
);

create index vera_memories_user_updated_idx
  on public.vera_memories(user_id, updated_at desc);

alter table public.vera_memories enable row level security;

create policy "Users can view their own VERA memories"
  on public.vera_memories for select
  using (auth.uid() = user_id);

create policy "Users can create their own VERA memories"
  on public.vera_memories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own VERA memories"
  on public.vera_memories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own VERA memories"
  on public.vera_memories for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.vera_memories to authenticated;
revoke all on public.vera_memories from anon;
