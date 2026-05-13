import { useState, useMemo } from 'react';
import { Person } from '../types';
import { Search } from 'lucide-react';

interface PersonSearchProps {
  people: Person[];
  selectedPersonId: string;
  onSelectPerson: (personId: string) => void;
}

export function PersonSearch({ people, selectedPersonId, onSelectPerson }: PersonSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return [];
    
    const term = searchTerm.toLowerCase();
    return people
      .filter(person => 
        person.firstName.toLowerCase().includes(term) ||
        person.lastName.toLowerCase().includes(term) ||
        `${person.firstName} ${person.lastName}`.toLowerCase().includes(term)
      )
      .slice(0, 50); // Limit to 50 results for performance
  }, [people, searchTerm]);

  const selectedPerson = people.find(p => p.id === selectedPersonId);

  const handleSelect = (person: Person) => {
    onSelectPerson(person.id);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block mb-2">Root Person</label>
      
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search by name..."
              className="w-full pl-10 pr-3 py-2 bg-input-background border border-border rounded-md"
            />
          </div>
          
          {selectedPerson && (
            <div className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-2">
              <span className="text-sm">
                {selectedPerson.firstName} {selectedPerson.lastName}
              </span>
              {selectedPerson.birthDate && (
                <span className="text-xs text-muted-foreground">
                  * {selectedPerson.birthDate}
                </span>
              )}
            </div>
          )}
        </div>

        {isOpen && filteredPeople.length > 0 && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg max-h-80 overflow-y-auto z-20">
              {filteredPeople.map(person => (
                <button
                  key={person.id}
                  onClick={() => handleSelect(person)}
                  className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="font-medium">
                      {person.firstName} {person.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {person.birthDate && `* ${person.birthDate}`}
                      {person.birthDate && person.deathDate && ' • '}
                      {person.deathDate && `† ${person.deathDate}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {searchTerm && filteredPeople.length === 0 && (
        <div className="mt-2 text-sm text-muted-foreground">
          No people found matching "{searchTerm}"
        </div>
      )}
    </div>
  );
}
