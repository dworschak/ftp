import { useState } from 'react';
import { Person } from '../types';
import { Trash2 } from 'lucide-react';

interface PersonFormProps {
  person?: Person;
  people: Person[];
  onSave: (person: Person | Omit<Person, 'id'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function PersonForm({ person, people, onSave, onCancel, onDelete }: PersonFormProps) {
  const [formData, setFormData] = useState<Omit<Person, 'id'>>({
    firstName: person?.firstName || '',
    lastName: person?.lastName || '',
    birthDate: person?.birthDate || '',
    birthPlace: person?.birthPlace || '',
    deathDate: person?.deathDate || '',
    deathPlace: person?.deathPlace || '',
    gender: person?.gender || undefined,
    fatherId: person?.fatherId || undefined,
    motherId: person?.motherId || undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (person) {
      onSave({ ...person, ...formData });
    } else {
      onSave(formData);
    }
  };

  const availableParents = people.filter(p => p.id !== person?.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h4>{person ? 'Edit Person' : 'Add Person'}</h4>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-destructive hover:opacity-80"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className="block text-sm mb-1">First Name *</label>
          <input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
            required
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm mb-1">Last Name</label>
          <input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
          />
        </div>
      </div>

      <div>
        <label htmlFor="gender" className="block text-sm mb-1">Gender</label>
        <select
          id="gender"
          value={formData.gender || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, gender: e.target.value as Person['gender'] || undefined })}
          className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
        >
          <option value="">Not specified</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="birthDate" className="block text-sm mb-1">Birth Date</label>
          <input
            id="birthDate"
            type="text"
            value={formData.birthDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, birthDate: e.target.value })}
            className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
            placeholder="1950"
          />
        </div>
        <div>
          <label htmlFor="birthPlace" className="block text-sm mb-1">Birth Place</label>
          <input
            id="birthPlace"
            type="text"
            value={formData.birthPlace}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, birthPlace: e.target.value })}
            className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
            placeholder="City, Country"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="deathDate" className="block text-sm mb-1">Death Date</label>
          <input
            id="deathDate"
            type="text"
            value={formData.deathDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, deathDate: e.target.value })}
            className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
            placeholder="2020"
          />
        </div>
        <div>
          <label htmlFor="deathPlace" className="block text-sm mb-1">Death Place</label>
          <input
            id="deathPlace"
            type="text"
            value={formData.deathPlace}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, deathPlace: e.target.value })}
            className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
            placeholder="City, Country"
          />
        </div>
      </div>

      <div>
        <label htmlFor="father" className="block text-sm mb-1">Father</label>
        <select
          id="father"
          value={formData.fatherId || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, fatherId: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
        >
          <option value="">None</option>
          {availableParents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mother" className="block text-sm mb-1">Mother</label>
        <select
          id="mother"
          value={formData.motherId || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, motherId: e.target.value || undefined })}
          className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
        >
          <option value="">None</option>
          {availableParents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 bg-primary text-primary-foreground py-1.5 rounded text-sm hover:opacity-90"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-secondary text-secondary-foreground py-1.5 rounded text-sm hover:opacity-90"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
