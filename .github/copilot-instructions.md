# GitHub Copilot Instructions – Family Tree Printer

## Project Overview

A React/TypeScript single-page application for building, editing, and printing family trees.  
Key features: GEDCOM import, SVG-based tree canvas, multiple saved views per tree, Supabase persistence with localStorage fallback.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Icons | lucide-react |
| Backend | Supabase (optional; falls back to localStorage) |
| Package Manager | pnpm |

---

## Project Structure

```
src/app/
  App.tsx                  # Root component, routing between views
  types.ts                 # All shared types & defaultLayoutSettings
  sampleData.ts            # Demo tree loaded on first launch
  components/
    TreeCanvas.tsx         # SVG family tree renderer (pure, layout + paint)
    ViewEditor.tsx         # Main editing screen (canvas + settings sidebar)
    ViewList.tsx           # List of saved views for a tree
    TreeList.tsx           # List of all trees for the user
    LayoutSettings.tsx     # Layout/display options panel
    PersonEditDialog.tsx   # Edit person data in a modal dialog
    GedcomUploadDialog.tsx # GEDCOM file import dialog
    PersonSearch.tsx       # Autocomplete person picker
    TreeMiniMap.tsx        # Overview minimap for the canvas
    PersonForm.tsx         # Simple inline person add/edit form
  lib/
    db.ts                  # Supabase CRUD helpers
    supabase.ts            # Supabase client + availability check
    gedcomParser.ts        # GEDCOM 5.5 file parser → Person[]
  utils/
    dateFormat.ts          # Date formatting for different DateFormat types
```

---

## Core Data Model

```typescript
// All shared types live in src/app/types.ts

interface Person {
  id: string;
  firstName: string; lastName: string;
  birthDate?: string; birthPlace?: string;
  deathDate?: string; deathPlace?: string;
  gender?: 'male' | 'female' | 'other';
  fatherId?: string; motherId?: string;
  marriageDate?: string; marriagePlace?: string;
}

// Relationships are encoded on the Person itself (fatherId / motherId)
// There is NO separate Relationship or Edge type.

type GraphType = 'ancestor' | 'descendant' | 'hourglass';

interface SavedView {
  id: string; name: string;
  rootPersonId: string;
  graphType: GraphType;
  layout: LayoutSettings;
  createdAt: string; updatedAt: string;
}

interface FamilyTree {
  id: string; name: string;
  people: Person[];
  savedViews: SavedView[];
  createdAt: string; updatedAt: string;
}
```

---

## Coding Conventions

- **Language**: All UI strings must be in **English**. No German text in JSX or user-facing strings.
- **TypeScript**: Strict mode. Avoid `any`; use proper types from `types.ts`. Never widen types unnecessarily.
- **Imports**: Prefer named exports. Import types with `import type { … }`.
- **Components**: Functional components only. No class components.
- **State**: Local `useState`/`useReducer` preferred. No global state library; lift state up when sharing is needed.
- **Side effects**: Pure render logic in `TreeCanvas.tsx` – avoid side effects inside the render/layout calculation. Use `useCallback` + debounce for callbacks that fire on every render.
- **File size**: Keep files focused. Extract reusable helpers and sub-components into separate files when they exceed ~200 lines.
- **No barrel files**: Import directly from the source file, not via an `index.ts` re-export.

---

## Styling Rules

- Use **Tailwind CSS utility classes** exclusively. No inline `style={{}}` except for dynamically computed values (e.g. SVG dimensions, colours derived from data).
- Use CSS custom properties / design tokens via `hsl(var(--...))` for colours (e.g. `bg-background`, `text-foreground`, `border-border`). Never hard-code hex colours in Tailwind classes.
- **shadcn/ui components** live in `src/app/components/ui/`. Use them for all standard UI elements (Button, Input, Dialog, Select, Tabs, etc.). Do not re-implement what shadcn already provides.
- Responsive layout: use flexbox / grid by default. Avoid absolute positioning unless unavoidable (e.g. dropdown overlays).
- Print styles: add `print:hidden` to controls that should not appear when printing the tree. The canvas area must be `print:overflow-visible print:bg-white`.

---

## TreeCanvas Guidelines

`TreeCanvas.tsx` is the most complex file. Rules for working with it:

- The canvas renders entirely as **SVG**. Do not introduce HTML elements inside the SVG subtree.
- Layout is computed in a **pure, synchronous** function before any React state update. Do not trigger state changes during layout.
- `PixelNode` (exported) represents a placed person box with `{ x, y, width, height, color }`. The minimap uses this.
- Expose changes to parent via the `onStatsChange` and `onNodesLayout` callbacks (debounced via `setTimeout`).
- Colours for subtrees come from the `subtreeColors` palette array. Map them by grandparent/great-grandparent index.
- `swappedCouples` in `LayoutSettings` stores couple keys (`"id1_id2"`, IDs sorted alphabetically) where the mother appears on the left.
- The `birthYearSpread` feature offsets nodes vertically within a generation row based on birth year.
- Always guard against missing people: a `fatherId` / `motherId` may reference a person not present in the `people` array (e.g. after a partial GEDCOM import).

---

## GEDCOM Parser

- Entry point: `parseGedcom(text: string): GedcomResult`  
- Output: `{ people: Person[], stats: {...}, errors: string[] }`
- Handles both English and German month names (e.g. `MÄR`, `JANUAR`) – see the `MONTH` map.
- Dates are normalised to `YYYY-MM-DD` or `YYYY-MM` or `YYYY` where possible.
- All parser errors are non-fatal and collected in `errors[]`; the import still proceeds.
- Do not break this non-fatal error contract when extending the parser.

---

## Supabase Integration

- `supabaseAvailable` (exported from `lib/supabase.ts`) is `true` only when valid env variables are present. Always check it before calling Supabase.
- All DB helpers in `lib/db.ts` return `Promise<…>` and throw on error. Callers must `.catch(console.error)` for non-critical paths or surface errors to the user for critical ones (e.g. GEDCOM import).
- localStorage is the primary persistence fallback; prefix keys with `familyTree_`.

---

## Common Patterns

### Adding a new layout option
1. Add the field + type to `LayoutSettings` in `types.ts` and initialise it in `defaultLayoutSettings`.
2. Add migration in `App.tsx` (`useEffect` that reads from localStorage) to handle old saved data missing the field.
3. Add a control in `LayoutSettings.tsx`.
4. Use the field in `TreeCanvas.tsx`.

### Adding a new dialog
- Use the `Dialog` / `DialogContent` / `DialogHeader` / `DialogFooter` components from `components/ui/dialog.tsx`.
- Manage `open` state in the parent; pass it as a prop.
- Always provide a cancel / close affordance.

### Person relationship rules
- A `Person` knows its own parents (`fatherId`, `motherId`). Children are derived by filtering `people` for entries whose `fatherId`/`motherId` match.
- Spouse relationships are implicit: two people are spouses if they share at least one child.
- Never add a dedicated `spouseId` or `childrenIds` field to `Person` – derive these at render time.

---

## What to Avoid

- ❌ Do not add a global state manager (Redux, Zustand, Jotai, …). Lift state up instead.
- ❌ Do not add a routing library. Navigation is handled by an `AppView` enum in `App.tsx`.
- ❌ Do not introduce CSS Modules or styled-components. Tailwind only.
- ❌ Do not use `document.getElementById` or direct DOM manipulation in React components.
- ❌ Do not break the existing German-month GEDCOM parsing when editing `gedcomParser.ts`.
- ❌ Do not hard-code user-visible strings in German.
- ❌ Do not use `@mui/material` components for new UI – use shadcn/ui instead (MUI is a legacy dep).

