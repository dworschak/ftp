import { Person } from '../types';

// ─── GEDCOM date normalisation ───────────────────────────────────────────────

const MONTH: Record<string, string> = {
    // English
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
    // Deutsch (ancestry.de, etc.)
    'MÄR': '03', 'MÄZ': '03', // both variants
    'MAI': '05',
    'OKT': '10',
    'DEZ': '12',
    // Fallback für weitere Varianten
    'JANUAR': '01', 'FEBRUAR': '02', 'MÄRZ': '03', 'APRIL': '04',
    'JUNI': '06', 'JULI': '07', 'AUGUST': '08', 'SEPTEMBER': '09',
    'OKTOBER': '10', 'NOVEMBER': '11', 'DEZEMBER': '12',
};

function normaliseDate(raw: string): string {
  if (!raw) return raw;
  const s = raw.trim();
  
  // "15 JAN 1950" → "1950-01-15"
  const full = s.match(/^(\d{1,2})\s+([A-ZÄÖÜäöü]{3,})\s+(\d{4})$/i);
  if (full) {
    const monthUpper = full[2].toUpperCase();
    const m = MONTH[monthUpper];
    if (m) {
      return `${full[3]}-${m}-${full[1].padStart(2, '0')}`;
    }
    // Unbekannter Monat → Warnung (wird später gezeigt)
    return s;
  }
  
  // "JAN 1950" → "1950-01"
  const my = s.match(/^([A-ZÄÖÜäöü]{3,})\s+(\d{4})$/i);
  if (my) {
    const monthUpper = my[1].toUpperCase();
    const m = MONTH[monthUpper];
    if (m) {
      return `${my[2]}-${m}`;
    }
    return s;
  }
  
  // "1974" → "1974" (nur Jahr – akzeptiert)
  if (s.match(/^\d{4}$/)) {
    return s;
  }
  
  // Qualifier wie "ca", "um", "vor", "nach", "abt", "bef", "aft" + Jahr
  // "ca 1970" → "ca 1970", "vor 1979" → "vor 1979", etc.
  if (s.match(/^(ca|um|vor|nach|abt|bef|aft|est)\s+\d{4}$/i)) {
    return s;
  }
  
  // Ein Qualifier mit Monat+Jahr: "ca JAN 1950" → versuchen zu normalisieren
  const qualifiedFull = s.match(/^(ca|um|vor|nach|abt|bef|aft|est)\s+(\d{1,2})\s+([A-ZÄÖÜäöü]{3,})\s+(\d{4})$/i);
  if (qualifiedFull) {
    const qualifier = qualifiedFull[1];
    const monthUpper = qualifiedFull[3].toUpperCase();
    const m = MONTH[monthUpper];
    if (m) {
      return `${qualifier} ${qualifiedFull[4]}-${m}-${qualifiedFull[2].padStart(2, '0')}`;
    }
    // Monat nicht erkannt → as-is
    return s;
  }
  
  // Qualifier mit Monat+Jahr: "ca JAN 1950"
  const qualifiedMy = s.match(/^(ca|um|vor|nach|abt|bef|aft|est)\s+([A-ZÄÖÜäöü]{3,})\s+(\d{4})$/i);
  if (qualifiedMy) {
    const qualifier = qualifiedMy[1];
    const monthUpper = qualifiedMy[2].toUpperCase();
    const m = MONTH[monthUpper];
    if (m) {
      return `${qualifier} ${qualifiedMy[3]}-${m}`;
    }
    return s;
  }
  
  // Qualifier mit nur Jahr: "ca 1970" (already handled above, this is fallback)
  // qualifier prefix ("ABT 1950", "BEF 1900", …) – keep as-is
  return s;
}

// ─── Parser types ────────────────────────────────────────────────────────────

interface GedcomIndividual {
  id: string;       // raw GEDCOM id incl. @
  rawName?: string;
  sex?: string;
  birth?: { date?: string; place?: string };
  deat?:  { date?: string; place?: string };
  marr?:  { date?: string; place?: string };   // from FAM, injected later
  occu?:  { value?: string; from?: string; to?: string };
}

interface GedcomFamily {
  id: string;
  husbId?: string;
  wifeId?: string;
  children: string[];
  marr?: { date?: string; place?: string };
}

export interface GedcomStats {
  individualCount: number;
  familyCount: number;
  birthCount: number;
  deathCount: number;
  marriageCount: number;
}

export interface GedcomResult {
  people: Person[];
  stats: GedcomStats;
  errors: string[];
  /** Tree name extracted from the GEDCOM header (2 _TREE or 1 TITL). */
  suggestedName?: string;
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseGedcom(content: string): GedcomResult {
  // Strip BOM and normalise line endings
  const text = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const individuals = new Map<string, GedcomIndividual>();
  const families    = new Map<string, GedcomFamily>();

  let curIndi: GedcomIndividual | null = null;
  let curFam:  GedcomFamily  | null = null;
  let level1Tag = '';  // last encountered level-1 tag (for level-2 sub-tags)
  let inHead    = false; // true while parsing the HEAD record
  let headTreeName = ''; // from "2 _TREE …" under "1 SOUR"
  let headTitle    = ''; // from "1 TITL …"

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const spaceIdx  = line.indexOf(' ');
    if (spaceIdx === -1) continue;
    const level     = parseInt(line.slice(0, spaceIdx), 10);
    if (isNaN(level)) continue;
    const rest      = line.slice(spaceIdx + 1);
    const spaceIdx2 = rest.indexOf(' ');
    const tag       = spaceIdx2 === -1 ? rest : rest.slice(0, spaceIdx2);
    const value     = spaceIdx2 === -1 ? '' : rest.slice(spaceIdx2 + 1).trim();

    if (level === 0) {
      curIndi = null;
      curFam  = null;
      level1Tag = '';
      inHead    = false;

      // Level-0 with xref: "0 @I001@ INDI" or "0 @F001@ FAM"
      if (tag.startsWith('@')) {
        const xref = tag; // e.g. "@I001@"
        const type = value.toUpperCase();
        if (type === 'INDI') {
          curIndi = { id: xref, children: [] as never[] } as GedcomIndividual;
          individuals.set(xref, curIndi);
        } else if (type === 'FAM') {
          curFam = { id: xref, children: [] };
          families.set(xref, curFam);
        }
      } else if (tag.toUpperCase() === 'HEAD') {
        inHead = true;
      }
      continue;
    }

    if (level === 1) {
      level1Tag = tag.toUpperCase();
      if (inHead) {
        // Capture plain "1 TITL <value>" as a fallback tree name
        if (level1Tag === 'TITL' && value) headTitle = value.trim();
      } else if (curIndi) {
        switch (level1Tag) {
          case 'NAME': curIndi.rawName = value; break;
          case 'SEX':  curIndi.sex     = value.toUpperCase(); break;
          case 'BIRT': curIndi.birth   = {}; break;
          case 'DEAT': curIndi.deat    = {}; break;
          // MARR on INDI is unusual but handle gracefully
          case 'MARR': curIndi.marr    = {}; break;
          case 'OCCU': curIndi.occu    = { value: value || undefined }; break;
        }
      } else if (curFam) {
        switch (level1Tag) {
          case 'HUSB': curFam.husbId = value; break;
          case 'WIFE': curFam.wifeId = value; break;
          case 'CHIL': curFam.children.push(value); break;
          case 'MARR': curFam.marr = {}; break;
        }
      }
      continue;
    }

    if (level === 2) {
      const subTag = tag.toUpperCase();
      if (inHead) {
        // "1 SOUR … / 2 _TREE <value>" – Ancestry.com and similar exporters
        if (level1Tag === 'SOUR' && subTag === '_TREE' && value) {
          headTreeName = value.trim();
        }
      } else if (curIndi) {
        if (level1Tag === 'BIRT' && curIndi.birth) {
          if (subTag === 'DATE') curIndi.birth.date  = normaliseDate(value);
          if (subTag === 'PLAC') curIndi.birth.place = value;
        } else if (level1Tag === 'DEAT' && curIndi.deat) {
          if (subTag === 'DATE') curIndi.deat.date  = normaliseDate(value);
          if (subTag === 'PLAC') curIndi.deat.place = value;
        } else if (level1Tag === 'OCCU' && curIndi.occu) {
          if (subTag === 'DATE') {
            // Period: "FROM 1900 TO 1925" / "FROM 1900" / "TO 1925" / single date
            const range = value.match(/^FROM\s+(.+?)(?:\s+TO\s+(.+))?$/i);
            if (range) {
              curIndi.occu.from = range[1].trim();
              if (range[2]) curIndi.occu.to = range[2].trim();
            } else {
              const toOnly = value.match(/^TO\s+(.+)$/i);
              if (toOnly) curIndi.occu.to = toOnly[1].trim();
              else curIndi.occu.from = value.trim();
            }
          }
        }
      } else if (curFam) {
        if (level1Tag === 'MARR') {
          if (!curFam.marr) curFam.marr = {};
          if (subTag === 'DATE') curFam.marr.date  = normaliseDate(value);
          if (subTag === 'PLAC') curFam.marr.place = value;
        }
      }
    }
  }

  // ─── Build Person objects ───────────────────────────────────────────────────

  const errors: string[] = [];

  // Strip @ signs from xref → usable as JS id
  const toId = (xref: string) => xref.replace(/@/g, '');

  const personMap = new Map<string, Person>();

  for (const [xref, indi] of individuals) {
    let firstName = '';
    let lastName  = '';

    if (indi.rawName) {
      // "Given /Surname/ Suffix"  or  "/Surname/" or "Given /Surname/"
      const m = indi.rawName.match(/^([^/]*)\s*\/([^/]*)\/(.*)?$/);
      if (m) {
        firstName = (m[1].trim() + ' ' + (m[3] ?? '').trim()).trim();
        lastName  = m[2].trim();
      } else {
        // No slashes – split last word as surname
        const parts = indi.rawName.trim().split(/\s+/);
        lastName  = parts.length > 1 ? (parts.pop() ?? '') : '';
        firstName = parts.join(' ');
      }
    }

    // Check dates for unparseable months
    // Only warn if the input contains month-like text that we couldn't parse
    const checkUnparsedMonth = (dateStr: string | undefined): boolean => {
      if (!dateStr) return false;
      // Check if it contains 3+ letter word + year that looks like a month abbreviation
      // but doesn't match our MONTH map
      const monthLike = dateStr.match(/([A-ZÄÖÜäöü]{3,})\s+(\d{4})/i);
      if (monthLike) {
        const monthUpper = monthLike[1].toUpperCase();
        const isKnownQualifier = ['CA', 'UM', 'VOR', 'NACH', 'ABT', 'BEF', 'AFT', 'EST'].includes(monthUpper);
        if (!isKnownQualifier && !MONTH[monthUpper]) {
          return true; // Unknown month
        }
      }
      return false;
    };

    if (checkUnparsedMonth(indi.birth?.date)) {
      errors.push(`Geburtsdatum "${indi.birth?.date}" enthält unbekannten Monatsnamen`);
    }
    if (checkUnparsedMonth(indi.deat?.date)) {
      errors.push(`Sterbedatum "${indi.deat?.date}" enthält unbekannten Monatsnamen`);
    }

    const person: Person = {
      id:         toId(xref),
      firstName:  firstName || '(Unbekannt)',
      lastName:   lastName,
      birthDate:  indi.birth?.date  || undefined,
      birthPlace: indi.birth?.place || undefined,
      deathDate:  indi.deat?.date   || undefined,
      deathPlace: indi.deat?.place  || undefined,
      gender:     indi.sex === 'M' ? 'male'
                : indi.sex === 'F' ? 'female'
                : undefined,
      occupation:     indi.occu?.value || undefined,
      occupationFrom: indi.occu?.from  || undefined,
      occupationTo:   indi.occu?.to    || undefined,
    };

    personMap.set(xref, person);
  }

  // ─── Apply family links ──────────────────────────────────────────────────

  for (const [, fam] of families) {
    const husbPerson = fam.husbId ? personMap.get(fam.husbId) : null;
    const wifePerson = fam.wifeId ? personMap.get(fam.wifeId) : null;

    if (fam.husbId && !husbPerson) errors.push(`Ehemann ${fam.husbId} nicht gefunden`);
    if (fam.wifeId && !wifePerson) errors.push(`Ehefrau ${fam.wifeId} nicht gefunden`);

    // Marriage info → store per-spouse in marriages[] on both partners.
    // We always create an entry when BOTH spouses are known – even if the FAM
    // record has no MARR tag – so the relationship is explicitly persisted in
    // the marriages JSONB column (not just inferred from shared children).
    if (husbPerson && wifePerson) {
      const mDate  = fam.marr?.date  || undefined;
      const mPlace = fam.marr?.place || undefined;
      husbPerson.marriages = [
        ...(husbPerson.marriages ?? []).filter(m => m.spouseId !== wifePerson.id),
        { spouseId: wifePerson.id, date: mDate, place: mPlace },
      ];
      wifePerson.marriages = [
        ...(wifePerson.marriages ?? []).filter(m => m.spouseId !== husbPerson.id),
        { spouseId: husbPerson.id, date: mDate, place: mPlace },
      ];
    }

    // Parent links for children
    for (const childXref of fam.children) {
      const child = personMap.get(childXref);
      if (!child) {
        errors.push(`Kind ${childXref} nicht gefunden`);
        continue;
      }
      if (husbPerson) child.fatherId = husbPerson.id;
      if (wifePerson) child.motherId = wifePerson.id;
    }
  }

  const people = Array.from(personMap.values());

  const stats: GedcomStats = {
    individualCount: individuals.size,
    familyCount:     families.size,
    birthCount:      people.filter(p => p.birthDate).length,
    deathCount:      people.filter(p => p.deathDate).length,
    marriageCount:   Array.from(families.values()).filter(f => f.marr).length,
  };

  return { people, stats, errors, suggestedName: headTreeName || headTitle || undefined };
}

