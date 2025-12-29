-- Migration: Add courses table to existing database
-- Run this in Supabase SQL Editor

-- Courses table
create table if not exists courses (
  id uuid primary key,
  user_id uuid not null,
  name text not null,
  holes jsonb not null,
  green_shapes jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_courses_user_id on courses(user_id);
create index if not exists idx_courses_updated_at on courses(updated_at desc);

-- Disable RLS (consistent with other tables)
alter table courses disable row level security;

-- Trigger to auto-update updated_at timestamp
create trigger update_courses_updated_at before update on courses
  for each row execute function update_updated_at_column();

-- Success message
select 'Courses table created successfully!' as status;
