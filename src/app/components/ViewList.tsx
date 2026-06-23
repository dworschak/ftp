import { useRef, useState } from 'react';
import { FamilyTree } from '../types';
import { Plus, Eye, Trash2, Upload, Pencil } from 'lucide-react';
import { formatDate } from '../utils/dateFormat';

interface ViewListProps {
  tree: FamilyTree;
  onSelectView: (viewId: string) => void;
  onCreateView: () => void;
  onDeleteView: (viewId: string) => void;
  onRenameView: (viewId: string, newName: string) => void;
  onUploadGedcom: () => void;
  onBack: () => void;
  onLogout: () => void;
  userEmail: string;
}

export function ViewList({
  tree,
  onSelectView,
  onCreateView,
  onDeleteView,
  onRenameView,
  onUploadGedcom,
  onBack,
  onLogout,
  userEmail
}: ViewListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // Delay single-click navigation briefly so a double-click can cancel it and
  // start inline editing instead of opening the view.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardClick = (viewId: string) => {
    if (editingId) return; // ignore navigation while renaming
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => onSelectView(viewId), 200);
  };

  const startEdit = (viewId: string, name: string) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    setEditingId(viewId);
    setDraft(name);
  };

  const commitEdit = () => {
    if (editingId && draft.trim()) onRenameView(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Trees
            </button>
            <h1>{tree.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{userEmail}</span>
            <button
              onClick={onLogout}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="mb-1">GEDCOM File</h3>
              <p className="text-sm text-muted-foreground">
                {tree.people.length.toLocaleString()} people loaded
              </p>
            </div>
            <button
              onClick={onUploadGedcom}
              className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:opacity-90"
            >
              <Upload className="w-4 h-4" />
              Upload GEDCOM
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="mb-1">Saved Views</h2>
            <p className="text-sm text-muted-foreground">
              {tree.savedViews.length} {tree.savedViews.length === 1 ? 'view' : 'views'}
            </p>
          </div>
          <button
            onClick={onCreateView}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            New View
          </button>
        </div>

        {tree.savedViews.length === 0 ? (
          <div className="text-center py-16 border border-border border-dashed rounded-lg">
            <Eye className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="mb-2">No saved views yet</h3>
            <p className="text-muted-foreground mb-6">
              Create a view to visualize your family tree with custom settings
            </p>
            <button
              onClick={onCreateView}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:opacity-90"
            >
              Create View
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tree.savedViews.map((view) => {
              const rootPerson = tree.people.find(p => p.id === view.rootPersonId);
              return (
                <div
                  key={view.id}
                  className="border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors cursor-pointer group"
                  onClick={() => handleCardClick(view.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    {editingId === view.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={commitEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                          else if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                        }}
                        className="flex-1 mr-2 bg-input-background border border-border rounded px-2 py-1 text-base font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <h3
                        className="flex-1"
                        title="Double-click to rename"
                        onDoubleClick={(e) => { e.stopPropagation(); startEdit(view.id, view.name); }}
                      >
                        {view.name}
                      </h3>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingId !== view.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(view.id, view.name); }}
                          className="text-muted-foreground hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteView(view.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {rootPerson && (
                    <div className="text-sm mb-3">
                      <p className="font-medium">
                        {rootPerson.firstName} {rootPerson.lastName}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {rootPerson.birthDate && (
                          <p>* {formatDate(rootPerson.birthDate, view.layout.dateFormat)}</p>
                        )}
                        {rootPerson.deathDate && (
                          <p>† {formatDate(rootPerson.deathDate, view.layout.dateFormat)}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{view.graphType}</span>
                    <span>•</span>
                    <span>{view.layout.maxGenerations === null ? 'All' : view.layout.maxGenerations} generations</span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated {formatDate(view.updatedAt, view.layout.dateFormat)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
