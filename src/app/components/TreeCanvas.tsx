import { Person, LayoutSettings, GraphType, BackgroundSkin } from '../types';
import { ReactElement, forwardRef } from 'react';
import { formatDate } from '../utils/dateFormat';

/** Build the occupation display string (with optional period), or null. */
function buildOccupationText(person: Person): string | null {
  const occ = person.occupation?.trim();
  if (!occ) return null;
  const from = person.occupationFrom?.trim();
  const to = person.occupationTo?.trim();
  let range = '';
  if (from && to) range = ` (${from}–${to})`;
  else if (from) range = ` (${from}–)`;
  else if (to) range = ` (–${to})`;
  return `⚒ ${occ}${range}`;
}

/** A person box in pixel coordinates – used by the minimap. */
export interface PixelNode {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

/** One entry in the color-scheme legend. */
export interface LegendEntry {
  label: string;
  color: string;
  /** Ahnentafel / Kekulé number (4–7 for grandparents, 8–15 for great-grandparents). */
  kekuleNumber?: number;
  /** True when this ancestor slot has no known person in the people array. */
  isUnknown?: boolean;
}

interface TreeCanvasProps {
  people: Person[];
  rootPersonId: string;
  graphType: GraphType;
  layout: LayoutSettings;
  onPersonClick?: (person: Person) => void;
  onCoupleSwap?: (coupleKey: string) => void;
  onStatsChange?: (widthPx: number, heightPx: number, totalLineLengthPx: number) => void;
  onNodesLayout?: (nodes: PixelNode[]) => void;
  onLegendData?: (entries: LegendEntry[]) => void;
}

interface TreeNode {
  person: Person;
  x: number;
  y: number;
  generation: number;
  width: number;
  height: number;
  subtreeRoot?: string;
  subtreeWidth: number; // Total width of this node's subtree
  scale: number;
  effectiveTextSize: number;
  effectivePadding: number;
  isSibling?: boolean; // true for sibling nodes added via showSiblingsGen0/Gen1
}

const backgroundColors: Record<BackgroundSkin, string> = {
  'white': '#FFFFFF',
  'cream': '#FFFEF0',
  'light-blue': '#EFF6FF',
  'light-green': '#F0FDF4',
};

const subtreeColors = [
  '#B3E5FC', // Light blue
  '#A5D6A7', // Light green
  '#FFE082', // Light yellow
  '#FFCC80', // Light orange
  '#FFCCBC', // Light salmon
  '#F8BBD0', // Light pink
  '#E1BEE7', // Light purple
  '#B2DFDB', // Light teal
];

export const TreeCanvas = forwardRef<SVGSVGElement, TreeCanvasProps>(function TreeCanvas(
  { people, rootPersonId, graphType: _graphType, layout, onPersonClick, onCoupleSwap, onStatsChange, onNodesLayout, onLegendData }: TreeCanvasProps,
  svgRef,
) {
  // ...existing code...

  if (!rootPersonId || people.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>No people to display</p>
      </div>
    );
  }

  const rootPerson = people.find(p => p.id === rootPersonId);
  if (!rootPerson) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <p>Root person not found</p>
      </div>
    );
  }

    // Scale factor for lower generations (gen 0 = root/bottom)
    const getGenScale = (generation: number): number => {
    if (generation === 0) return 1.25;
    if (generation === 1) return 1.15;
    if (generation === 2) return 1.07;
    return 1.0;
    };

    // Calculate text dimensions
    const calculateTextWidth = (text: string, fontSize: number, fontWeight: string = 'normal'): number => {
    const avgCharWidth = fontSize * (fontWeight === 'bold' || fontWeight === '500' ? 0.6 : 0.5);
    return text.length * avgCharWidth;
    };

    // Calculate box dimensions based on content and generation scale
    const calculateBoxSize = (person: Person, scale: number): { width: number; height: number } => {
    const lines: string[] = [];
    const scaledTextSize = layout.textSize * scale;
    const padding = layout.personBoxPadding * scale;

    lines.push(person.firstName);
    lines.push(person.lastName);
    if (layout.showBirthDate && person.birthDate) {
      lines.push(`* ${formatDate(person.birthDate, layout.dateFormat)}`);
    }
    if (layout.showBirthPlace && person.birthPlace) {
      lines.push(person.birthPlace);
    }
    if (layout.showDeathDate && person.deathDate) {
      lines.push(`† ${formatDate(person.deathDate, layout.dateFormat)}`);
    }
    if (layout.showDeathPlace && person.deathPlace) {
      lines.push(person.deathPlace);
    }

    if (layout.showOccupation) {
      const occ = buildOccupationText(person);
      if (occ) lines.push(occ);
    }

    let maxWidth = 0;
    lines.forEach((line, index) => {
      const fontWeight = index === 1 ? '500' : 'normal';
      const lineWidth = calculateTextWidth(line, scaledTextSize, fontWeight);
      maxWidth = Math.max(maxWidth, lineWidth);
    });

    const width = maxWidth + padding * 2;
    const lineGap = Math.round(4 * scale);
    const height = padding * 2 + scaledTextSize + (lines.length - 1) * (scaledTextSize + lineGap);

    return { width: Math.max(width, layout.minBoxWidth * scale), height: Math.max(height, 40 * scale) };
    };

  const nodeMap = new Map<string, TreeNode>();
  const subtreeRoots = new Map<string, string>();

  // Determine grandparents and great-grandparents for color coding.
  // We use FIXED SLOT arrays (4 slots for grandparents, 8 for great-grandparents)
  // so that the slot index always maps to a consistent Kekulé number and
  // subtree color regardless of how many ancestors are known.
  //   gpFixed[0] = pgf (Kekulé 4)  gpFixed[1] = pgm (Kekulé 5)
  //   gpFixed[2] = mgf (Kekulé 6)  gpFixed[3] = mgm (Kekulé 7)
  //   ggpFixed[0..7] = Kekulé 8–15 in left-to-right DFS order
  const gpFixed:  (string | null)[] = [null, null, null, null];
  const ggpFixed: (string | null)[] = [null, null, null, null, null, null, null, null];
  // O(1) personId → slot-index maps (only populated for KNOWN ancestors)
  const gpSlotIndex  = new Map<string, number>();
  const ggpSlotIndex = new Map<string, number>();

  if (layout.colorScheme !== 'uniform') {
    const father = rootPerson.fatherId ? people.find(p => p.id === rootPerson.fatherId) : null;
    const mother = rootPerson.motherId ? people.find(p => p.id === rootPerson.motherId) : null;

    const pgf = father ? (father.fatherId ? people.find(p => p.id === father.fatherId) : null) : null;
    const pgm = father ? (father.motherId ? people.find(p => p.id === father.motherId) : null) : null;
    const mgf = mother ? (mother.fatherId ? people.find(p => p.id === mother.fatherId) : null) : null;
    const mgm = mother ? (mother.motherId ? people.find(p => p.id === mother.motherId) : null) : null;

    // Populate grandparent slots
    [pgf, pgm, mgf, mgm].forEach((gp, slot) => {
      if (gp) { gpFixed[slot] = gp.id; gpSlotIndex.set(gp.id, slot); }
    });

    if (layout.colorScheme === 'by-great-grandparent') {
      // Great-grandparent slots: [pgf.f, pgf.m, pgm.f, pgm.m, mgf.f, mgf.m, mgm.f, mgm.m]
      const ggpSources: [gp: typeof pgf, fSlot: number, mSlot: number][] = [
        [pgf, 0, 1],
        [pgm, 2, 3],
        [mgf, 4, 5],
        [mgm, 6, 7],
      ];
      ggpSources.forEach(([gp, fSlot, mSlot]) => {
        if (!gp) return;
        const ggf = gp.fatherId ? people.find(p => p.id === gp.fatherId) : null;
        const ggm = gp.motherId ? people.find(p => p.id === gp.motherId) : null;
        if (ggf) { ggpFixed[fSlot] = ggf.id; ggpSlotIndex.set(ggf.id, fSlot); }
        if (ggm) { ggpFixed[mSlot] = ggm.id; ggpSlotIndex.set(ggm.id, mSlot); }
      });
    }
  }

  // Legacy compact arrays kept for backward-compat with assignSubtreeRoot helper
  // (values are the IDs of known ancestors, in slot order, without nulls)
  // These are intentionally kept unused as named references; the slot Maps are used instead.

  // Assign subtree roots
  const assignSubtreeRoot = (personId: string, currentRoot: string | undefined): void => {
    if (layout.colorScheme === 'by-grandparent' && gpSlotIndex.has(personId)) {
      currentRoot = personId;
    } else if (layout.colorScheme === 'by-great-grandparent' && ggpSlotIndex.has(personId)) {
      currentRoot = personId;
    }

    // First path to reach this node wins: the father (left) side is always visited first,
    // so the leftmost visible descendant determines the color.  Early-return also prevents
    // infinite recursion in malformed data with cycles.
    if (subtreeRoots.has(personId)) return;
    subtreeRoots.set(personId, currentRoot || 'root');

    const person = people.find(p => p.id === personId);
    if (!person) return;

    if (person.fatherId) {
      assignSubtreeRoot(person.fatherId, currentRoot);
    }
    if (person.motherId) {
      assignSubtreeRoot(person.motherId, currentRoot);
    }
  };

  assignSubtreeRoot(rootPersonId, undefined);

  // ── Phase 1: BFS to find reachable ancestors (min-distance / maxGenerations) ─
  // bfsGen holds the SHORTEST path from root to each ancestor.
  // This is used solely to determine WHICH ancestors are visible (reachability
  // and maxGenerations cap).  It is NOT used as the visual row.
  const bfsGen = new Map<string, number>();
  {
    const bfsQueue: Array<{ id: string; gen: number }> = [{ id: rootPersonId, gen: 0 }];
    while (bfsQueue.length > 0) {
      const { id, gen } = bfsQueue.shift()!;
      if (bfsGen.has(id)) continue; // already found a shorter-or-equal path
      if (layout.maxGenerations !== null && gen >= layout.maxGenerations) continue;
      bfsGen.set(id, gen);
      const p = people.find(q => q.id === id);
      if (!p) continue;
      if (p.fatherId) bfsQueue.push({ id: p.fatherId, gen: gen + 1 });
      if (p.motherId) bfsQueue.push({ id: p.motherId, gen: gen + 1 });
    }
    bfsGen.set(rootPersonId, 0);
  }

  // ── Phase 2: Build child-in-tree map (parent → list of children in tree) ────
  // Needed for the longest-path computation below.
  const treeChildren = new Map<string, string[]>();
  bfsGen.forEach((_, id) => {
    const p = people.find(q => q.id === id);
    if (!p) return;
    if (p.fatherId && bfsGen.has(p.fatherId)) {
      if (!treeChildren.has(p.fatherId)) treeChildren.set(p.fatherId, []);
      treeChildren.get(p.fatherId)!.push(id);
    }
    if (p.motherId && bfsGen.has(p.motherId)) {
      if (!treeChildren.has(p.motherId)) treeChildren.set(p.motherId, []);
      treeChildren.get(p.motherId)!.push(id);
    }
  });

  // ── Phase 3: Longest-path → visual row for every reachable ancestor ─────────
  // INVARIANT: every parent must appear at a STRICTLY HIGHER generation number
  // than ALL its children that are present in the tree.
  //
  // With Ahnenschwund a person can be both a grandparent (BFS dist 2) and a
  // great-grandparent (BFS dist 3).  BFS (shortest path) would put them at 2,
  // placing them on the SAME ROW as their own child.  The longest path instead
  // gives them row max(children_rows)+1, which satisfies the invariant for every
  // ancestor simultaneously.
  //
  // Example: Mathias is father of both Ignaz (row 2) and Anna Pöschl (row 3).
  //   longest-path row of Mathias = max(2, 3) + 1 = 4  ✓
  const computedGenerations = new Map<string, number>();
  {
    const computing = new Set<string>(); // cycle guard for malformed data
    const computeGen = (id: string): number => {
      if (computedGenerations.has(id)) return computedGenerations.get(id)!;
      if (computing.has(id)) return bfsGen.get(id) ?? 0; // cycle → BFS fallback
      computing.add(id);
      const children = treeChildren.get(id) ?? [];
      const gen =
        children.length === 0
          ? (bfsGen.get(id) ?? 0) // leaf in tree (root or ancestor with no known parents)
          : Math.max(...children.map(computeGen)) + 1;
      computing.delete(id);
      computedGenerations.set(id, gen);
      return gen;
    };
    bfsGen.forEach((_, id) => computeGen(id));
    // Root is always at generation 0
    computedGenerations.set(rootPersonId, 0);
  }

  // ── Phase 3.5: Sibling normalization ──────────────────────────────────────
  // The longest-path algorithm may place siblings at different generations when
  // they descend into different depths (Ahnenschwund).  This pass lifts all
  // children of the same couple to the maximum sibling generation, then ensures
  // every parent remains strictly above all its children.  Spouses of lifted
  // persons are intentionally left at their original generation (longer lines).
  {
    // Build couple → children map (only when BOTH parents are in the tree)
    const coupleChildrenForNorm = new Map<string, string[]>();
    bfsGen.forEach((_, id) => {
      const p = people.find(q => q.id === id);
      if (!p || !p.fatherId || !p.motherId) return;
      if (!computedGenerations.has(p.fatherId) || !computedGenerations.has(p.motherId)) return;
      const ck = [p.fatherId, p.motherId].sort().join('_');
      if (!coupleChildrenForNorm.has(ck)) coupleChildrenForNorm.set(ck, []);
      coupleChildrenForNorm.get(ck)!.push(id);
    });

    let stable = false;
    while (!stable) {
      stable = true;

      // Step 1: lift all children of a couple to the maximum sibling generation
      coupleChildrenForNorm.forEach((childIds) => {
        const valid = childIds.filter(id => computedGenerations.has(id));
        if (valid.length <= 1) return;
        const maxGen = Math.max(...valid.map(id => computedGenerations.get(id)!));
        valid.forEach(id => {
          if ((computedGenerations.get(id) ?? 0) < maxGen) {
            computedGenerations.set(id, maxGen);
            stable = false;
          }
        });
      });

      // Step 2: ensure every parent is strictly above all its (possibly lifted) children
      bfsGen.forEach((_, id) => {
        if (id === rootPersonId) return; // root is always pinned at 0
        const children = treeChildren.get(id) ?? [];
        const inTree = children.filter(cid => computedGenerations.has(cid));
        if (inTree.length === 0) return;
        const maxChildGen = Math.max(...inTree.map(cid => computedGenerations.get(cid)!));
        const needed = maxChildGen + 1;
        if ((computedGenerations.get(id) ?? 0) < needed) {
          computedGenerations.set(id, needed);
          stable = false;
        }
      });
    }
  }

  // ── Subtree Packing Layout ────────────────────────────────────────────────
  // Instead of reserving one global column per ancestor, we compute the minimum
  // pixel span of each subtree bottom-up and then assign pixel positions top-down.
  // Shared ancestors (Ahnenschwund) are placed only once; all connecting lines
  // route to that single coordinate using the existing S-curve / rounded routing.

  // Helper: get couple key (sorted IDs joined by _)
  const coupleKey = (id1: string, id2: string) => [id1, id2].sort().join('_');

  // Pre-compute box dimensions (pixel-rounded) for every visible node.
  const boxDimensions = new Map<string, { width: number; height: number }>();
  computedGenerations.forEach((gen, personId) => {
    const person = people.find(p => p.id === personId);
    if (!person) return;
    const scale = getGenScale(gen);
    const { width, height } = calculateBoxSize(person, scale);
    boxDimensions.set(personId, { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
  });

  // ── Contour-based Layout (Reingold-Tilford style) ────────────────────────
  // Each subtree computes, relative to its own root node at x=0:
  //   • relPos      – center-X of every node in the subtree
  //   • leftEdge    – per-generation leftmost box left-edge
  //   • rightEdge   – per-generation rightmost box right-edge
  //
  // When merging two parent subtrees we slide the right subtree only as far
  // right as needed so that:
  //   rightEdge_of_left[g] + horizontalSpacing ≤ leftEdge_of_right[g]
  // holds for EVERY shared generation g.  This eliminates the phantom
  // whitespace that appears when a wide subtree at gen N forces spacing at
  // gen M where the other branch has no nodes.
  //
  // Ahnenschwund: the first DFS (father-first) encounter of a shared ancestor
  // "claims" that node.  Subsequent encounters return null, so the second branch
  // is laid out without any reserved space for the already-placed ancestor.
  // Connecting lines to claimed ancestors use existing S-curve / rounded routing.

  const spanClaimed = new Set<string>();

  const mergeIntoContour = (
    target: Map<number, number>,
    source: Map<number, number>,
    shift: number,
    keepMin: boolean,
  ): void => {
    source.forEach((v, g) => {
      const sv = v + shift;
      if (!target.has(g))      target.set(g, sv);
      else if (keepMin)        target.set(g, Math.min(target.get(g)!, sv));
      else                     target.set(g, Math.max(target.get(g)!, sv));
    });
  };

  interface SubLayout {
    relPos:    Map<string, number>; // personId → center-X relative to this subtree's root
    leftEdge:  Map<number, number>; // gen → leftmost  box left-edge  (relative)
    rightEdge: Map<number, number>; // gen → rightmost box right-edge (relative)
  }

  const computeNodeLayout = (personId: string): SubLayout | null => {
    if (!computedGenerations.has(personId)) return null;
    if (spanClaimed.has(personId)) return null; // Ahnenschwund: already claimed
    spanClaimed.add(personId);

    const person = people.find(p => p.id === personId);
    if (!person) return null;

    const gen = computedGenerations.get(personId)!;
    const bw  = boxDimensions.get(personId)?.width ?? 0;
    const hbw = bw / 2;

    let leftId:  string | undefined = person.fatherId ?? undefined;
    let rightId: string | undefined = person.motherId ?? undefined;
    if (leftId && rightId) {
      const ck = coupleKey(leftId, rightId);
      if ((layout.swappedCouples || []).includes(ck)) [leftId, rightId] = [rightId, leftId];
    }
    const leftInTree  = !!leftId  && computedGenerations.has(leftId);
    const rightInTree = !!rightId && computedGenerations.has(rightId);

    // Recurse – claimed nodes return null (Ahnenschwund)
    const lLayout = leftInTree  ? computeNodeLayout(leftId!)  : null;
    const rLayout = rightInTree ? computeNodeLayout(rightId!) : null;

    // Seed result with this person's own box
    const result: SubLayout = {
      relPos:    new Map([[personId, 0]]),
      leftEdge:  new Map([[gen, -hbw]]),
      rightEdge: new Map([[gen, +hbw]]),
    };

    let lShift = 0; // offset applied to left  subtree relative to result origin
    let rShift = 0; // offset applied to right subtree relative to result origin

    if (lLayout && rLayout) {
      // Find the minimum rightward shift for rLayout so no generation overlaps
      const allGens = new Set([...lLayout.rightEdge.keys(), ...rLayout.leftEdge.keys()]);
      let minShift = 0;
      allGens.forEach(g => {
        const lr = lLayout.rightEdge.get(g);
        const rl = rLayout.leftEdge.get(g);
        if (lr !== undefined && rl !== undefined) {
          minShift = Math.max(minShift, lr - rl + layout.horizontalSpacing);
        }
      });
      // Always separate the two immediate parent boxes by at least horizontalSpacing
      // (needed when parents share the same generation but their subtrees don't overlap)
      if (computedGenerations.get(leftId!)! === computedGenerations.get(rightId!)!) {
        const lbw = boxDimensions.get(leftId!)?.width  ?? 0;
        const rbw = boxDimensions.get(rightId!)?.width ?? 0;
        minShift = Math.max(minShift, lbw / 2 + layout.horizontalSpacing + rbw / 2);
      }
      // Place left and right symmetrically so this person remains at 0
      lShift = -minShift / 2;
      rShift = +minShift / 2;

    }
    // If only one parent is available (other is absent or claimed), the child stays
    // at 0 and the single parent is placed directly above it (lShift=0 / rShift=0).
    // A long S-curve line connects to any claimed ancestor.

    if (lLayout) {
      lLayout.relPos.forEach((rx, id) => result.relPos.set(id, rx + lShift));
      mergeIntoContour(result.leftEdge,  lLayout.leftEdge,  lShift, true);
      mergeIntoContour(result.rightEdge, lLayout.rightEdge, lShift, false);
    }
    if (rLayout) {
      rLayout.relPos.forEach((rx, id) => result.relPos.set(id, rx + rShift));
      mergeIntoContour(result.leftEdge,  rLayout.leftEdge,  rShift, true);
      mergeIntoContour(result.rightEdge, rLayout.rightEdge, rShift, false);
    }
    return result;
  };

  const rootLayout = computeNodeLayout(rootPersonId);

  // Shift root so the leftmost contour edge lands at marginLeft
  let rootAbsCX = layout.marginLeft + (boxDimensions.get(rootPersonId)?.width ?? 0) / 2;
  if (rootLayout && rootLayout.leftEdge.size > 0) {
    const minRel = Math.min(...rootLayout.leftEdge.values());
    rootAbsCX = layout.marginLeft - minRel;
  }

  // Build absolute center-X map from relative positions
  const nodeCenterXs = new Map<string, number>();
  rootLayout?.relPos.forEach((relX, id) => nodeCenterXs.set(id, rootAbsCX + relX));

  // Build allNodes in DFS father-first order (preserves rendering z-order)
  const allNodes: TreeNode[] = [];
  {
    const visited = new Set<string>();
    const buildDFS = (personId: string): void => {
      if (visited.has(personId) || !nodeCenterXs.has(personId)) return;
      visited.add(personId);
      const person = people.find(p => p.id === personId);
      if (!person) return;
      const gen   = computedGenerations.get(personId)!;
      const dims  = boxDimensions.get(personId) ?? { width: 0, height: 0 };
      const scale = getGenScale(gen);
      const cx    = nodeCenterXs.get(personId)!;
      const node: TreeNode = {
        person,
        x: Math.round(cx - dims.width / 2),
        y: gen,
        generation: gen,
        width:  dims.width,
        height: dims.height,
        subtreeRoot:       subtreeRoots.get(personId),
        subtreeWidth:      0,
        scale,
        effectiveTextSize: layout.textSize * scale,
        effectivePadding:  layout.personBoxPadding * scale,
      };
      allNodes.push(node);
      nodeMap.set(personId, node);
      let leftId:  string | undefined = person.fatherId ?? undefined;
      let rightId: string | undefined = person.motherId ?? undefined;
      if (leftId && rightId) {
        const ck = coupleKey(leftId, rightId);
        if ((layout.swappedCouples || []).includes(ck)) [leftId, rightId] = [rightId, leftId];
      }
      if (leftId)  buildDFS(leftId);
      if (rightId) buildDFS(rightId);
    };
    buildDFS(rootPersonId);
  }

  // ── Sibling placement (Gen 0 and Gen 1) ──────────────────────────────────
  // Siblings are placed horizontally adjacent to the main person in the same
  // generation row, ordered chronologically (born-before → left, born-after → right).
  // They are added to allNodes / nodeMap so the existing coupleToChildren and
  // single-parent line-drawing code picks them up automatically.
  if (layout.showSiblingsGen0 || layout.showSiblingsGen1) {
    // Helper: extract birth year (used for sorting)
    const extractBirthYearEarly = (dateStr: string | undefined): number | null => {
      if (!dateStr) return null;
      const m = dateStr.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
      return m ? parseInt(m[1]) : null;
    };

    // Helper: find siblings of a person (at least one shared parent), skip already-placed nodes
    const findSiblings = (person: Person): Person[] => {
      const sibSet = new Set<string>();
      people.forEach(p => {
        if (p.id === person.id || nodeMap.has(p.id)) return;
        if (person.fatherId && p.fatherId === person.fatherId) sibSet.add(p.id);
        if (person.motherId && p.motherId === person.motherId) sibSet.add(p.id);
      });
      return [...sibSet]
        .map(id => people.find(p => p.id === id))
        .filter((p): p is Person => !!p);
    };

    // Place sibling nodes left/right of a main person, chronologically sorted
    const addSiblingGroup = (mainPersonId: string, siblings: Person[], generation: number): void => {
      if (siblings.length === 0) return;
      const mainNode = nodeMap.get(mainPersonId);
      if (!mainNode) return;

      // Siblings use a fixed reduced scale (1.0) regardless of their generation so
      // they appear visually smaller than the main ancestor in the same row.
      const scale = 1.0;

      // Pre-compute box dimensions for each sibling
      siblings.forEach(sib => {
        if (boxDimensions.has(sib.id)) return;
        const dims = calculateBoxSize(sib, scale);
        boxDimensions.set(sib.id, {
          width:  Math.max(1, Math.round(dims.width)),
          height: Math.max(1, Math.round(dims.height)),
        });
      });

      const mainBY = extractBirthYearEarly(mainNode.person.birthDate);

      // Siblings born ≤ main person → go LEFT (newest closest to main person)
      const leftSibs = siblings
        .filter(s => {
          const y = extractBirthYearEarly(s.birthDate);
          return y !== null && mainBY !== null && y <= mainBY;
        })
        .sort((a, b) =>
          (extractBirthYearEarly(b.birthDate) ?? 0) - (extractBirthYearEarly(a.birthDate) ?? 0)
        );

      // Siblings born > main person or unknown year → go RIGHT (oldest closest to main person)
      const rightSibs = siblings
        .filter(s => {
          const y = extractBirthYearEarly(s.birthDate);
          return y === null || mainBY === null || y > mainBY;
        })
        .sort((a, b) =>
          (extractBirthYearEarly(a.birthDate) ?? 0) - (extractBirthYearEarly(b.birthDate) ?? 0)
        );

      // Place left siblings going leftward from main person's left edge
      let leftEdge = mainNode.x;
      for (const sib of leftSibs) {
        const dims = boxDimensions.get(sib.id)!;
        leftEdge -= layout.horizontalSpacing + dims.width;
        computedGenerations.set(sib.id, generation);
        subtreeRoots.set(sib.id, subtreeRoots.get(mainPersonId) ?? 'root');
        const node: TreeNode = {
          person:            sib,
          x:                 leftEdge,
          y:                 generation,
          generation,
          width:             dims.width,
          height:            dims.height,
          subtreeRoot:       subtreeRoots.get(sib.id),
          subtreeWidth:      0,
          scale,
          effectiveTextSize: layout.textSize * scale,
          effectivePadding:  layout.personBoxPadding * scale,
          isSibling:         true,
        };
        allNodes.push(node);
        nodeMap.set(sib.id, node);
      }

      // Place right siblings going rightward from main person's right edge
      let rightEdge = mainNode.x + mainNode.width;
      for (const sib of rightSibs) {
        const dims = boxDimensions.get(sib.id)!;
        rightEdge += layout.horizontalSpacing;
        computedGenerations.set(sib.id, generation);
        subtreeRoots.set(sib.id, subtreeRoots.get(mainPersonId) ?? 'root');
        const node: TreeNode = {
          person:            sib,
          x:                 rightEdge,
          y:                 generation,
          generation,
          width:             dims.width,
          height:            dims.height,
          subtreeRoot:       subtreeRoots.get(sib.id),
          subtreeWidth:      0,
          scale,
          effectiveTextSize: layout.textSize * scale,
          effectivePadding:  layout.personBoxPadding * scale,
          isSibling:         true,
        };
        allNodes.push(node);
        nodeMap.set(sib.id, node);
        rightEdge += dims.width;
      }
    };

    if (layout.showSiblingsGen0) {
      addSiblingGroup(rootPersonId, findSiblings(rootPerson), 0);
    }

    if (layout.showSiblingsGen1) {
      const gen1Father = rootPerson.fatherId ? people.find(p => p.id === rootPerson.fatherId) : null;
      const gen1Mother = rootPerson.motherId ? people.find(p => p.id === rootPerson.motherId) : null;
      if (gen1Father && nodeMap.has(gen1Father.id)) {
        addSiblingGroup(
          gen1Father.id,
          findSiblings(gen1Father),
          computedGenerations.get(gen1Father.id) ?? 1,
        );
      }
      if (gen1Mother && nodeMap.has(gen1Mother.id)) {
        addSiblingGroup(
          gen1Mother.id,
          findSiblings(gen1Mother),
          computedGenerations.get(gen1Mother.id) ?? 1,
        );
      }
    }

    // Global X-shift: if any sibling was placed to the left of the left margin,
    // shift ALL nodes rightward so the leftmost box starts at marginLeft.
    if (allNodes.length > 0) {
      const minNodeX = Math.min(...allNodes.map(n => n.x));
      if (minNodeX < layout.marginLeft) {
        const shift = Math.ceil(layout.marginLeft - minNodeX);
        allNodes.forEach(node => { node.x += shift; });
      }
    }
  }

  // Group by generation for height calculations
  const generations = new Map<number, TreeNode[]>();
  allNodes.forEach(node => {
    if (!generations.has(node.generation)) {
      generations.set(node.generation, []);
    }
    generations.get(node.generation)!.push(node);
  });

  const genHeights = new Map<number, number>();
  generations.forEach((genNodes, gen) => {
    const maxHeight = Math.max(...genNodes.map(n => n.height));
    genHeights.set(gen, maxHeight);
  });

  // Normalize every node's height to the generation maximum so that all boxes
  // in a row are equally tall.  All downstream code (line endpoints, canvas
  // height, minimap) automatically uses the correct uniform height.
  allNodes.forEach(node => {
    node.height = genHeights.get(node.generation) ?? node.height;
  });

  // maxGeneration is kept for reference but genPixelYs now uses sortedGens (occupied gens only)
  const _maxGeneration = Math.max(...allNodes.map(n => n.generation)); void _maxGeneration;

    // node.x is set directly inside buildDFS above.

  // ── Birth-year vertical spread within a generation row ────────────────────
  // Earlier-born persons sit higher (offset 0), later-born sit lower (offset up
  // to layout.birthYearSpread px).  Persons without a parseable birth year stay
  // at the baseline (offset 0).
  const extractBirthYear = (dateStr: string | undefined): number | null => {
    if (!dateStr) return null;
    const m = dateStr.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
    return m ? parseInt(m[1]) : null;
  };
  const birthYearOffsets = new Map<string, number>();
  if (layout.birthYearSpread > 0) {
    generations.forEach((genNodes) => {
      const withYear = genNodes
        .map(n => ({ id: n.person.id, year: extractBirthYear(n.person.birthDate) }))
        .filter((x): x is { id: string; year: number } => x.year !== null);
      if (withYear.length < 2) return;
      const minYear = Math.min(...withYear.map(x => x.year));
      const maxYear = Math.max(...withYear.map(x => x.year));
      if (minYear === maxYear) return;
      withYear.forEach(({ id, year }) => {
        const frac = (year - minYear) / (maxYear - minYear);
        birthYearOffsets.set(id, Math.round(frac * layout.birthYearSpread));
      });
    });
  }

  // Pre-compute pixel Y for each generation to avoid O(n) lookups.
  // We iterate ONLY over occupied generations (those with actual nodes) so that
  // generation numbers with no nodes don't reserve vertical space.  This
  // eliminates the blank rows that appear at the top of shallow subtrees.
  // Each row gap (except below the lowest/root row) is widened by birthYearSpread.
  const sortedGens = [...generations.keys()].sort((a, b) => b - a); // desc: topmost first
  const genPixelYs = new Map<number, number>();
  {
    let y = layout.marginTop;
    sortedGens.forEach((g, i) => {
      genPixelYs.set(g, Math.round(y));
      if (i < sortedGens.length - 1) {
        y += (genHeights.get(g) ?? 0) + layout.birthYearSpread + layout.verticalSpacing;
      }
    });
  }
  const getPixelYCached = (generation: number) => genPixelYs.get(generation) ?? Math.round(layout.marginTop);
  /** Pixel Y of the TOP EDGE of a specific node (base row Y + birth-year offset). */
  const getNodePixelY = (node: TreeNode): number =>
    getPixelYCached(node.generation) + (birthYearOffsets.get(node.person.id) ?? 0);

  // ── Parish extraction helper ──────────────────────────────────────────────
  // The parish is the last comma-separated segment of birthPlace,
  // or the whole string if there is no comma.
  // A trailing " <number>" suffix is stripped so that house numbers / lot
  // numbers don't split the same village into separate entries.
  // e.g. "Svatá Voršila 3, Ledenice" → "Ledenice"
  //      "Velešín"                   → "Velešín"
  //      "Siebenlinden 12"           → "Siebenlinden"
  const getParish = (birthPlace: string | undefined): string | null => {
    if (!birthPlace) return null;
    const trimmed = birthPlace.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(',');
    const last = parts[parts.length - 1].trim();
    // Strip trailing " <digits>" (e.g. house / lot number)
    return last.replace(/\s+\d+$/, '').trim() || null;
  };


  // Generate N visually distinct pastel colors evenly spread around the hue wheel.
  // Saturation 50 % / lightness 80 % matches the feel of the subtreeColors palette
  // while never repeating even for large parish counts.
  const generateParishPalette = (count: number): string[] =>
    Array.from({ length: count }, (_, i) =>
      `hsl(${Math.round((i / count) * 360)}, 50%, 80%)`
    );

  // A birth date qualifies for parish coloring only when it is an exact calendar
  // day in YYYY-MM-DD format.  Approximate dates like "ca 1780", "1780", or
  // "1780-06" are treated as unknown and the person is left uncoloured.
  const hasExactBirthDate = (birthDate: string | undefined): boolean => {
    if (!birthDate) return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim());
  };


  // Build parish → color map from VISIBLE nodes only (allNodes).
  // Birth places (for box colors) are always collected.
  // Marriage places (for line colors) are only collected when colorLines is enabled,
  // so that the legend only shows parishes that are actually visible on the canvas.
  const parishColorMap = new Map<string, string>();
  if (layout.colorScheme === 'by-parish') {
    const parishes = new Set<string>();
    allNodes.forEach(node => {
      if (hasExactBirthDate(node.person.birthDate)) {
        const p = getParish(node.person.birthPlace);
        if (p) parishes.add(p);
      }
      if (layout.colorLines) {
        node.person.marriages?.forEach(m => {
          // Only include a marriage place if the spouse is also rendered on the
          // canvas – otherwise the colour would appear in the legend but nowhere
          // on the canvas (e.g. a sibling who married outside the visible tree).
          if (!nodeMap.has(m.spouseId)) return;
          const mp = getParish(m.place);
          if (mp) parishes.add(mp);
        });
      }
    });
    const sortedParishes = [...parishes].sort((a, b) => a.localeCompare(b));
    const palette = generateParishPalette(sortedParishes.length);
    sortedParishes.forEach((parish, i) => {
      parishColorMap.set(parish, palette[i]);
    });
  }

  // Canvas width: rightmost rendered node right-edge + right margin
  const canvasWidth = Math.ceil(
    Math.max(...allNodes.map(n => n.x + n.width)) + layout.marginRight
  );

  let canvasHeight = layout.marginTop + layout.marginBottom;
  genHeights.forEach((height, gen) => {
    canvasHeight += height + (layout.birthYearSpread > 0 && gen > 0 ? layout.birthYearSpread : 0);
  });
  canvasHeight += (genHeights.size - 1) * layout.verticalSpacing;
  canvasHeight = Math.ceil(canvasHeight);

  // Get color for person box
  const getPersonBoxColor = (node: TreeNode): string => {
    if (layout.colorScheme === 'uniform') {
      return 'white';
    }

    // ── By-parish coloring ────────────────────────────────────────────────
    if (layout.colorScheme === 'by-parish') {
      if (!hasExactBirthDate(node.person.birthDate)) return 'white';
      const parish = getParish(node.person.birthPlace);
      if (parish) {
        const color = parishColorMap.get(parish);
        if (color) return color;
      }
      return 'white';
    }

    const rootId = node.subtreeRoot || 'root';

    if ((layout.colorScheme === 'by-grandparent' || layout.colorScheme === 'by-great-grandparent') && node.generation <= 2) {
      const slotMap = layout.colorScheme === 'by-great-grandparent' ? ggpSlotIndex : gpSlotIndex;
      if (slotMap.size > 0) {
        // DFS over all ancestors (father first for left-to-right priority) looking for the
        // first slotMap entry.  This handles illegitimate children who have no father but whose
        // mother's line leads to a great-grandparent.
        const findTargetRoot = (personId: string, seen: Set<string>): number => {
          if (seen.has(personId)) return -1;
          seen.add(personId);
          const p = people.find(q => q.id === personId);
          if (!p) return -1;
          for (const parentId of [p.fatherId, p.motherId]) {
            if (!parentId) continue;
            const slotIdx = slotMap.get(parentId);
            if (slotIdx !== undefined) return slotIdx;
            const deeper = findTargetRoot(parentId, seen);
            if (deeper !== -1) return deeper;
          }
          return -1;
        };
        const idx = findTargetRoot(node.person.id, new Set());
        if (idx !== -1) return subtreeColors[idx % subtreeColors.length];
      }
      // Fall through to normal behaviour if no ancestor match.
    }

    if (rootId === 'root') {
      return 'white';
    }

    const slotMap = layout.colorScheme === 'by-grandparent' ? gpSlotIndex : ggpSlotIndex;
    const index = slotMap.get(rootId) ?? -1;
    if (index === -1) {
      return 'white';
    }

    return subtreeColors[index % subtreeColors.length];
  };

    // ── Line-color helper ─────────────────────────────────────────────────────
    // When layout.colorLines is enabled, lines are stroked in the child node's
    // subtree color instead of the uniform borderColor.
    const getLineColor = (childNode: TreeNode): string => {
      if (!layout.colorLines || layout.colorScheme === 'uniform') return layout.borderColor;
      if (layout.colorScheme === 'by-parish') return layout.borderColor; // fallback; use getCoupleParishLineColor for couples
      const boxColor = getPersonBoxColor(childNode);
      return boxColor === 'white' ? layout.borderColor : boxColor;
    };

    // ── Rounded-corner path helper ────────────────────────────────────────────
    // Takes an ordered list of orthogonal waypoints and returns an SVG path string
    // where every interior 90° corner is replaced by a quadratic Bézier curve of
    // radius `r`.  T-intersections are never passed as interior waypoints so they
    // are naturally left as sharp intersections.
    const cornerR = 10;
    const buildRoundedPath = (pts: Array<[number, number]>, r: number): string => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const len1 = Math.hypot(x1 - x0, y1 - y0);
        const len2 = Math.hypot(x2 - x1, y2 - y1);
        const rad = Math.min(r, len1 / 2, len2 / 2);
        if (rad < 0.5) {
          d += ` L ${x1} ${y1}`;
        } else {
          const bx = x1 - (x1 - x0) / len1 * rad;
          const by = y1 - (y1 - y0) / len1 * rad;
          const ax = x1 + (x2 - x1) / len2 * rad;
          const ay = y1 + (y2 - y1) / len2 * rad;
          d += ` L ${bx} ${by} Q ${x1} ${y1} ${ax} ${ay}`;
        }
      }
      d += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
      return d;
    };

    // Generate connection lines and marriage labels
    const lines: ReactElement[] = [];
    const marriageLabels: ReactElement[] = [];
    let totalLineLength = 0;

    // Helper to accumulate line segment length
    const addLineLength = (x1: number, y1: number, x2: number, y2: number) => {
    totalLineLength += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    };

    // Helper to accumulate all segments of a waypoint path
    const addPathLength = (pts: Array<[number, number]>): void => {
      for (let i = 0; i < pts.length - 1; i++) {
        addLineLength(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      }
    };

    // ── Skip-generation obstacle-aware routing ────────────────────────────────
    // For parent-child connections that span more than one generation row, the
    // naive midY-horizontal path crosses intermediate boxes.  Solution:
    //   • Route horizontal segments through the GAP areas between row bands
    //     (guaranteed box-free – no node box ever lives in a gap).
    //   • Route the single vertical corridor at an X position checked free of
    //     every intermediate-generation node box.
    //
    // getGapMidY: midpoint Y of the visual gap between two adjacent gen rows.
    //   upperGen is visually above (smaller Y); lowerGen is visually below (larger Y).
    const getGapMidY = (upperGen: number, lowerGen: number): number => {
      const upperBottom = (genPixelYs.get(upperGen) ?? 0) + (genHeights.get(upperGen) ?? 0);
      const lowerTop    = genPixelYs.get(lowerGen) ?? upperBottom;
      return Math.round((upperBottom + lowerTop) / 2);
    };

    // Per-generation bounding intervals [left−margin, right+margin]
    const ROUTE_MARGIN = Math.max(4, Math.ceil(layout.lineWidth) + 2);
    const genBoxIntervals = new Map<number, Array<[number, number]>>();
    generations.forEach((genNodes, gen) => {
      genBoxIntervals.set(gen, genNodes.map(n => [n.x - ROUTE_MARGIN, n.x + n.width + ROUTE_MARGIN]));
    });

    // True iff x avoids all boxes in every gen row from minGen to maxGen (inclusive)
    const isXFreeInGens = (x: number, minGen: number, maxGen: number): boolean => {
      for (let g = minGen; g <= maxGen; g++) {
        const ivs = genBoxIntervals.get(g);
        if (ivs && ivs.some(([l, r]) => x > l && x < r)) return false;
      }
      return true;
    };

    // Nearest X (scanning outward from preferred) that is free in gens minGen..maxGen
    const findSkipCorridorX = (preferred: number, minGen: number, maxGen: number): number => {
      if (isXFreeInGens(preferred, minGen, maxGen)) return preferred;
      const step = Math.max(4, Math.ceil(layout.horizontalSpacing / 6));
      for (let d = step; d <= 5000; d += step) {
        if (isXFreeInGens(preferred - d, minGen, maxGen)) return preferred - d;
        if (isXFreeInGens(preferred + d, minGen, maxGen)) return preferred + d;
      }
      return preferred; // fallback: no truly free corridor found
    };

    // Build an orthogonal waypoint path for a skip-gen connection.
    // fromX/fromY: start point (couple joint or single parent bottom)
    // toX/toY:     end point (child box top)
    // childGen < parentGen (numerically; higher gen = visually above = smaller Y)
    const routeSkipGenPath = (
      fromX: number, fromY: number,
      toX:   number, toY:   number,
      childGen: number, parentGen: number,
    ): Array<[number, number]> => {
      // Intermediate occupied gens strictly between child and parent (desc sorted)
      const intermediateGens = sortedGens.filter(g => g > childGen && g < parentGen);

      if (intermediateGens.length === 0) {
        // No intermediate rows – single gap, use a clean 4-point crossing
        const midY = getGapMidY(parentGen, childGen);
        return [[fromX, fromY], [fromX, midY], [toX, midY], [toX, toY]];
      }

      const topIG = intermediateGens[0];                          // largest gen < parentGen
      const botIG = intermediateGens[intermediateGens.length - 1]; // smallest gen > childGen

      // Horizontal crossing Y-values placed in guaranteed-empty GAP zones
      const exitY  = getGapMidY(parentGen, topIG); // gap just below parent row
      const enterY = getGapMidY(botIG, childGen);  // gap just above child  row

      // Free vertical corridor through all intermediate rows
      const corridorX = findSkipCorridorX(Math.round((fromX + toX) / 2), botIG, topIG);

      // Collapse to 4-point when there is only one gap worth of space
      if (Math.abs(exitY - enterY) < 4) {
        return [[fromX, fromY], [fromX, exitY], [toX, exitY], [toX, toY]];
      }

      // 6-waypoint path – every horizontal runs in a gap, every vertical at a free X
      return [
        [fromX,     fromY],   // 1 – parent drop point
        [fromX,     exitY],   // 2 – descend into gap below parent row
        [corridorX, exitY],   // 3 – slide horizontally to free corridor
        [corridorX, enterY],  // 4 – descend through intermediate rows (free corridor)
        [toX,       enterY],  // 5 – approach child in gap above child row
        [toX,       toY],     // 6 – enter child box from above
      ];
    };

    // ── Parent-drop path builder ───────────────────────────────────────────────
    // Routes one parent's vertical drop to the couple bar at (meetX, meetY).
    // When a parent is at a HIGHER gen than the other parent (whose box bottom sets
    // meetY), a naive straight drop would cross the lower parent's generation row.
    // We detour: gap above lower-gen row → free corridor → arrive at meetY.
    const buildParentDropPath = (
      parentCX:       number,
      parentBY:       number,
      parentGen:      number,
      lowerParentGen: number,  // gen that determines meetY = min(father/motherGen)
      meetX:          number,
      meetY:          number,
    ): Array<[number, number]> => {
      if (parentGen <= lowerParentGen) {
        // Standard: same level or lower – simple 3-point path
        return [[parentCX, parentBY], [parentCX, meetY], [meetX, meetY]];
      }
      // Higher parent: first try going straight through the lower-gen row at parentCX.
      // This produces the most direct path (identical shape to the standard case) and
      // eliminates the wide lateral detour that arose when the corridor search was
      // anchored to meetX (far from the parent's natural drop-line).
      if (isXFreeInGens(parentCX, lowerParentGen, lowerParentGen)) {
        return [[parentCX, parentBY], [parentCX, meetY], [meetX, meetY]];
      }
      // parentCX is blocked in the lower-gen row (e.g. the lower parent's box is
      // there).  Route via a free corridor, but search outward from parentCX rather
      // than meetX so the horizontal detour segment stays as short as possible.
      const gapY  = getGapMidY(parentGen, lowerParentGen);
      const corrX = findSkipCorridorX(parentCX, lowerParentGen, lowerParentGen);
      return [
        [parentCX, parentBY],  // parent box bottom
        [parentCX, gapY],      // descend to gap above lower-gen row
        [corrX,    gapY],      // slide to free corridor (gap zone – no boxes)
        [corrX,    meetY],     // descend through lower-gen row at corridor X
        [meetX,    meetY],     // arrive at couple meeting point
      ];
    };

    // ── Group children by parent couple ──────────────────────────────────────
    // When the same couple has multiple children visible in the tree (Ahnenschwund),
    // this ensures the parent bar is drawn ONCE and a clean hub/spine pattern is used.
    const coupleToChildren = new Map<string, { fn: TreeNode; mn: TreeNode; children: TreeNode[] }>();
    allNodes.forEach(node => {
      const fn = node.person.fatherId ? nodeMap.get(node.person.fatherId) : null;
      const mn = node.person.motherId ? nodeMap.get(node.person.motherId) : null;
      if (fn && mn) {
        const ck = coupleKey(node.person.fatherId!, node.person.motherId!);
        if (!coupleToChildren.has(ck)) coupleToChildren.set(ck, { fn, mn, children: [] });
        coupleToChildren.get(ck)!.children.push(node);
      }
    });

    // ── Compute stagger offsets for overlapping multi-child spines ───────────
    // Couples whose child-spine X ranges overlap and share the same parentBottomY
    // would render their horizontal spine line at identical Y coordinates.
    // Greedy interval-graph colouring assigns each such couple a stagger level so
    // that no two overlapping spines share the same Y.
    const SPINE_STAGGER_PX = 8;
    const coupleSpineStagger = new Map<string, number>(); // ck → stagger level
    {
      const DROP_DIST = 15; // must match `dropDistance` below
      const entries: Array<{ ck: string; spineLeft: number; spineRight: number; parentBottomY: number }> = [];
      coupleToChildren.forEach(({ fn: fatherNode, mn: motherNode, children }, ck) => {
        if (children.length <= 1) return;
        const fatherCenterX = fatherNode.x + fatherNode.width / 2;
        const motherCenterX = motherNode.x + motherNode.width / 2;
        const parentsMidX   = (fatherCenterX + motherCenterX) / 2;
        const parentBottomY = Math.max(
          getNodePixelY(fatherNode) + fatherNode.height,
          getNodePixelY(motherNode) + motherNode.height,
        );
        const dropY       = parentBottomY + DROP_DIST;
        void dropY; // only parentBottomY is used for grouping
        const childXs     = children.map(c => c.x + c.width / 2);
        const spineLeft   = Math.min(parentsMidX, ...childXs);
        const spineRight  = Math.max(parentsMidX, ...childXs);
        entries.push({ ck, spineLeft, spineRight, parentBottomY });
      });

      // Group by parentBottomY (same generation row → same base dropY)
      const byParentY = new Map<number, typeof entries>();
      entries.forEach(e => {
        if (!byParentY.has(e.parentBottomY)) byParentY.set(e.parentBottomY, []);
        byParentY.get(e.parentBottomY)!.push(e);
      });

      // Greedy interval colouring: assign the smallest level at which this
      // interval does not overlap any already-placed interval at that level.
      byParentY.forEach(group => {
        const sorted = [...group].sort((a, b) => a.spineLeft - b.spineLeft);
        const levelMaxRight: number[] = []; // rightmost spineRight per level
        sorted.forEach(entry => {
          let placed = false;
          for (let i = 0; i < levelMaxRight.length; i++) {
            if (entry.spineLeft >= levelMaxRight[i]) {
              coupleSpineStagger.set(entry.ck, i);
              levelMaxRight[i] = entry.spineRight;
              placed = true;
              break;
            }
          }
          if (!placed) {
            coupleSpineStagger.set(entry.ck, levelMaxRight.length);
            levelMaxRight.push(entry.spineRight);
          }
        });
      });
    }

    // ── Two-parent family connections ─────────────────────────────────────────
    coupleToChildren.forEach(({ fn: fatherNode, mn: motherNode, children }, ck) => {
    const fatherCenterX = fatherNode.x + fatherNode.width / 2;
    const motherCenterX = motherNode.x + motherNode.width / 2;
    const fatherBottomY = getNodePixelY(fatherNode) + fatherNode.height;
    const motherBottomY = getNodePixelY(motherNode) + motherNode.height;
    const parentBottomY = Math.max(fatherBottomY, motherBottomY);
    const parentsMidX = (fatherCenterX + motherCenterX) / 2;
    const dropDistance = 15;
    const dropY = parentBottomY + dropDistance;
    const isMultiChild = children.length > 1;

    // Sort children left→right (needed for spine)
    const sortedChildren = isMultiChild
      ? [...children].sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2))
      : children;
    const childXs = sortedChildren.map(c => c.x + c.width / 2);
    // Spine range covers all children AND both parent drop points
    const _spineLeft  = isMultiChild ? Math.min(Math.min(...childXs), Math.min(fatherCenterX, motherCenterX)) : parentsMidX; void _spineLeft;
    const _spineRight = isMultiChild ? Math.max(Math.max(...childXs), Math.max(fatherCenterX, motherCenterX)) : parentsMidX; void _spineRight;

    // Line color for this couple: for by-parish use the couple's own marriage place;
    // otherwise derived from the leftmost child's subtree color (or borderColor if uniform).
    // Look up marriage data for this specific couple (reused for line color + label).
    const f = fatherNode.person;
    const m = motherNode.person;
    const fromFather = f.marriages?.find(e => e.spouseId === m.id);
    const fromMother = m.marriages?.find(e => e.spouseId === f.id);
    const coupleMarriage =
      (fromFather?.date || fromFather?.place) ? fromFather :
      (fromMother?.date || fromMother?.place) ? fromMother :
      null;

    // Line color for this couple: for by-parish use the couple's own marriage place;
    // otherwise derived from the leftmost child's subtree color (or borderColor if uniform).
    const coupleLineColor = (() => {
      if (layout.colorLines && layout.colorScheme === 'by-parish') {
        const parish = getParish(coupleMarriage?.place);
        if (parish) {
          const color = parishColorMap.get(parish);
          if (color) return color;
        }
        return layout.borderColor;
      }
      return getLineColor(sortedChildren[0]);
    })();

    // ── Parent bar (drawn once per couple) ─────────────────────────────────
    // When parents are at the same generation, each drops straight to dropY.
    // When they differ, the higher parent's drop must route around the lower
    // parent's row (otherwise its line would be covered by that row's boxes,
    // creating a "ghost line" that appears to end in empty space).
    const lowerParentGen = Math.min(fatherNode.generation, motherNode.generation);
    const fdPts = buildParentDropPath(fatherCenterX, fatherBottomY, fatherNode.generation, lowerParentGen, parentsMidX, dropY);
    const mdPts = buildParentDropPath(motherCenterX, motherBottomY, motherNode.generation, lowerParentGen, parentsMidX, dropY);

    if (layout.lineStyle === 'rounded') {
      // Extend each parent path with a short downward stub past the junction so that
      // the horizontal→vertical transition AT the couple meeting point becomes an
      // interior corner and gets rounded by buildRoundedPath.  Without the stub the
      // junction is the last waypoint of each path and therefore left sharp (right→down
      // for the father, left→down for the mother), producing the T-intersection bug.
      // The stem / child line starts at dropY and covers the stub overlap seamlessly.
      const junctionStub = Math.min(cornerR, dropDistance);
      const fdPtsR: Array<[number, number]> = [...fdPts, [parentsMidX, dropY + junctionStub]];
      const mdPtsR: Array<[number, number]> = [...mdPts, [parentsMidX, dropY + junctionStub]];
      lines.push(<path key={`fd-${ck}`} d={buildRoundedPath(fdPtsR, cornerR)} stroke={coupleLineColor} strokeWidth={layout.lineWidth} fill="none"/>);
      addPathLength(fdPts);
      lines.push(<path key={`md-${ck}`} d={buildRoundedPath(mdPtsR, cornerR)} stroke={coupleLineColor} strokeWidth={layout.lineWidth} fill="none"/>);
      addPathLength(mdPts);
    } else {
      // Straight: draw each waypoint segment individually
      for (let i = 0; i < fdPts.length - 1; i++) {
        const [x1, y1] = fdPts[i], [x2, y2] = fdPts[i + 1];
        lines.push(<line key={`fd-${ck}-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
      }
      addPathLength(fdPts);
      for (let i = 0; i < mdPts.length - 1; i++) {
        const [x1, y1] = mdPts[i], [x2, y2] = mdPts[i + 1];
        lines.push(<line key={`md-${ck}-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
      }
      addPathLength(mdPts);
      // For same-gen parents draw the explicit horizontal bar at dropY (for multi-child
      // it connects the two vertical drops; for single-child it's drawn below instead).
      if (!isMultiChild && fatherNode.generation === motherNode.generation) {
        lines.push(<line key={`ph-${ck}`} x1={fatherCenterX} y1={dropY} x2={motherCenterX} y2={dropY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
        addLineLength(fatherCenterX, dropY, motherCenterX, dropY);
      }
    }

    // ── Marriage info label ───────────────────────────────────────────────
    if (layout.showMarriageInfo) {
      // coupleMarriage already computed above for line color.
      if (coupleMarriage) {
        const labelX = parentsMidX;
        const labelY = parentBottomY + layout.textSize + 2;
        let marriageText = '⚭';
        if (coupleMarriage.date)  marriageText += ' ' + formatDate(coupleMarriage.date, layout.dateFormat);
        if (coupleMarriage.place) marriageText += ' in ' + coupleMarriage.place;
        marriageLabels.push(
          <text key={`marriage-${ck}`} x={labelX} y={labelY} textAnchor="middle" fontSize={layout.textSize - 3} fill="#666" style={{ userSelect: 'none' }}>
            {marriageText}
          </text>
        );
      }
    }

    // ── Swap button ───────────────────────────────────────────────────────
    if (onCoupleSwap) {
      const isSwapped = (layout.swappedCouples || []).includes(ck);
      const btnX = (fatherNode.x + fatherNode.width + motherNode.x) / 2;
      const btnY = parentBottomY - fatherNode.height / 2;
      marriageLabels.push(
        <g key={`swap-btn-${ck}`} onClick={(e) => { e.stopPropagation(); onCoupleSwap(ck); }} style={{ cursor: 'pointer' }}>
          <title>Mann/Frau tauschen</title>
          <rect x={btnX - 10} y={btnY - 9} width={20} height={18} rx={4} fill={isSwapped ? '#3b82f6' : '#e5e7eb'} stroke={isSwapped ? '#2563eb' : '#9ca3af'} strokeWidth={1}/>
          <text x={btnX} y={btnY + 5} textAnchor="middle" fontSize={12} fill={isSwapped ? 'white' : '#374151'} style={{ userSelect: 'none', fontFamily: 'monospace' }}>⇄</text>
        </g>
      );
    }

    // ── Child connections ─────────────────────────────────────────────────
    if (!isMultiChild) {
      const child = children[0];
      const childCenterX = child.x + child.width / 2;
      const childTopY = getNodePixelY(child);
      // genGap is measured from the LOWER parent (the one whose bottomY sets dropY),
      // not the higher parent.  If one parent is at gen 4 and the other at gen 3,
      // dropY is just below gen 3, so the visual gap to the child is only 1 row.
      // Using maxParentGen here would incorrectly trigger skip-gen routing and
      // produce an upward-going path (fromY > exitY) – the "ghost line" bug.
      const effectiveParentGen = lowerParentGen;
      const genGap = effectiveParentGen - child.generation;

      if (genGap > 1) {
        // ── Skip-gen: route around intermediate-generation boxes ──────────
        const pts = routeSkipGenPath(parentsMidX, dropY, childCenterX, childTopY, child.generation, effectiveParentGen);
        if (layout.lineStyle === 'rounded') {
          lines.push(<path key={`child-line-${child.person.id}`} d={buildRoundedPath(pts, cornerR)} stroke={coupleLineColor} strokeWidth={layout.lineWidth} fill="none"/>);
        } else {
          pts.forEach(([,], i) => {
            if (i === pts.length - 1) return;
            const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
            lines.push(<line key={`skip-${child.person.id}-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
          });
        }
        addPathLength(pts);
      } else {
        // ── Standard single-gap routing ───────────────────────────────────
        const midY = (childTopY + parentBottomY) / 2;
        if (layout.lineStyle === 'rounded') {
          if (Math.abs(childCenterX - parentsMidX) < 1) {
            // Vertically aligned: straight drop, no corners
            lines.push(<line key={`cv-${child.person.id}`} x1={parentsMidX} y1={dropY} x2={childCenterX} y2={childTopY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
            addLineLength(parentsMidX, dropY, childCenterX, childTopY);
          } else {
            const pts: Array<[number, number]> = [[parentsMidX, dropY], [parentsMidX, midY], [childCenterX, midY], [childCenterX, childTopY]];
            lines.push(<path key={`child-line-${child.person.id}`} d={buildRoundedPath(pts, cornerR)} stroke={coupleLineColor} strokeWidth={layout.lineWidth} fill="none"/>);
            addPathLength(pts);
          }
        } else {
          lines.push(<line key={`pm-${child.person.id}`} x1={parentsMidX} y1={dropY} x2={parentsMidX} y2={midY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
          addLineLength(parentsMidX, dropY, parentsMidX, midY);
          if (Math.abs(childCenterX - parentsMidX) > 1) {
            lines.push(<line key={`ch-${child.person.id}`} x1={parentsMidX} y1={midY} x2={childCenterX} y2={midY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
            addLineLength(parentsMidX, midY, childCenterX, midY);
          }
          lines.push(<line key={`cv-${child.person.id}`} x1={childCenterX} y1={midY} x2={childCenterX} y2={childTopY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
          addLineLength(childCenterX, midY, childCenterX, childTopY);
        }
      }
    } else {
      // Multiple children: two-level pattern
      //   Both parents drop to dropY → horizontal parent bar at dropY →
      //   stem from midpoint down to childSpineY → horizontal child spine → vertical drops to children
      //   The rounded parent bar is already drawn via the fd/md half-paths above.
      //   Stem, spine, and child drops are T-intersections → no rounding needed.
      const staggerLevel = coupleSpineStagger.get(ck) ?? 0;
      const childSpineY = dropY + dropDistance + staggerLevel * SPINE_STAGGER_PX;
      const childSpineLeft  = Math.min(parentsMidX, ...childXs);
      const childSpineRight = Math.max(parentsMidX, ...childXs);

      if (layout.lineStyle !== 'rounded' && fatherNode.generation === motherNode.generation) {
        // Straight + same-gen parents: explicit horizontal bar at dropY.
        // For different-gen parents this is already handled by the fd/md detour paths.
        lines.push(<line key={`ph-${ck}`} x1={fatherCenterX} y1={dropY} x2={motherCenterX} y2={dropY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
        addLineLength(fatherCenterX, dropY, motherCenterX, dropY);
      }
      // Stem from parent midpoint down to child spine (T-intersection at both ends)
      lines.push(<line key={`stem-${ck}`} x1={parentsMidX} y1={dropY} x2={parentsMidX} y2={childSpineY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
      addLineLength(parentsMidX, dropY, parentsMidX, childSpineY);
      // Horizontal child spine (T-intersections with stem above and child drops below)
      lines.push(<line key={`spine-${ck}`} x1={childSpineLeft} y1={childSpineY} x2={childSpineRight} y2={childSpineY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
      addLineLength(childSpineLeft, childSpineY, childSpineRight, childSpineY);
      // Vertical drop to each child's box top – all use the couple's line color
      sortedChildren.forEach(child => {
        const childCenterX = child.x + child.width / 2;
        const childTopY = getNodePixelY(child);
        lines.push(<line key={`cv-${child.person.id}`} x1={childCenterX} y1={childSpineY} x2={childCenterX} y2={childTopY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
        addLineLength(childCenterX, childSpineY, childCenterX, childTopY);
      });
    }
    });

    // ── Single-parent connections ─────────────────────────────────────────────
    allNodes.forEach(node => {
    const fatherNode = node.person.fatherId ? nodeMap.get(node.person.fatherId) : null;
    const motherNode = node.person.motherId ? nodeMap.get(node.person.motherId) : null;
    if (fatherNode && motherNode) return; // handled in couple loop above

    const parent = fatherNode ?? motherNode;
    if (!parent) return;

    const childCenterX = node.x + node.width / 2;
    const childTopY = getNodePixelY(node);

    const parentCenterX = parent.x + parent.width / 2;
    const parentBottomY = getNodePixelY(parent) + parent.height;

    const spGenGap = parent.generation - node.generation;

    if (spGenGap > 1) {
      // ── Skip-gen single-parent routing ─────────────────────────────────
      const pts = routeSkipGenPath(parentCenterX, parentBottomY, childCenterX, childTopY, node.generation, parent.generation);
      if (layout.lineStyle === 'rounded') {
        lines.push(<path key={`single-parent-${node.person.id}`} d={buildRoundedPath(pts, cornerR)} stroke={getLineColor(node)} strokeWidth={layout.lineWidth} fill="none"/>);
      } else {
        pts.forEach(([,], i) => {
          if (i === pts.length - 1) return;
          const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
          lines.push(<line key={`skip-sp-${node.person.id}-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={getLineColor(node)} strokeWidth={layout.lineWidth}/>);
        });
      }
      addPathLength(pts);
    } else if (layout.lineStyle === 'rounded') {
        if (Math.abs(childCenterX - parentCenterX) < 1) {
          // Vertically aligned: straight line, no corners
          lines.push(
            <line key={`single-parent-${node.person.id}`} x1={parentCenterX} y1={parentBottomY} x2={childCenterX} y2={childTopY} stroke={getLineColor(node)} strokeWidth={layout.lineWidth}/>
          );
          addLineLength(parentCenterX, parentBottomY, childCenterX, childTopY);
        } else {
          const midY = Math.round((parentBottomY + childTopY) / 2);
          const pts: Array<[number, number]> = [
            [parentCenterX, parentBottomY],
            [parentCenterX, midY],
            [childCenterX, midY],
            [childCenterX, childTopY],
          ];
          lines.push(
            <path key={`single-parent-${node.person.id}`} d={buildRoundedPath(pts, cornerR)} stroke={getLineColor(node)} strokeWidth={layout.lineWidth} fill="none"/>
          );
          addLineLength(parentCenterX, parentBottomY, parentCenterX, midY);
          addLineLength(parentCenterX, midY, childCenterX, midY);
          addLineLength(childCenterX, midY, childCenterX, childTopY);
        }
      } else {
        // Straight style: use orthogonal connector (down → across → down)
        // to avoid long diagonal lines when parent and child are far apart horizontally.
        if (Math.abs(childCenterX - parentCenterX) < 1) {
          // Already vertically aligned – simple straight line
          lines.push(
            <line
              key={`single-parent-${node.person.id}`}
              x1={parentCenterX} y1={parentBottomY}
              x2={childCenterX} y2={childTopY}
              stroke={getLineColor(node)} strokeWidth={layout.lineWidth}
            />
          );
          addLineLength(parentCenterX, parentBottomY, childCenterX, childTopY);
        } else {
          const midY = Math.round((parentBottomY + childTopY) / 2);
          lines.push(<line key={`sp-v1-${node.person.id}`} x1={parentCenterX} y1={parentBottomY} x2={parentCenterX} y2={midY} stroke={getLineColor(node)} strokeWidth={layout.lineWidth}/>);
          lines.push(<line key={`sp-h-${node.person.id}`}  x1={parentCenterX} y1={midY}          x2={childCenterX}  y2={midY}          stroke={getLineColor(node)} strokeWidth={layout.lineWidth}/>);
          lines.push(<line key={`sp-v2-${node.person.id}`} x1={childCenterX}  y1={midY}          x2={childCenterX}  y2={childTopY}     stroke={getLineColor(node)} strokeWidth={layout.lineWidth}/>);
          addLineLength(parentCenterX, parentBottomY, parentCenterX, midY);
          addLineLength(parentCenterX, midY, childCenterX, midY);
          addLineLength(childCenterX, midY, childCenterX, childTopY);
        }
      }
    });

    // Report stats + node layout via microtask
    const _reportStats = onStatsChange;
    if (_reportStats) {
      Promise.resolve().then(() => _reportStats(canvasWidth, canvasHeight, totalLineLength));
    }
    if (onNodesLayout) {
      const pixelNodes: PixelNode[] = allNodes.map(node => ({
        x: node.x,
        y: getNodePixelY(node),
        width: node.width,
        height: node.height,
        color: getPersonBoxColor(node),
      }));
      Promise.resolve().then(() => onNodesLayout(pixelNodes));
    }
    if (onLegendData) {
      const entries: LegendEntry[] = [];
      if (layout.colorScheme === 'by-parish') {
        parishColorMap.forEach((color, parish) => {
          entries.push({ label: parish, color });
        });
        // already sorted alphabetically since parishColorMap was built from sorted parishes
      } else if (layout.colorScheme === 'by-grandparent') {
        // Always emit all 4 grandparent slots (Kekulé 4–7) so unknown slots are visible
        gpFixed.forEach((id, slotIdx) => {
          const kekuleNumber = 4 + slotIdx;
          const person = id ? people.find(p => p.id === id) : null;
          if (person) {
            entries.push({ label: `${person.firstName} ${person.lastName}`, color: subtreeColors[slotIdx % subtreeColors.length], kekuleNumber });
          } else {
            entries.push({ label: 'Unknown', color: '#d1d5db', kekuleNumber, isUnknown: true });
          }
        });
      } else if (layout.colorScheme === 'by-great-grandparent') {
        // Always emit all 8 great-grandparent slots (Kekulé 8–15) so unknown slots are visible
        ggpFixed.forEach((id, slotIdx) => {
          const kekuleNumber = 8 + slotIdx;
          const person = id ? people.find(p => p.id === id) : null;
          if (person) {
            entries.push({ label: `${person.firstName} ${person.lastName}`, color: subtreeColors[slotIdx % subtreeColors.length], kekuleNumber });
          } else {
            entries.push({ label: 'Unknown', color: '#d1d5db', kekuleNumber, isUnknown: true });
          }
        });
      }
      Promise.resolve().then(() => onLegendData(entries));
    }

  return (
    <div className="p-8 min-h-full">
      <svg
        ref={svgRef}
        width={canvasWidth}
        height={canvasHeight}
        className="mx-auto bg-white"
        style={{
          border: `${layout.borderWidth}px solid ${layout.borderColor}`,
          backgroundColor: backgroundColors[layout.backgroundSkin],
        }}
      >
        {lines}
        {marriageLabels}
        {allNodes.map(node => {
          const x = node.x;
          const y = getNodePixelY(node);
          const boxColor = getPersonBoxColor(node);


          const ts = node.effectiveTextSize;
          const pd = node.effectivePadding;
          const lg = Math.round(4 * node.scale); // line gap between name lines
          const sg = Math.round(2 * node.scale); // line gap for detail lines

          let currentY = y + pd + ts;

          return (
            <g
              key={node.person.id}
              onClick={() => onPersonClick?.(node.person)}
              style={{ cursor: onPersonClick ? 'pointer' : 'default' }}
              opacity={node.isSibling ? 0.72 : 1}
            >
              <rect
                x={x}
                y={y}
                width={node.width}
                height={node.height}
                fill={boxColor}
                stroke={layout.borderColor}
                strokeWidth={layout.borderWidth}
              />
                {layout.showGenderSymbol && node.person.gender && node.person.gender !== 'other' && (() => {
                const symbolSize = Math.max(8, Math.round(ts * 0.85));
                const symbolX = x + node.width - pd * 0.6;
                const symbolY = y + symbolSize * 0.9;
                const isMale = node.person.gender === 'male';
                return (
                  <text
                    x={symbolX}
                    y={symbolY}
                    textAnchor="end"
                    fontSize={symbolSize}
                    fill={isMale ? '#3b82f6' : '#ec4899'}
                    style={{ userSelect: 'none' }}
                    aria-hidden="true"
                  >
                    {isMale ? '♂' : '♀'}
                  </text>
                );
              })()}
              <text
                x={x + node.width / 2}
                y={currentY}
                textAnchor="middle"
                fontSize={ts}
                fontWeight="normal"
              >
                {node.person.firstName}
              </text>
              <text
                x={x + node.width / 2}
                y={currentY + ts + lg}
                textAnchor="middle"
                fontSize={ts}
                fontWeight="500"
              >
                {node.person.lastName}
              </text>
              {(() => {
                currentY += ts + lg + ts + lg;
                const elements: ReactElement[] = [];

                if (layout.showBirthDate && node.person.birthDate) {
                  elements.push(
                    <text key="birth-date" x={x + node.width / 2} y={currentY} textAnchor="middle" fontSize={ts - 2} fill="#666">
                      * {formatDate(node.person.birthDate, layout.dateFormat)}
                    </text>
                  );
                  currentY += ts + sg;
                }

                if (layout.showBirthPlace && node.person.birthPlace) {
                  elements.push(
                    <text key="birth-place" x={x + node.width / 2} y={currentY} textAnchor="middle" fontSize={ts - 2} fill="#666">
                      {node.person.birthPlace}
                    </text>
                  );
                  currentY += ts + sg;
                }

                if (layout.showDeathDate && node.person.deathDate) {
                  elements.push(
                    <text key="death-date" x={x + node.width / 2} y={currentY} textAnchor="middle" fontSize={ts - 2} fill="#666">
                      † {formatDate(node.person.deathDate, layout.dateFormat)}
                    </text>
                  );
                  currentY += ts + sg;
                }

                if (layout.showDeathPlace && node.person.deathPlace) {
                  elements.push(
                    <text key="death-place" x={x + node.width / 2} y={currentY} textAnchor="middle" fontSize={ts - 2} fill="#666">
                      {node.person.deathPlace}
                    </text>
                  );
                  currentY += ts + sg;
                }

                if (layout.showOccupation) {
                  const occ = buildOccupationText(node.person);
                  if (occ) {
                    elements.push(
                      <text key="occupation" x={x + node.width / 2} y={currentY} textAnchor="middle" fontSize={ts - 2} fill="#666">
                        {occ}
                      </text>
                    );
                  }
                }

                return elements;
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
});
