import type { Person } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersonFieldChange {
  field: string;
  label: string;
  oldValue: string | undefined;
  newValue: string | undefined;
}

export interface PersonUpdate {
  existing: Person;
  imported: Person;
  changes: PersonFieldChange[];
}

export interface GedcomDiff {
  /** People in the import that have no matching ID in the existing tree. */
  added: Person[];
  /** People present in both, but with at least one changed field. */
  updated: PersonUpdate[];
  /** People in the existing tree whose IDs are absent from the import. */
  onlyInExisting: Person[];
}

// ─── Field metadata ───────────────────────────────────────────────────────────

const FIELD_LABELS: Partial<Record<keyof Person, string>> = {
  firstName:      'First name',
  lastName:       'Last name',
  birthDate:      'Birth date',
  birthPlace:     'Birth place',
  deathDate:      'Death date',
  deathPlace:     'Death place',
  gender:         'Gender',
  fatherId:       'Father',
  motherId:       'Mother',
  occupation:     'Occupation',
  occupationFrom: 'Occupation from',
  occupationTo:   'Occupation to',
};

const COMPARE_FIELDS = Object.keys(FIELD_LABELS) as (keyof Person)[];

function toStr(val: unknown): string | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  return String(val);
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Computes the diff between an existing people array and an imported one.
 * Matching is done by `Person.id` (which maps to the GEDCOM xref, e.g. `I001`).
 */
export function computeGedcomDiff(existing: Person[], imported: Person[]): GedcomDiff {
  const existingById = new Map(existing.map(p => [p.id, p]));
  const importedById = new Map(imported.map(p => [p.id, p]));

  const added: Person[] = [];
  const updated: PersonUpdate[] = [];
  const onlyInExisting: Person[] = [];

  for (const imp of imported) {
    const ex = existingById.get(imp.id);
    if (!ex) {
      added.push(imp);
    } else {
      const changes: PersonFieldChange[] = [];
      for (const field of COMPARE_FIELDS) {
        const oldVal = toStr(ex[field]);
        const newVal = toStr(imp[field]);
        if (oldVal !== newVal) {
          changes.push({ field, label: FIELD_LABELS[field] ?? field, oldValue: oldVal, newValue: newVal });
        }
      }
      if (changes.length > 0) {
        updated.push({ existing: ex, imported: imp, changes });
      }
    }
  }

  for (const ex of existing) {
    if (!importedById.has(ex.id)) {
      onlyInExisting.push(ex);
    }
  }

  return { added, updated, onlyInExisting };
}

/**
 * Applies an incremental merge:
 * - Existing people whose ID appears in `imported` are replaced by the imported version.
 * - People only in `imported` are appended.
 * - People only in `existing` (absent from import) are kept unchanged.
 */
export function applyGedcomMerge(existing: Person[], imported: Person[]): Person[] {
  const importedById = new Map(imported.map(p => [p.id, p]));
  const existingIds  = new Set(existing.map(p => p.id));

  const result = existing.map(p => importedById.get(p.id) ?? p);

  for (const imp of imported) {
    if (!existingIds.has(imp.id)) result.push(imp);
  }

  return result;
}
