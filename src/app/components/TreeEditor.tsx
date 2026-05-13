import { useState } from 'react';
import { FamilyTree, Person, defaultLayoutSettings } from '../types';
import { TreeCanvas } from './TreeCanvas';
import { PersonForm } from './PersonForm';
import { LayoutSettings } from './LayoutSettings';
import { ArrowLeft, Plus, Settings, Users, Upload } from 'lucide-react';

interface TreeEditorProps {
  tree: FamilyTree;
  onUpdateTree: (tree: FamilyTree) => void;
  onBack: () => void;
}

type SidebarView = 'people' | 'layout' | 'import';

export function TreeEditor({ tree, onUpdateTree, onBack }: TreeEditorProps) {
  const [sidebarView, setSidebarView] = useState<SidebarView>('people');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [treeName, setTreeName] = useState(tree.name);
  const [rootPersonId, setRootPersonId] = useState(tree.people[0]?.id || '');
  const [layout, setLayout] = useState(defaultLayoutSettings);

  const handleAddPerson = (person: Omit<Person, 'id'>) => {
    const newPerson: Person = {
      ...person,
      id: Date.now().toString(),
    };

    const updatedTree = {
      ...tree,
      people: [...tree.people, newPerson],
      updatedAt: new Date().toISOString(),
    };

    onUpdateTree(updatedTree);
    setIsAddingPerson(false);
    // Set first person as root if no root exists
    if (!rootPersonId) setRootPersonId(newPerson.id);
  };

  const handleUpdatePerson = (person: Person) => {
    const updatedTree = {
      ...tree,
      people: tree.people.map(p => p.id === person.id ? person : p),
      updatedAt: new Date().toISOString(),
    };

    onUpdateTree(updatedTree);
    setEditingPerson(null);
  };

  const handleDeletePerson = (personId: string) => {
    if (!confirm('Delete this person? Their relationships will be preserved.')) return;

    const updatedTree = {
      ...tree,
      people: tree.people.filter(p => p.id !== personId),
      updatedAt: new Date().toISOString(),
    };

    onUpdateTree(updatedTree);
    setEditingPerson(null);
    // Reset root if deleted person was root
    if (rootPersonId === personId) {
      setRootPersonId(updatedTree.people[0]?.id || '');
    }
  };

  const handleUpdateLayout = (newLayout: typeof defaultLayoutSettings) => {
    setLayout(newLayout);
  };

  const handleSetRootPerson = (personId: string) => {
    setRootPersonId(personId);
  };

  const handleSaveTreeName = () => {
    if (treeName.trim() && treeName !== tree.name) {
      onUpdateTree({
        ...tree,
        name: treeName.trim(),
        updatedAt: new Date().toISOString(),
      });
    }
    setIsEditingName(false);
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {isEditingName ? (
              <input
                type="text"
                value={treeName}
                onChange={(e) => setTreeName(e.target.value)}
                onBlur={handleSaveTreeName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTreeName();
                  if (e.key === 'Escape') {
                    setTreeName(tree.name);
                    setIsEditingName(false);
                  }
                }}
                className="px-2 py-1 border border-border rounded text-lg font-medium"
                autoFocus
              />
            ) : (
              <h2
                onClick={() => setIsEditingName(true)}
                className="cursor-pointer hover:text-muted-foreground transition-colors"
              >
                {tree.name}
              </h2>
            )}
          </div>
          <button
            onClick={() => window.print()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90"
          >
            Print Tree
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-border flex flex-col flex-shrink-0">
          {/* Sidebar Tabs */}
          <div className="border-b border-border flex">
            <button
              onClick={() => setSidebarView('people')}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
                sidebarView === 'people'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              People
            </button>
            <button
              onClick={() => setSidebarView('layout')}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
                sidebarView === 'layout'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="w-4 h-4" />
              Layout
            </button>
            <button
              onClick={() => setSidebarView('import')}
              className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 ${
                sidebarView === 'import'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarView === 'people' && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3>People ({tree.people.length})</h3>
                  <button
                    onClick={() => setIsAddingPerson(true)}
                    className="bg-primary text-primary-foreground p-2 rounded-md hover:opacity-90"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {isAddingPerson && (
                  <div className="mb-4 p-4 bg-secondary rounded-lg">
                    <PersonForm
                      people={tree.people}
                      onSave={handleAddPerson}
                      onCancel={() => setIsAddingPerson(false)}
                    />
                  </div>
                )}

                {editingPerson && (
                  <div className="mb-4 p-4 bg-secondary rounded-lg">
                    <PersonForm
                      person={editingPerson}
                      people={tree.people}
                      onSave={(updated) => {
                        if ('id' in updated) {
                          handleUpdatePerson(updated as Person);
                        }
                      }}
                      onCancel={() => setEditingPerson(null)}
                      onDelete={() => handleDeletePerson(editingPerson.id)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  {tree.people.map((person) => (
                    <div
                      key={person.id}
                      onClick={() => setEditingPerson(person)}
                      className={`p-3 rounded-lg border cursor-pointer hover:border-foreground/20 ${
                        person.id === rootPersonId
                          ? 'border-primary bg-primary/5'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">
                            {person.firstName} {person.lastName}
                          </p>
                          {person.birthDate && (
                            <p className="text-xs text-muted-foreground">
                              * {person.birthDate}
                            </p>
                          )}
                        </div>
                        {person.id === rootPersonId && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                            Root
                          </span>
                        )}
                      </div>
                      {person.id !== rootPersonId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetRootPerson(person.id);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground mt-2"
                        >
                          Set as root person
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sidebarView === 'layout' && (
              <div className="p-4">
                <h3 className="mb-4">Print Layout</h3>
                <LayoutSettings
                  layout={layout}
                  onUpdate={handleUpdateLayout}
                />
              </div>
            )}

            {sidebarView === 'import' && (
              <div className="p-4">
                <h3 className="mb-4">Import GEDCOM</h3>
                <div className="p-6 border-2 border-dashed border-border rounded-lg text-center">
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    GEDCOM file upload requires Supabase connection
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Connect Supabase in Make settings to enable file uploads
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 print:overflow-visible print:bg-white">
          {rootPersonId ? (
            <TreeCanvas
              people={tree.people}
              rootPersonId={rootPersonId}
              graphType="ancestor"
              layout={layout}
              onPersonClick={(person) => setEditingPerson(person)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="mb-2">Add a person to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
