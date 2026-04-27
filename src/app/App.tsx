import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { TreeList } from './components/TreeList';
import { ViewList } from './components/ViewList';
import { ViewEditor } from './components/ViewEditor';
import { GedcomUploadDialog } from './components/GedcomUploadDialog';
import { FamilyTree, SavedView, defaultLayoutSettings, Person } from './types';
import { sampleTree } from './sampleData';
import * as db from './lib/db';
import { supabaseAvailable } from './lib/supabase';

type AppView = 'login' | 'treeList' | 'viewList' | 'viewEditor';

export default function App() {
  const [view, setView]                     = useState<AppView>('login');
  const [userEmail, setUserEmail]           = useState<string>('');
  const [trees, setTrees]                   = useState<FamilyTree[]>([sampleTree]);
  const [currentTreeId, setCurrentTreeId]   = useState<string | null>(null);
  const [currentViewId, setCurrentViewId]   = useState<string | null>(null);
  const [gedcomOpen, setGedcomOpen]         = useState(false);

  // ── Initial load from localStorage ──────────────────────────────────────
  useEffect(() => {
    const savedEmail = localStorage.getItem('familyTree_userEmail');
    const savedTrees = localStorage.getItem('familyTree_trees');

    if (savedEmail) {
      setUserEmail(savedEmail);
      setView('treeList');
    }

    if (savedTrees) {
      try {
        const parsedTrees = JSON.parse(savedTrees) as FamilyTree[];
        if (parsedTrees.length > 0) {
          const migratedTrees = parsedTrees.map((tree) => ({
            ...tree,
            savedViews: tree.savedViews.map((v) => ({
              ...v,
              layout: {
                ...defaultLayoutSettings,
                ...v.layout,
                maxGenerations: v.layout.maxGenerations ?? defaultLayoutSettings.maxGenerations,
                showMarriageInfo: v.layout.showMarriageInfo ?? defaultLayoutSettings.showMarriageInfo,
                dateFormat: v.layout.dateFormat ?? defaultLayoutSettings.dateFormat,
                lineStyle: v.layout.lineStyle ?? defaultLayoutSettings.lineStyle,
                lineWidth: v.layout.lineWidth ?? defaultLayoutSettings.lineWidth,
              },
            })),
          }));
          setTrees(migratedTrees);
        }
      } catch (e) {
        console.error('Failed to parse saved trees:', e);
      }
    }
  }, []);

  // ── Sync from Supabase after login ───────────────────────────────────────
  useEffect(() => {
    if (!userEmail || !supabaseAvailable) return;
    db.loadTrees(userEmail)
      .then((remoteTrees) => {
        if (remoteTrees.length > 0) {
          setTrees(remoteTrees);
        }
      })
      .catch((e) => console.error('[Supabase] load failed:', e));
  }, [userEmail]);

  // ── Persist to localStorage ──────────────────────────────────────────────
  useEffect(() => {
    if (userEmail) localStorage.setItem('familyTree_userEmail', userEmail);
  }, [userEmail]);

  useEffect(() => {
    localStorage.setItem('familyTree_trees', JSON.stringify(trees));
  }, [trees]);

  // ── Auth ─────────────────────────────────────────────────────────────────
  const handleLogin = (email: string) => {
    setUserEmail(email);
    setView('treeList');
  };

  const handleLogout = () => {
    setUserEmail('');
    setView('login');
    localStorage.removeItem('familyTree_userEmail');
  };

  // ── Tree CRUD ─────────────────────────────────────────────────────────────
  const handleCreateTree = () => {
    const newTree: FamilyTree = {
      id: Date.now().toString(),
      name: `Family Tree ${trees.length + 1}`,
      people: [],
      savedViews: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTrees([...trees, newTree]);
    setCurrentTreeId(newTree.id);
    setView('viewList');
    db.upsertTree(newTree, userEmail).catch(console.error);
  };

  const handleSelectTree = (treeId: string) => {
    setCurrentTreeId(treeId);
    setView('viewList');
  };

  const handleDeleteTree = (treeId: string) => {
    if (!confirm('Delete this tree? This cannot be undone.')) return;
    setTrees(trees.filter((t) => t.id !== treeId));
    db.deleteTree(treeId).catch(console.error);
  };

  // ── View CRUD ─────────────────────────────────────────────────────────────
  const handleCreateView = () => {
    setCurrentViewId(null);
    setView('viewEditor');
  };

  const handleSelectView = (viewId: string) => {
    setCurrentViewId(viewId);
    setView('viewEditor');
  };

  const handleDeleteView = (viewId: string) => {
    if (!currentTreeId || !confirm('Delete this view? This cannot be undone.')) return;
    setTrees(trees.map((tree) => {
      if (tree.id !== currentTreeId) return tree;
      return { ...tree, savedViews: tree.savedViews.filter((v) => v.id !== viewId), updatedAt: new Date().toISOString() };
    }));
    db.deleteView(viewId).catch(console.error);
  };

  const handleSaveView = (savedView: SavedView) => {
    if (!currentTreeId) return;
    setTrees(trees.map((tree) => {
      if (tree.id !== currentTreeId) return tree;
      const existingIndex = tree.savedViews.findIndex((v) => v.id === savedView.id);
      const updatedViews = existingIndex >= 0
        ? tree.savedViews.map((v, i) => (i === existingIndex ? savedView : v))
        : [...tree.savedViews, savedView];
      return { ...tree, savedViews: updatedViews, updatedAt: new Date().toISOString() };
    }));
    db.upsertView(savedView, currentTreeId).catch(console.error);
    setView('viewList');
  };

  // ── Person edits ──────────────────────────────────────────────────────────
  const handlePersonEdit = (person: Person) => {
    if (!currentTreeId) return;
    setTrees(trees.map((tree) => {
      if (tree.id !== currentTreeId) return tree;
      return {
        ...tree,
        people: tree.people.map((p) => (p.id === person.id ? person : p)),
        updatedAt: new Date().toISOString(),
      };
    }));
    db.upsertPerson(person, currentTreeId).catch(console.error);
  };

  // ── GEDCOM upload ─────────────────────────────────────────────────────────
  const handleUploadGedcom = () => setGedcomOpen(true);

  const handleGedcomImport = async (people: Person[]) => {
    if (!currentTreeId) return;
    const updatedAt = new Date().toISOString();

    // Optimistic local update
    setTrees((prev) =>
      prev.map((tree) =>
        tree.id === currentTreeId
          ? { ...tree, people, updatedAt }
          : tree,
      ),
    );

    // Persist to Supabase (throws on error → dialog shows it)
    await db.replaceTreePeople(currentTreeId, people);

    // Keep tree meta up-to-date
    const currentTree = trees.find((t) => t.id === currentTreeId);
    if (currentTree) {
      await db.upsertTree({ ...currentTree, people, updatedAt }, userEmail);
    }
  };

  // ── Navigation helpers ────────────────────────────────────────────────────
  const handleBackToViewList = () => { setCurrentViewId(null); setView('viewList'); };
  const handleBackToTreeList = () => { setCurrentTreeId(null); setCurrentViewId(null); setView('treeList'); };

  const currentTree = trees.find((t) => t.id === currentTreeId);
  const currentView = currentTree?.savedViews.find((v) => v.id === currentViewId);

  return (
    <div className="w-full h-screen bg-background text-foreground">
      {view === 'login' && <LoginScreen onLogin={handleLogin} />}

      {view === 'treeList' && (
        <TreeList
          trees={trees}
          onSelectTree={handleSelectTree}
          onCreateTree={handleCreateTree}
          onDeleteTree={handleDeleteTree}
          onLogout={handleLogout}
          userEmail={userEmail}
        />
      )}

      {view === 'viewList' && currentTree && (
        <ViewList
          tree={currentTree}
          onSelectView={handleSelectView}
          onCreateView={handleCreateView}
          onDeleteView={handleDeleteView}
          onUploadGedcom={handleUploadGedcom}
          onBack={handleBackToTreeList}
          onLogout={handleLogout}
          userEmail={userEmail}
        />
      )}

      {view === 'viewEditor' && currentTree && (
        <ViewEditor
          tree={currentTree}
          view={currentView || null}
          onSave={handleSaveView}
          onBack={handleBackToViewList}
          onPersonEdit={handlePersonEdit}
        />
      )}

      {/* GEDCOM upload dialog – rendered globally so it survives view transitions */}
      {currentTree && (
        <GedcomUploadDialog
          open={gedcomOpen}
          treeName={currentTree.name}
          onClose={() => setGedcomOpen(false)}
          onImport={handleGedcomImport}
        />
      )}
    </div>
  );
}

