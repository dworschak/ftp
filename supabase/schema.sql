-- Family Tree Printer – Supabase schema
-- Run this ONCE in the Supabase SQL Editor
-- https://app.supabase.com/project/iwxdpvdpjenpomwgahkw/sql/new

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

create table if not exists family_trees (
  id          text primary key,
  owner_email text not null,
  name        text not null,
  created_at  text not null,
  updated_at  text not null
);

create table if not exists people (
  tree_id        text not null references family_trees(id) on delete cascade,
  id             text not null,
  first_name     text not null default '',
  last_name      text not null default '',
  birth_date     text,
  birth_place    text,
  death_date     text,
  death_place    text,
  gender         text,
  father_id      text,
  mother_id      text,
  marriages      jsonb,         -- array of { spouseId, date?, place? }
  primary key (tree_id, id)
);

create table if not exists saved_views (
  id             text primary key,
  tree_id        text not null references family_trees(id) on delete cascade,
  name           text not null,
  root_person_id text,
  graph_type     text not null,
  layout         jsonb not null,
  created_at     text not null,
  updated_at     text not null
);

-- ─────────────────────────────────────────────
-- Row Level Security (open for personal use)
-- ─────────────────────────────────────────────

alter table family_trees  enable row level security;
alter table people         enable row level security;
alter table saved_views    enable row level security;

create policy "allow_all_family_trees" on family_trees
  for all using (true) with check (true);

create policy "allow_all_people" on people
  for all using (true) with check (true);

create policy "allow_all_saved_views" on saved_views
  for all using (true) with check (true);


-- ─────────────────────────────────────────────
-- Migrations
-- ─────────────────────────────────────────────

-- (none – use schema.sql on a fresh database)

