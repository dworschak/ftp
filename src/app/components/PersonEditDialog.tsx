import { useState, useEffect } from 'react';
import { Person } from '../types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface PersonEditDialogProps {
  person: Person | null;
  open: boolean;
  onClose: () => void;
  onSave: (person: Person) => void;
}

export function PersonEditDialog({ person, open, onClose, onSave }: PersonEditDialogProps) {
  const [formData, setFormData] = useState<Person>(
    person || {
      id: '',
      firstName: '',
      lastName: '',
      gender: 'other',
    }
  );

  // Update form data when person prop changes
  useEffect(() => {
    if (person && open) {
      setFormData(person);
    }
  }, [person, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof Person, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (!person) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Person</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => handleChange('gender', value as 'male' | 'female' | 'other')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="birthDate">Birth Date</Label>
               <Input
                 id="birthDate"
                 value={formData.birthDate || ''}
                 onChange={(e) => handleChange('birthDate', e.target.value)}
                 placeholder="e.g., 1875-01-10"
               />
             </div>

             <div className="space-y-2">
               <Label htmlFor="birthPlace">Birth Place</Label>
               <Input
                 id="birthPlace"
                 value={formData.birthPlace || ''}
                 onChange={(e) => handleChange('birthPlace', e.target.value)}
                 placeholder="e.g., New York, USA"
               />
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label htmlFor="deathDate">Death Date</Label>
               <Input
                 id="deathDate"
                 value={formData.deathDate || ''}
                 onChange={(e) => handleChange('deathDate', e.target.value)}
                 placeholder="e.g., 1950-02-06"
               />
             </div>

             <div className="space-y-2">
               <Label htmlFor="deathPlace">Death Place</Label>
               <Input
                 id="deathPlace"
                 value={formData.deathPlace || ''}
                 onChange={(e) => handleChange('deathPlace', e.target.value)}
                 placeholder="e.g., Boston, USA"
               />
             </div>
           </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-3">Marriage Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marriageDate">Marriage Date</Label>
                <Input
                  id="marriageDate"
                  value={formData.marriageDate || ''}
                  onChange={(e) => handleChange('marriageDate', e.target.value)}
                  placeholder="e.g., 1975-06-22"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marriagePlace">Marriage Place</Label>
                <Input
                  id="marriagePlace"
                  value={formData.marriagePlace || ''}
                  onChange={(e) => handleChange('marriagePlace', e.target.value)}
                  placeholder="e.g., New York"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Marriage info is shown on the connecting line between this person and their spouse.
            </p>
          </div>

          <DialogFooter>
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
