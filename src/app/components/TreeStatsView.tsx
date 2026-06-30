import type { FamilyTree, Person } from '../types';
import { Users, CalendarDays, MapPin, Tag, TrendingUp, ArrowLeft } from 'lucide-react';

interface TreeStatsViewProps {
  tree: FamilyTree;
  onBack: () => void;
}

// ── Pure computation helpers ───────────────────────────────────────────────

function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const m = dateStr.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return m ? parseInt(m[1]) : null;
}

function frequency<T extends string>(items: T[]): [T, number][] {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return ([...counts.entries()] as [T, number][]).sort((a, b) => b[1] - a[1]);
}

function computeStats(people: Person[]) {
  const n = people.length;

  // Completeness
  const withBirthDate  = people.filter(p => p.birthDate).length;
  const withBirthPlace = people.filter(p => p.birthPlace).length;
  const withDeathDate  = people.filter(p => p.deathDate).length;
  const withGender     = people.filter(p => p.gender).length;

  const genderMale    = people.filter(p => p.gender === 'male').length;
  const genderFemale  = people.filter(p => p.gender === 'female').length;
  const genderOther   = people.filter(p => p.gender === 'other').length;
  const genderUnknown = n - withGender;

  // Birth-year range + oldest/youngest
  const withYear = people
    .map(p => ({ person: p, year: extractYear(p.birthDate) }))
    .filter((x): x is { person: Person; year: number } => x.year !== null);

  const earliestEntry = withYear.length
    ? withYear.reduce((a, b) => (a.year < b.year ? a : b))
    : null;
  const latestEntry   = withYear.length
    ? withYear.reduce((a, b) => (a.year > b.year ? a : b))
    : null;

  // Name frequencies
  const firstNames  = frequency(people.map(p => p.firstName).filter(Boolean));
  const lastNames   = frequency(people.map(p => p.lastName).filter(Boolean));

  // Birth-place frequencies (use last comma-segment as "parish/village" for brevity)
  const placeParts = people
    .map(p => p.birthPlace?.trim())
    .filter((x): x is string => Boolean(x))
    .map(bp => {
      const parts = bp.split(',');
      return parts[parts.length - 1].trim().replace(/\s+\d+$/, '').trim();
    })
    .filter(Boolean);
  const places = frequency(placeParts);

  return {
    n,
    withBirthDate, withBirthPlace, withDeathDate, withGender,
    genderMale, genderFemale, genderOther, genderUnknown,
    earliestEntry, latestEntry,
    firstNames, lastNames, places,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function pct(n: number, total: number) {
  if (!total) return '0 %';
  return `${Math.round((n / total) * 100)} %`;
}

function BarChart({ title, icon, data, total }: {
  title: string;
  icon: React.ReactNode;
  data: [string, number][];
  total: number;
}) {
  const maxVal = data[0]?.[1] ?? 1;
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data</p>
      ) : (
        <ul className="space-y-2">
          {data.slice(0, 10).map(([label, count]) => (
            <li key={label} className="text-sm">
              <div className="flex justify-between mb-0.5">
                <span className="truncate max-w-[70%]" title={label}>{label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {count} <span className="text-xs">({pct(count, total)})</span>
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(count / maxVal) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompletenessBar({ label, count, total }: { label: string; count: number; total: number }) {
  const p = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="text-sm">
      <div className="flex justify-between mb-0.5">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{count.toLocaleString()} ({p} %)</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${p}%`,
            backgroundColor: p > 75 ? '#22c55e' : p > 40 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function TreeStatsView({ tree, onBack }: TreeStatsViewProps) {
  const s = computeStats(tree.people);

  const yearSpan = s.earliestEntry && s.latestEntry
    ? `${s.earliestEntry.year} – ${s.latestEntry.year}`
    : '—';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="text-lg font-semibold">{tree.name}</h1>
            <p className="text-xs text-muted-foreground">Statistics</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="People" value={s.n.toLocaleString()} />
          <StatCard label="Year span" value={yearSpan} />
          <StatCard
            label="Oldest (by birth)"
            value={s.earliestEntry ? `${s.earliestEntry.year}` : '—'}
            sub={s.earliestEntry
              ? `${s.earliestEntry.person.firstName} ${s.earliestEntry.person.lastName}`
              : undefined}
          />
          <StatCard
            label="Youngest (by birth)"
            value={s.latestEntry ? `${s.latestEntry.year}` : '—'}
            sub={s.latestEntry
              ? `${s.latestEntry.person.firstName} ${s.latestEntry.person.lastName}`
              : undefined}
          />
        </div>

        {/* Data completeness */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Data Completeness</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            <CompletenessBar label="Birth date"  count={s.withBirthDate}  total={s.n} />
            <CompletenessBar label="Birth place" count={s.withBirthPlace} total={s.n} />
            <CompletenessBar label="Death date"  count={s.withDeathDate}  total={s.n} />
            <CompletenessBar label="Gender"      count={s.withGender}     total={s.n} />
          </div>
        </div>

        {/* Gender */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Gender Distribution</h3>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <GenderBadge label="Male"    count={s.genderMale}    total={s.n} color="#3b82f6" />
            <GenderBadge label="Female"  count={s.genderFemale}  total={s.n} color="#ec4899" />
            {s.genderOther   > 0 && <GenderBadge label="Other"   count={s.genderOther}   total={s.n} color="#8b5cf6" />}
            {s.genderUnknown > 0 && <GenderBadge label="Unknown" count={s.genderUnknown} total={s.n} color="#9ca3af" />}
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BarChart
            title="Top First Names"
            icon={<Tag className="w-4 h-4 text-muted-foreground" />}
            data={s.firstNames}
            total={s.n}
          />
          <BarChart
            title="Top Last Names"
            icon={<Tag className="w-4 h-4 text-muted-foreground" />}
            data={s.lastNames}
            total={s.n}
          />
          <BarChart
            title="Top Birth Places"
            icon={<MapPin className="w-4 h-4 text-muted-foreground" />}
            data={s.places}
            total={s.withBirthPlace}
          />
        </div>

        {/* Birth decade histogram */}
        {s.earliestEntry && s.latestEntry && (
          <DecadeHistogram people={tree.people} />
        )}

      </div>
    </div>
  );
}

function GenderBadge({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span>{label}</span>
      <span className="font-semibold">{count.toLocaleString()}</span>
      <span className="text-muted-foreground text-xs">({pct(count, total)})</span>
    </div>
  );
}

function DecadeHistogram({ people }: { people: Person[] }) {
  const decades = new Map<number, number>();
  for (const p of people) {
    const y = extractYear(p.birthDate);
    if (y === null) continue;
    const decade = Math.floor(y / 10) * 10;
    decades.set(decade, (decades.get(decade) ?? 0) + 1);
  }
  if (decades.size === 0) return null;

  const sorted = [...decades.entries()].sort((a, b) => a[0] - b[0]);
  const maxCount = Math.max(...sorted.map(([, c]) => c));

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Births per Decade</h3>
      </div>
      <div className="flex items-end gap-1 h-32 overflow-x-auto">
        {sorted.map(([decade, count]) => (
          <div key={decade} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 36 }}>
            <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
            <div
              className="w-7 bg-primary rounded-t opacity-80 hover:opacity-100 transition-opacity"
              style={{ height: `${(count / maxCount) * 96}px` }}
              title={`${decade}s: ${count} people`}
            />
            <span
              className="text-[9px] text-muted-foreground tabular-nums"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}
            >
              {decade}s
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
