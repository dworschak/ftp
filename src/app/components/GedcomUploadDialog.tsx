import { useState, useRef } from 'react';
import { Person } from '../types';
import { parseGedcom, GedcomResult } from '../lib/gedcomParser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Upload, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface GedcomUploadDialogProps {
  open: boolean;
  treeName: string;
  onClose: () => void;
  /** Called when the user confirms the import. */
  onImport: (people: Person[], suggestedName?: string) => Promise<void>;
}

export function GedcomUploadDialog({
  open,
  treeName,
  onClose,
  onImport,
}: GedcomUploadDialogProps) {
  const [parsed, setParsed]       = useState<GedcomResult | null>(null);
  const [fileName, setFileName]   = useState('');
  const [dragging, setDragging]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
      await onImport(parsed.people, parsed.suggestedName);
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
            This file will replace all people in <strong>{treeName}</strong>.
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

          {/* Stats after parse */}
          {parsed && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <CheckCircle className="w-4 h-4" />
                File read – ready to import
              </div>

              {parsed.suggestedName && (
                <p className="text-sm text-muted-foreground">
                  Tree will be renamed to <strong>{parsed.suggestedName}</strong>
                </p>
              )}

              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="People"     value={parsed.stats.individualCount} />
                <Stat label="Families"   value={parsed.stats.familyCount} />
                <Stat label="Marriages"  value={parsed.stats.marriageCount} />
                <Stat label="Births"     value={parsed.stats.birthCount} />
                <Stat label="Deaths"     value={parsed.stats.deathCount} />
              </div>

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
