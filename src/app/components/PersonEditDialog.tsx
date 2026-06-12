import { useState, useEffect, useMemo } from 'react';
import type { Person, Marriage } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Search, X, Users, Baby, UserRound } from 'lucide-react';

interface PersonEditDialogProps {
  person: Person | null;
  people: Person[];
  open: boolean;
  onClose: () => void;
  onSave: (person: Person) => void;
}

// ── Small read-only person card ───────────────────────────────────────────────
function PersonCard({ person }: { person: Person }) {
  const genderIcon = person.gender === 'male' ? '♂' : person.gender === 'female' ? '♀' : null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border rounded-md">
      {genderIcon && (
        <span className="text-muted-foreground text-sm shrink-0">{genderIcon}</span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium leading-none truncate">
          {person.firstName} {person.lastName}
        </p>
        {(person.birthDate || person.deathDate) && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {person.birthDate && `* ${person.birthDate}`}
            {person.birthDate && person.birthPlace && `, ${person.birthPlace}`}
            {person.birthDate && person.deathDate && ' · '}
            {person.deathDate && `† ${person.deathDate}`}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Inline person picker ──────────────────────────────────────────────────────
function PersonPicker({
  label,
  selectedId,
  people,
  excludeIds,
  onChange,
}: {
  label: string;
  selectedId?: string;
  people: Person[];
  excludeIds: string[];
  onChange: (id: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');

  const selected = people.find(p => p.id === selectedId);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return people
      .filter(
        p =>
          !excludeIds.includes(p.id) &&
          (q === '' || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)),
      )
      .slice(0, 50);
  }, [query, people, excludeIds]);

  useEffect(() => {
    setEditing(false);
    setQuery('');
  }, [selectedId]);

  if (selected && !editing) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1 px-3 py-2 bg-muted/40 border border-border rounded-md">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate">
              {selected.firstName} {selected.lastName}
            </p>
            {(selected.birthDate || selected.deathDate) && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {selected.birthDate && `* ${selected.birthDate}`}
                {selected.birthDate && selected.birthPlace && `, ${selected.birthPlace}`}
                {selected.birthDate && selected.deathDate && ' · '}
                {selected.deathDate && `† ${selected.deathDate}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-xs text-primary hover:underline px-1"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 text-muted-foreground hover:text-destructive p-0.5"
            title="Remove"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus={editing}
            />
          </div>
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => { setEditing(false); setQuery(''); }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        {(editing || query.length > 0) && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto z-50">
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                onClick={() => { onChange(p.id); setEditing(false); setQuery(''); }}
              >
                <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                {(p.birthDate || p.birthPlace) && (
                  <p className="text-xs text-muted-foreground">
                    {p.birthDate && `* ${p.birthDate}`}
                    {p.birthDate && p.birthPlace && `, ${p.birthPlace}`}
                    {!p.birthDate && p.birthPlace}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
        {query.length > 0 && filtered.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground px-1">No people found.</p>
        )}
      </div>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────
export function PersonEditDialog({ person, people, open, onClose, onSave }: PersonEditDialogProps) {
  const [formData, setFormData] = useState<Person>(
    person ?? { id: '', firstName: '', lastName: '', gender: 'other' },
  );

  useEffect(() => {
    if (person && open) setFormData(person);
  }, [person, open]);

  const handleChange = (field: keyof Person, value: string | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /** Update a per-spouse marriage entry inside formData.marriages[]. */
  const handleMarriageChange = (spouseId: string | undefined, field: keyof Omit<Marriage, 'spouseId'>, value: string | undefined) => {
    setFormData(prev => {
      const marriages = [...(prev.marriages ?? [])];
      const key = spouseId ?? '';
      const idx = marriages.findIndex(m => m.spouseId === key);
      if (idx >= 0) {
        marriages[idx] = { ...marriages[idx], [field]: value || undefined };
      } else {
        marriages.push({ spouseId: key, [field]: value || undefined });
      }
      return { ...prev, marriages };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!person) return null;

  // ── Familie: spouses & children ───────────────────────────────────────────
  const children = people.filter(
    p => p.fatherId === person.id || p.motherId === person.id,
  );

  type SpouseGroup = { spouseId: string | undefined; spouse: Person | null; children: Person[] };
  const spouseMap = new Map<string, SpouseGroup>();
  children.forEach(child => {
    const otherId = child.fatherId === person.id ? child.motherId : child.fatherId;
    const key = otherId ?? '__unknown__';
    if (!spouseMap.has(key)) {
      spouseMap.set(key, {
        spouseId: otherId,
        spouse: otherId ? (people.find(p => p.id === otherId) ?? null) : null,
        children: [],
      });
    }
    spouseMap.get(key)!.children.push(child);
  });
  const spouseGroups = [...spouseMap.values()];

  const familyBadge =
    spouseGroups.reduce((s, g) => s + g.children.length, 0) +
    (formData.fatherId ? 1 : 0) +
    (formData.motherId ? 1 : 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />
            {person.firstName} {person.lastName}
            {person.birthDate && (
              <span className="text-sm font-normal text-muted-foreground">
                * {person.birthDate}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <Tabs defaultValue="stammdaten" className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <TabsList className="mx-6 mt-3 mb-0 self-start shrink-0">
              <TabsTrigger value="stammdaten">Master Data</TabsTrigger>
              <TabsTrigger value="familie" className="gap-1.5">
                Family
                {familyBadge > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold bg-primary/15 text-primary rounded-full">
                    {familyBadge}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Stammdaten ───────────────────────────────────────── */}
            <TabsContent
              value="stammdaten"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-5 mt-0 data-[state=inactive]:hidden"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={e => handleChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={e => handleChange('lastName', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={formData.gender ?? 'other'}
                  onValueChange={v => handleChange('gender', v)}
                >
                  <SelectTrigger id="gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male ♂</SelectItem>
                    <SelectItem value="female">Female ♀</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Birth</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate">Date</Label>
                    <Input
                      id="birthDate"
                      value={formData.birthDate ?? ''}
                      onChange={e => handleChange('birthDate', e.target.value || undefined)}
                      placeholder="e.g. 1875-01-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="birthPlace">Place</Label>
                    <Input
                      id="birthPlace"
                      value={formData.birthPlace ?? ''}
                      onChange={e => handleChange('birthPlace', e.target.value || undefined)}
                      placeholder="e.g. Berlin"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Death</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="deathDate">Date</Label>
                    <Input
                      id="deathDate"
                      value={formData.deathDate ?? ''}
                      onChange={e => handleChange('deathDate', e.target.value || undefined)}
                      placeholder="e.g. 1950-02-06"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deathPlace">Place</Label>
                    <Input
                      id="deathPlace"
                      value={formData.deathPlace ?? ''}
                      onChange={e => handleChange('deathPlace', e.target.value || undefined)}
                      placeholder="e.g. Munich"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Tab 2: Familie ──────────────────────────────────────────── */}
            <TabsContent
              value="familie"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-6 mt-0 data-[state=inactive]:hidden"
            >
              {/* Parents */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  Parents
                </h3>
                <PersonPicker
                  label="Father"
                  selectedId={formData.fatherId}
                  people={people}
                  excludeIds={[person.id, ...(formData.motherId ? [formData.motherId] : [])]}
                  onChange={id => handleChange('fatherId', id)}
                />
                <PersonPicker
                  label="Mother"
                  selectedId={formData.motherId}
                  people={people}
                  excludeIds={[person.id, ...(formData.fatherId ? [formData.fatherId] : [])]}
                  onChange={id => handleChange('motherId', id)}
                />
              </section>

              {/* Marriages & Children */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Baby className="w-4 h-4 text-muted-foreground" />
                  Marriages &amp; Children
                </h3>

                {spouseGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No children found in the database.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {spouseGroups.map((group, i) => (
                      <div
                        key={group.spouseId ?? `unknown-${i}`}
                        className="border border-border rounded-lg overflow-hidden"
                      >
                        {/* Ehepartner-Header */}
                        <div className="px-3 py-2 bg-muted/30 border-b border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-1.5">
                            Spouse
                          </p>
                          {group.spouse ? (
                            <PersonCard person={group.spouse} />
                          ) : (
                            <p className="text-sm text-muted-foreground italic">Unknown</p>
                          )}
                        </div>

                        {/* Marriage date/place for this couple */}
                        <div className="px-3 py-2.5 border-b border-border space-y-2">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            ⚭ Marriage
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Date</Label>
                              <Input
                                className="h-8 text-xs"
                                value={formData.marriages?.find((m: Marriage) => m.spouseId === (group.spouseId ?? ''))?.date ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMarriageChange(group.spouseId, 'date', e.target.value)}
                                placeholder="e.g. 1900-06-22"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Place</Label>
                              <Input
                                className="h-8 text-xs"
                                value={formData.marriages?.find((m: Marriage) => m.spouseId === (group.spouseId ?? ''))?.place ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleMarriageChange(group.spouseId, 'place', e.target.value)}
                                placeholder="e.g. Hamburg"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Children */}
                        <div className="px-3 py-2.5 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">
                            Children ({group.children.length})
                          </p>
                          {group.children
                            .slice()
                            .sort((a, b) => {
                              const ya = a.birthDate ? parseInt(a.birthDate) : 9999;
                              const yb = b.birthDate ? parseInt(b.birthDate) : 9999;
                              return ya - yb;
                            })
                            .map(child => (
                              <PersonCard key={child.id} person={child} />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
