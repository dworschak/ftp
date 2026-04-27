/**
 * db.ts – All Supabase CRUD operations for Family Tree Printer.
 * Every public function is a no-op (returns silently) when Supabase is not configured.
 */

import { supabase, supabaseAvailable } from './supabase';
import { FamilyTree, Person, SavedView } from '../types';

// ─── Row ↔ Type mappers ────────────────────────────────────────────────────

function treeToRow(tree: FamilyTree, ownerEmail: string) {
  return {
    id:          tree.id,
    owner_email: ownerEmail,
    name:        tree.name,
    created_at:  tree.createdAt,
    updated_at:  tree.updatedAt,
  };
}

function personToRow(p: Person, treeId: string) {
  return {
    tree_id:       treeId,
    id:            p.id,
    first_name:    p.firstName,
    last_name:     p.lastName,
    birth_date:    p.birthDate    ?? null,
    birth_place:   p.birthPlace   ?? null,
    death_date:    p.deathDate    ?? null,
    death_place:   p.deathPlace   ?? null,
    gender:        p.gender       ?? null,
    father_id:     p.fatherId     ?? null,
    mother_id:     p.motherId     ?? null,
    marriage_date:  p.marriageDate  ?? null,
    marriage_place: p.marriagePlace ?? null,
  };
}

function rowToPerson(row: Record<string, unknown>): Person {
  return {
    id:            row.id            as string,
    firstName:     row.first_name    as string,
    lastName:      row.last_name     as string,
    birthDate:     (row.birth_date   as string | null) ?? undefined,
    birthPlace:    (row.birth_place  as string | null) ?? undefined,
    deathDate:     (row.death_date   as string | null) ?? undefined,
    deathPlace:    (row.death_place  as string | null) ?? undefined,
    gender:        (row.gender       as 'male' | 'female' | 'other' | null) ?? undefined,
    fatherId:      (row.father_id    as string | null) ?? undefined,
    motherId:      (row.mother_id    as string | null) ?? undefined,
    marriageDate:  (row.marriage_date  as string | null) ?? undefined,
    marriagePlace: (row.marriage_place as string | null) ?? undefined,
  };
}

function viewToRow(v: SavedView, treeId: string) {
  return {
    id:             v.id,
    tree_id:        treeId,
    name:           v.name,
    root_person_id: v.rootPersonId ?? null,
    graph_type:     v.graphType,
    layout:         v.layout,
    created_at:     v.createdAt,
    updated_at:     v.updatedAt,
  };
}

function rowToView(row: Record<string, unknown>): SavedView {
  return {
    id:           row.id             as string,
    name:         row.name           as string,
    rootPersonId: row.root_person_id as string,
    graphType:    row.graph_type     as SavedView['graphType'],
    layout:       row.layout         as SavedView['layout'],
    createdAt:    row.created_at     as string,
    updatedAt:    row.updated_at     as string,
  };
}

// ─── Batch helpers ─────────────────────────────────────────────────────────

async function batchInsert<T extends object>(table: string, rows: T[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + size));
    if (error) throw error;
  }
}

/**
 * Fetch ALL rows from a table filtered by tree_id IN treeIds.
 * Supabase returns at most 1 000 rows per request, so we paginate until done.
 */
async function fetchAllByTreeIds(
  table: string,
  treeIds: string[],
  orderBy?: string,
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  const all: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select('*').in('tree_id', treeIds).range(from, from + PAGE - 1);
    if (orderBy) q = q.order(orderBy);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Load all trees for a given user email, including people and saved views. */
export async function loadTrees(email: string): Promise<FamilyTree[]> {
  if (!supabaseAvailable) return [];

  const { data: treesData, error: treesErr } = await supabase
    .from('family_trees')
    .select('*')
    .eq('owner_email', email)
    .order('created_at');
  if (treesErr) throw treesErr;
  if (!treesData?.length) return [];

  const treeIds = treesData.map(t => t.id as string);

  const [peopleData, viewsData] = await Promise.all([
    fetchAllByTreeIds('people', treeIds),
    fetchAllByTreeIds('saved_views', treeIds, 'created_at'),
  ]);

  return treesData.map(t => ({
    id:         t.id as string,
    name:       t.name as string,
    createdAt:  t.created_at as string,
    updatedAt:  t.updated_at as string,
    people: (peopleData ?? [])
      .filter(p => p.tree_id === t.id)
      .map(p => rowToPerson(p as Record<string, unknown>)),
    savedViews: (viewsData ?? [])
      .filter(v => v.tree_id === t.id)
      .map(v => rowToView(v as Record<string, unknown>)),
  }));
}

/** Insert or update a tree record (does NOT touch people / views). */
export async function upsertTree(tree: FamilyTree, ownerEmail: string): Promise<void> {
  if (!supabaseAvailable) return;
  const { error } = await supabase
    .from('family_trees')
    .upsert(treeToRow(tree, ownerEmail), { onConflict: 'id' });
  if (error) throw error;
}

/** Replace all people in a tree (delete old, insert new). */
export async function replaceTreePeople(treeId: string, people: Person[]): Promise<void> {
  if (!supabaseAvailable) return;

  const { error: delErr } = await supabase
    .from('people')
    .delete()
    .eq('tree_id', treeId);
  if (delErr) throw delErr;

  if (people.length > 0) {
    await batchInsert('people', people.map(p => personToRow(p, treeId)));
  }
}

/** Insert or update a single person. */
export async function upsertPerson(person: Person, treeId: string): Promise<void> {
  if (!supabaseAvailable) return;
  const { error } = await supabase
    .from('people')
    .upsert(personToRow(person, treeId), { onConflict: 'tree_id,id' });
  if (error) throw error;
}

/** Insert or update a saved view. */
export async function upsertView(view: SavedView, treeId: string): Promise<void> {
  if (!supabaseAvailable) return;
  const { error } = await supabase
    .from('saved_views')
    .upsert(viewToRow(view, treeId), { onConflict: 'id' });
  if (error) throw error;
}

/** Delete a tree (cascades to people and saved views). */
export async function deleteTree(treeId: string): Promise<void> {
  if (!supabaseAvailable) return;
  const { error } = await supabase.from('family_trees').delete().eq('id', treeId);
  if (error) throw error;
}

/** Delete a saved view. */
export async function deleteView(viewId: string): Promise<void> {
  if (!supabaseAvailable) return;
  const { error } = await supabase.from('saved_views').delete().eq('id', viewId);
  if (error) throw error;
}

/** Update just the name and updated_at of a tree. */
export async function updateTreeMeta(treeId: string, name: string): Promise<void> {
  if (!supabaseAvailable) return;
  const { error } = await supabase
    .from('family_trees')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', treeId);
  if (error) throw error;
}

