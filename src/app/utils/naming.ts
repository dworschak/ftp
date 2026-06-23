import type { GraphType, Person } from '../types';

/** Append " 2", " 3", … to `base` until it no longer collides with `existing`. */
export function makeUniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Most frequently occurring surname among the given people (or null). */
export function deriveSurname(people: Person[]): string | null {
  const counts = new Map<string, number>();
  for (const p of people) {
    const ln = p.lastName?.trim();
    if (!ln) continue;
    counts.set(ln, (counts.get(ln) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  counts.forEach((c, ln) => {
    if (c > bestCount) {
      best = ln;
      bestCount = c;
    }
  });
  return best;
}

/** Human-readable label for a graph type, used in auto-generated view names. */
export function graphTypeLabel(t: GraphType): string {
  switch (t) {
    case 'ancestor':
      return 'Ancestors';
    case 'descendant':
      return 'Descendants';
    case 'hourglass':
      return 'Hourglass';
  }
}

