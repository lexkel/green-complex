-- Supabase Database Schema for Green Complex Putting Stats App
-- Run this script in your Supabase SQL Editor to set up the database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Rounds table
create table rounds (
  id uuid primary key,
  user_id uuid not null,
  course text not null,
  date timestamptz not null,
  completed boolean default true,
  holes_played int,
  total_putts int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index idx_rounds_user_id on rounds(user_id);
create index idx_rounds_date on rounds(date desc);
create index idx_rounds_updated_at on rounds(updated_at desc);

-- Holes table
create table holes (
  id uuid primary key,
  round_id uuid references rounds(id) on delete cascade,
  hole_number int not null,
  par int not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_holes_round_id on holes(round_id);

-- Putts table
create table putts (
  id uuid primary key,
  hole_id uuid references holes(id) on delete cascade,
  round_id uuid not null,
  user_id uuid not null,
  putt_number int not null,
  distance float not null,
  made boolean not null,
  end_proximity_horizontal float,
  end_proximity_vertical float,
  start_proximity_horizontal float,
  start_proximity_vertical float,
  pin_position_x float,
  pin_position_y float,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_putts_hole_id on putts(hole_id);
create index idx_putts_user_id on putts(user_id);
create index idx_putts_round_id on putts(round_id);
create index idx_putts_updated_at on putts(updated_at desc);

-- Courses table
create table courses (
  id uuid primary key,
  user_id uuid not null,
  name text not null,
  holes jsonb not null,
  green_shapes jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_courses_user_id on courses(user_id);
create index idx_courses_updated_at on courses(updated_at desc);

-- Row Level Security (RLS) Policies
-- NOTE: Since we're using soft identity (no traditional auth), we'll disable RLS
-- This trusts the client to only access data for their user_id
-- If you need stricter security, enable RLS and implement custom auth

-- Option 1: Disable RLS (recommended for soft identity)
alter table rounds disable row level security;
alter table holes disable row level security;
alter table putts disable row level security;
alter table courses disable row level security;

-- Option 2: Enable RLS with policies (if using Supabase Auth)
-- Uncomment the lines below if you implement traditional authentication:
/*
alter table rounds enable row level security;
alter table holes enable row level security;
alter table putts enable row level security;

create policy "Users can view their own rounds"
  on rounds for select
  using (user_id::text = auth.uid()::text);

create policy "Users can insert their own rounds"
  on rounds for insert
  with check (user_id::text = auth.uid()::text);

create policy "Users can update their own rounds"
  on rounds for update
  using (user_id::text = auth.uid()::text);

create policy "Users can delete their own rounds"
  on rounds for delete
  using (user_id::text = auth.uid()::text);

create policy "Users can view holes from their rounds"
  on holes for select
  using (exists (
    select 1 from rounds where rounds.id = holes.round_id
    and rounds.user_id::text = auth.uid()::text
  ));

create policy "Users can insert holes for their rounds"
  on holes for insert
  with check (exists (
    select 1 from rounds where rounds.id = holes.round_id
    and rounds.user_id::text = auth.uid()::text
  ));

create policy "Users can view their own putts"
  on putts for select
  using (user_id::text = auth.uid()::text);

create policy "Users can insert their own putts"
  on putts for insert
  with check (user_id::text = auth.uid()::text);
*/

-- Function to auto-update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers to auto-update updated_at on record changes
create trigger update_rounds_updated_at before update on rounds
  for each row execute function update_updated_at_column();

create trigger update_holes_updated_at before update on holes
  for each row execute function update_updated_at_column();

create trigger update_putts_updated_at before update on putts
  for each row execute function update_updated_at_column();

create trigger update_courses_updated_at before update on courses
  for each row execute function update_updated_at_column();

-- Success message
select 'Database schema created successfully!' as status;
