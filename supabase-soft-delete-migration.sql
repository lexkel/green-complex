-- Migration: Add soft delete support to rounds and courses tables
-- Run this in Supabase SQL Editor

-- Add deleted column to rounds table
alter table rounds add column if not exists deleted boolean default false;

-- Add deleted column to courses table
alter table courses add column if not exists deleted boolean default false;

-- Add index for deleted column on rounds (for filtering)
create index if not exists idx_rounds_deleted on rounds(deleted);

-- Add index for deleted column on courses (for filtering)
create index if not exists idx_courses_deleted on courses(deleted);

-- Success message
select 'Soft delete columns added successfully!' as status;
