import { useRef, useState } from 'react';
import { FamilyTree } from '../types';
import { Plus, Network, Trash2, Pencil } from 'lucide-react';

interface TreeListProps {
  trees: FamilyTree[];
  onSelectTree: (treeId: string) => void;
  onCreateTree: () => void;
  onDeleteTree: (treeId: string) => void;
  onRenameTree: (treeId: string, newName: string) => void;
  onLogout: () => void;
  userEmail: string;
}

export function TreeList({
  trees,
  onSelectTree,
  onCreateTree,
  onDeleteTree,
  onRenameTree,
  onLogout,
  userEmail
}: TreeListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // Delay single-click navigation briefly so a double-click can cancel it and
  // start inline editing instead of opening the tree.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardClick = (treeId: string) => {
    if (editingId) return; // ignore navigation while renaming
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => onSelectTree(treeId), 200);
  };

  const startEdit = (tree: FamilyTree) => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    setEditingId(tree.id);
    setDraft(tree.name);
  };

  const commitEdit = () => {
    if (editingId && draft.trim()) onRenameTree(editingId, draft.trim());
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1>Family Trees</h1>
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
        <div className="flex items-center justify-between mb-6">
          <p className="text-muted-foreground">
            {trees.length} {trees.length === 1 ? 'tree' : 'trees'}
          </p>
          <button
            onClick={onCreateTree}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            New Tree
          </button>
        </div>

        {trees.length === 0 ? (
          <div className="text-center py-16">
            <Network className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="mb-2">No family trees yet</h3>
            <p className="text-muted-foreground mb-6">Create your first tree to get started</p>
            <button
              onClick={onCreateTree}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:opacity-90"
            >
              Create Tree
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trees.map((tree) => (
              <div
                key={tree.id}
                className="border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors cursor-pointer group"
                onClick={() => handleCardClick(tree.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  {editingId === tree.id ? (
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
                      onDoubleClick={(e) => { e.stopPropagation(); startEdit(tree); }}
                    >
                      {tree.name}
                    </h3>
                  )}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId !== tree.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(tree); }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTree(tree.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {tree.people.length} {tree.people.length === 1 ? 'person' : 'people'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(tree.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}