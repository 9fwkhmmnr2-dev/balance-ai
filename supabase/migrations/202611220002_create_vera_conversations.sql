-- VERA · Historial privado de conversaciones
create table public.vera_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nueva conversación',
  messages jsonb not null default '[]'::jsonb,
  last_message_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vera_conversations_messages_array check (jsonb_typeof(messages) = 'array')
);

create index vera_conversations_user_activity_idx
  on public.vera_conversations(user_id, archived_at, last_message_at desc);

alter table public.vera_conversations enable row level security;

create policy "Users can view their own VERA conversations"
  on public.vera_conversations for select
  using (auth.uid() = user_id);

create policy "Users can create their own VERA conversations"
  on public.vera_conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own VERA conversations"
  on public.vera_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own VERA conversations"
  on public.vera_conversations for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.vera_conversations to authenticated;
revoke all on public.vera_conversations from anon;
