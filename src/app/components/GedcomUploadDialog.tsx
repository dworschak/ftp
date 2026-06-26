import { useState, useRef, useMemo } from 'react';
import type { Person } from '../types';
import { parseGedcom, GedcomResult } from '../lib/gedcomParser';
import { computeGedcomDiff, applyGedcomMerge, GedcomDiff } from '../lib/gedcomMerge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Upload, AlertTriangle, CheckCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

type ImportMode = 'replace' | 'merge';

interface GedcomUploadDialogProps {
  open: boolean;
  treeName: string;
  /** Current people in the tree – enables the Merge option when non-empty. */
  existingPeople?: Person[];
  onClose: () => void;
  /** Called when the user confirms the import. */
  onImport: (people: Person[], suggestedName?: string) => Promise<void>;
}

export function GedcomUploadDialog({
  open,
  treeName,
  existingPeople = [],
  onClose,
  onImport,
}: GedcomUploadDialogProps) {
  const [parsed, setParsed]       = useState<GedcomResult | null>(null);
  const [fileName, setFileName]   = useState('');
  const [dragging, setDragging]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [mode, setMode]           = useState<ImportMode>('replace');
  const fileRef = useRef<HTMLInputElement>(null);

  const hasExisting = existingPeople.length > 0;

  const diff = useMemo<GedcomDiff | null>(() => {
    if (!parsed || mode !== 'merge' || !hasExisting) return null;
    return computeGedcomDiff(existingPeople, parsed.people);
  }, [parsed, mode, existingPeople, hasExisting]);

  const handleFile = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setImportError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setParsed(parseGedcom(text));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    setImporting(true);
    setImportError('');
    try {
      const people =
        mode === 'merge' && hasExisting
          ? applyGedcomMerge(existingPeople, parsed.people)
          : parsed.people;
      await onImport(people, parsed.suggestedName);
      handleClose();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParsed(null);
    setFileName('');
    setImportError('');
    setMode('replace');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import GEDCOM</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target tree info */}
          <p className="text-sm text-muted-foreground">
            Importing into <strong>{treeName}</strong>.
          </p>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-foreground/30'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Drag .ged file here or click to select
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".ged,.gedcom"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>

          {/* Mode toggle – only when tree already has people */}
          {hasExisting && parsed && (
            <div className="flex rounded-md overflow-hidden border border-border text-sm">
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`flex-1 px-3 py-1.5 transition-colors ${
                  mode === 'replace'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground hover:bg-muted'
                }`}
              >
                Replace all
              </button>
              <button
                type="button"
                onClick={() => setMode('merge')}
                className={`flex-1 px-3 py-1.5 transition-colors ${
                  mode === 'merge'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-foreground hover:bg-muted'
                }`}
              >
                Merge
              </button>
            </div>
          )}

          {/* Stats after parse */}
          {parsed && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <CheckCircle className="w-4 h-4" />
                File read – ready to import
              </div>

              {parsed.suggestedName && mode === 'replace' && (
                <p className="text-sm text-muted-foreground">
                  Tree will be renamed to <strong>{parsed.suggestedName}</strong>
                </p>
              )}

              {mode === 'replace' ? (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label="People"    value={parsed.stats.individualCount} />
                  <Stat label="Families"  value={parsed.stats.familyCount} />
                  <Stat label="Marriages" value={parsed.stats.marriageCount} />
                  <Stat label="Births"    value={parsed.stats.birthCount} />
                  <Stat label="Deaths"    value={parsed.stats.deathCount} />
                </div>
              ) : diff && (
                <DiffPanel diff={diff} />
              )}

              {parsed.errors.length > 0 && (
                <details className="text-xs">
                  <summary className="flex items-center gap-1 cursor-pointer text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    {parsed.errors.length} Warning(s) – Details
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground max-h-32 overflow-y-auto pl-4 list-disc">
                    {parsed.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* Import error */}
          {importError && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {importError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!parsed || importing}
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
              ) : mode === 'merge' && hasExisting ? (
                `Merge ${parsed?.stats.individualCount ?? 0} People`
              ) : (
                `Import ${parsed?.stats.individualCount ?? 0} People`
              )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/40 rounded p-2 text-center">
      <div className="text-lg font-semibold">{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function DiffPanel({ diff }: { diff: GedcomDiff }) {
  const [showAdded,   setShowAdded]   = useState(false);
  const [showUpdated, setShowUpdated] = useState(false);
  const [showKept,    setShowKept]    = useState(false);

  const personName = (p: { firstName: string; lastName: string }) =>
    [p.firstName, p.lastName].filter(Boolean).join(' ');

  return (
    <div className="space-y-2 text-sm">
      {/* Added */}
      <DiffSection
        count={diff.added.length}
        label="new people"
        color="text-green-600"
        prefix="+"
        open={showAdded}
        onToggle={() => setShowAdded(v => !v)}
      >
        <ul className="pl-4 list-disc text-muted-foreground space-y-0.5">
          {diff.added.map(p => <li key={p.id}>{personName(p)}</li>)}
        </ul>
      </DiffSection>

      {/* Updated */}
      <DiffSection
        count={diff.updated.length}
        label="people updated"
        color="text-amber-600"
        prefix="~"
        open={showUpdated}
        onToggle={() => setShowUpdated(v => !v)}
      >
        <ul className="pl-4 space-y-2 text-muted-foreground">
          {diff.updated.map(({ existing, changes }) => (
            <li key={existing.id}>
              <span className="font-medium text-foreground">{personName(existing)}</span>
              <ul className="pl-3 list-disc space-y-0.5 mt-0.5">
                {changes.map(c => (
                  <li key={c.field} className="text-xs">
                    <span className="font-medium">{c.label}:</span>{' '}
                    <span className="line-through opacity-60">{c.oldValue ?? '—'}</span>
                    {' → '}
                    <span>{c.newValue ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </DiffSection>

      {/* Only in existing (kept) */}
      <DiffSection
        count={diff.onlyInExisting.length}
        label="kept (not in GEDCOM)"
        color="text-muted-foreground"
        prefix="•"
        open={showKept}
        onToggle={() => setShowKept(v => !v)}
      >
        <ul className="pl-4 list-disc text-muted-foreground space-y-0.5">
          {diff.onlyInExisting.map(p => <li key={p.id}>{personName(p)}</li>)}
        </ul>
      </DiffSection>
    </div>
  );
}

function DiffSection({
  count, label, color, prefix, open, onToggle, children,
}: {
  count: number;
  label: string;
  color: string;
  prefix: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={count > 0 ? onToggle : undefined}
        className={`flex items-center gap-1.5 w-full text-left ${count > 0 ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {count > 0 ? (
          open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
        ) : (
          <span className="w-3" />
        )}
        <span className={`font-medium ${color}`}>{prefix}{count}</span>
        <span className="text-muted-foreground">{label}</span>
      </button>
      {open && count > 0 && (
        <div className="mt-1 max-h-40 overflow-y-auto text-xs">
          {children}
        </div>
      )}
    </div>
  );
}
