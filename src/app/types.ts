/** Marriage data for a specific spouse relationship. */
export interface Marriage {
  spouseId: string;
  date?: string;
  place?: string;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  gender?: 'male' | 'female' | 'other';
  fatherId?: string;
  motherId?: string;
  /** Occupation / profession. */
  occupation?: string;
  /** Optional start of the occupation period (free text, e.g. a year). */
  occupationFrom?: string;
  /** Optional end of the occupation period (free text, e.g. a year). */
  occupationTo?: string;
  /** Per-spouse marriage data. One entry per known spouse. */
  marriages?: Marriage[];
}

export type GraphType = 'ancestor' | 'descendant' | 'hourglass';
export type BackgroundSkin = 'white' | 'cream' | 'light-blue' | 'light-green';
export type ColorScheme = 'uniform' | 'by-grandparent' | 'by-great-grandparent' | 'by-parish';
export type DateFormat = 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD MMM YYYY';
export type LineStyle = 'straight' | 'rounded';
export type LineColorMode = 'border' | 'subtree';

export interface LayoutSettings {
  textSize: number;
  showBirthDate: boolean;
  showBirthPlace: boolean;
  showDeathDate: boolean;
  showDeathPlace: boolean;
  showMarriageInfo: boolean;
  showOccupation: boolean;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  borderWidth: number;
  lineWidth: number;
  borderColor: string;
  backgroundSkin: BackgroundSkin;
  colorScheme: ColorScheme;
  personBoxPadding: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  maxGenerations: number | null; // null means show all generations
  dateFormat: DateFormat;
  lineStyle: LineStyle;
  colorLines: boolean;    // Color connecting lines with the child node's subtree color
  swappedCouples: string[]; // Array of coupleKeys ("id1_id2" sorted) where mother is left, father right
  birthYearSpread: number;  // Max vertical offset in px between earliest/latest born within one generation row (0 = off)
  minBoxWidth: number;       // Minimum person-box width in px (at scale 1.0); 0 = pure content width
  showSiblingsGen0: boolean; // Show siblings of the root person (Generation 0)
  showSiblingsGen1: boolean; // Show siblings of root's parents (Generation 1)
  showLegend: boolean;       // Show/hide the color scheme legend overlay
  showGenderSymbol: boolean; // Show ♂/♀ symbol in the top-right corner of person boxes
}

export interface SavedView {
  id: string;
  name: string;
  rootPersonId: string;
  graphType: GraphType;
  layout: LayoutSettings;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyTree {
  id: string;
  name: string;
  people: Person[];
  savedViews: SavedView[];
  createdAt: string;
  updatedAt: string;
}

export const defaultLayoutSettings: LayoutSettings = {
  textSize: 12,
  showBirthDate: true,
  showBirthPlace: true,
  showDeathDate: true,
  showDeathPlace: true,
  showMarriageInfo: true,
  showOccupation: false,
  marginTop: 20,
  marginRight: 20,
  marginBottom: 20,
  marginLeft: 20,
  borderWidth: 0,
  lineWidth: 1,
  borderColor: '#000000',
  backgroundSkin: 'white',
  colorScheme: 'by-great-grandparent',
  personBoxPadding: 6,
  horizontalSpacing: 10,
  verticalSpacing: 60,
  maxGenerations: 5, // Show all generations by default
  dateFormat: 'DD.MM.YYYY',
  lineStyle: 'straight',
  colorLines: false,
  swappedCouples: [],
  birthYearSpread: 0,
  minBoxWidth: 50,
  showSiblingsGen0: false,
  showSiblingsGen1: false,
  showLegend: true,
  showGenderSymbol: false,
};