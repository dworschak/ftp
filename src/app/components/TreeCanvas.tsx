import { Person, LayoutSettings, GraphType, BackgroundSkin } from '../types';
import { ReactElement } from 'react';
import { formatDate } from '../utils/dateFormat';

/** A person box in pixel coordinates – used by the minimap. */
export interface PixelNode {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
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

export function TreeCanvas({ people, rootPersonId, graphType: _graphType, layout, onPersonClick, onCoupleSwap, onStatsChange, onNodesLayout }: TreeCanvasProps) {
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
      lines.push(`b. ${formatDate(person.birthDate, layout.dateFormat)}`);
    }
    if (layout.showBirthPlace && person.birthPlace) {
      lines.push(person.birthPlace);
    }
    if (layout.showDeathDate && person.deathDate) {
      lines.push(`d. ${formatDate(person.deathDate, layout.dateFormat)}`);
    }
    if (layout.showDeathPlace && person.deathPlace) {
      lines.push(person.deathPlace);
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

  // Determine grandparents and great-grandparents for color coding
  const grandparents: string[] = [];
  const greatGrandparents: string[] = [];

  if (layout.colorScheme !== 'uniform') {
    const father = rootPerson.fatherId ? people.find(p => p.id === rootPerson.fatherId) : null;
    const mother = rootPerson.motherId ? people.find(p => p.id === rootPerson.motherId) : null;

    if (father) {
      const pgf = father.fatherId ? people.find(p => p.id === father.fatherId) : null;
      const pgm = father.motherId ? people.find(p => p.id === father.motherId) : null;
      if (pgf) grandparents.push(pgf.id);
      if (pgm) grandparents.push(pgm.id);

      if (layout.colorScheme === 'by-great-grandparent') {
        if (pgf) {
          const ggf1 = pgf.fatherId ? people.find(p => p.id === pgf.fatherId) : null;
          const ggm1 = pgf.motherId ? people.find(p => p.id === pgf.motherId) : null;
          if (ggf1) greatGrandparents.push(ggf1.id);
          if (ggm1) greatGrandparents.push(ggm1.id);
        }
        if (pgm) {
          const ggf2 = pgm.fatherId ? people.find(p => p.id === pgm.fatherId) : null;
          const ggm2 = pgm.motherId ? people.find(p => p.id === pgm.motherId) : null;
          if (ggf2) greatGrandparents.push(ggf2.id);
          if (ggm2) greatGrandparents.push(ggm2.id);
        }
      }
    }

    if (mother) {
      const mgf = mother.fatherId ? people.find(p => p.id === mother.fatherId) : null;
      const mgm = mother.motherId ? people.find(p => p.id === mother.motherId) : null;
      if (mgf) grandparents.push(mgf.id);
      if (mgm) grandparents.push(mgm.id);

      if (layout.colorScheme === 'by-great-grandparent') {
        if (mgf) {
          const ggf3 = mgf.fatherId ? people.find(p => p.id === mgf.fatherId) : null;
          const ggm3 = mgf.motherId ? people.find(p => p.id === mgf.motherId) : null;
          if (ggf3) greatGrandparents.push(ggf3.id);
          if (ggm3) greatGrandparents.push(ggm3.id);
        }
        if (mgm) {
          const ggf4 = mgm.fatherId ? people.find(p => p.id === mgm.fatherId) : null;
          const ggm4 = mgm.motherId ? people.find(p => p.id === mgm.motherId) : null;
          if (ggf4) greatGrandparents.push(ggf4.id);
          if (ggm4) greatGrandparents.push(ggm4.id);
        }
      }
    }
  }

  // Assign subtree roots
  const assignSubtreeRoot = (personId: string, currentRoot: string | undefined): void => {
    if (layout.colorScheme === 'by-grandparent' && grandparents.includes(personId)) {
      currentRoot = personId;
    } else if (layout.colorScheme === 'by-great-grandparent' && greatGrandparents.includes(personId)) {
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

  // Build tree and calculate subtree widths (bottom-up)
  const allNodes: TreeNode[] = [];

  const calculateSubtreeWidth = (person: Person): number => {
    // Not reachable / beyond maxGenerations
    if (!computedGenerations.has(person.id)) return 1;
    // Already placed — don't double-count shared ancestors
    if (nodeMap.has(person.id)) return 0;

    const father = person.fatherId ? people.find(p => p.id === person.fatherId) : null;
    const mother = person.motherId ? people.find(p => p.id === person.motherId) : null;

    if (!father && !mother) {
      return 1;
    }

    const fatherWidth = father ? calculateSubtreeWidth(father) : 0;
    const motherWidth = mother ? calculateSubtreeWidth(mother) : 0;

    return Math.max(fatherWidth + motherWidth, 1);
  };

      // Helper: get couple key (sorted IDs joined by _)
      const coupleKey = (id1: string, id2: string) => [id1, id2].sort().join('_');

      // Build nodes with positions
      // Generation is now taken from the BFS-precomputed map instead of the
      // recursion depth, so Ahnenschwund can never push an ancestor to a wrong row.
      const buildTree = (person: Person, leftOffset: number): number => {
        // Not reachable or beyond maxGenerations
        if (!computedGenerations.has(person.id)) return leftOffset;
        if (nodeMap.has(person.id)) return leftOffset;

        const generation = computedGenerations.get(person.id)!;

        let father = person.fatherId ? people.find(p => p.id === person.fatherId) : null;
        let mother = person.motherId ? people.find(p => p.id === person.motherId) : null;

        // Check swap: if this couple is in swappedCouples, swap left/right order
        if (father && mother) {
          const key = coupleKey(father.id, mother.id);
          if ((layout.swappedCouples || []).includes(key)) {
            [father, mother] = [mother, father];
          }
        }

        let currentOffset = leftOffset;

        const fatherWasAlreadyPlaced = father ? nodeMap.has(father.id) : false;
        const motherWasAlreadyPlaced = mother ? nodeMap.has(mother.id) : false;

        if (father && !fatherWasAlreadyPlaced) {
          currentOffset = buildTree(father, currentOffset);
        }

        if (mother && !motherWasAlreadyPlaced) {
          currentOffset = buildTree(mother, currentOffset);
        }

        const fatherNode = father ? nodeMap.get(father.id) : null;
        const motherNode = mother ? nodeMap.get(mother.id) : null;

        const scale = getGenScale(generation);
        const { width, height } = calculateBoxSize(person, scale);

        let nodeX: number;
        if (fatherWasAlreadyPlaced || motherWasAlreadyPlaced) {
          nodeX = leftOffset;
          currentOffset = leftOffset + 1;
        } else if (fatherNode && motherNode) {
          nodeX = (fatherNode.x + motherNode.x) / 2;
        } else if (fatherNode) {
          nodeX = fatherNode.x;
        } else if (motherNode) {
          nodeX = motherNode.x;
        } else {
          nodeX = leftOffset;
          currentOffset = leftOffset + 1;
        }

        const subtreeWidth = calculateSubtreeWidth(person);
        // Round box pixel sizes to avoid sub-pixel gaps and make layout
        // arithmetic deterministic in pixels.
        const rw = Math.max(1, Math.round(width));
        const rh = Math.max(1, Math.round(height));
        const node: TreeNode = {
          person,
          x: nodeX,
          y: generation,
          generation,
          width: rw,
          height: rh,
          subtreeRoot: subtreeRoots.get(person.id),
          subtreeWidth,
          scale,
          effectiveTextSize: layout.textSize * scale,
          effectivePadding: layout.personBoxPadding * scale,
        };

        allNodes.push(node);
        nodeMap.set(person.id, node);

        return currentOffset;
      };

  buildTree(rootPerson, 0);

  // Shift all nodes so the leftmost column starts at x = 0
  const minX = Math.min(...allNodes.map(n => n.x));
  allNodes.forEach(node => {
    node.x -= minX;
  });

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

    // ── Pixel-X layout ────────────────────────────────────────────────────────
    // Only LEAF x-positions (integer values) participate in the spacing sweep.
    // Intermediate/lower-generation nodes (fractional x) are positioned by
    // interpolating between their two surrounding leaf positions, so they never
    // push leaf columns apart.
    const uniqueXValues = [...new Set(allNodes.map(n => n.x))].sort((a, b) => a - b);

    // Integer x positions → leaf columns that drive horizontal spacing
    const leafXValues = uniqueXValues.filter(x => Number.isInteger(x));

    // Max rendered width per leaf slot
    const leafSlotWidths = new Map<number, number>();
    leafXValues.forEach(x => {
      const nodesAtX = allNodes.filter(n => n.x === x);
      leafSlotWidths.set(x, Math.max(1, ...nodesAtX.map(n => n.width)));
    });

    // Sweep: assign pixel centres for leaf columns only
    const leafSlotCenters = new Map<number, number>();
    leafXValues.forEach((x, i) => {
      const hw = (leafSlotWidths.get(x) ?? 0) / 2;
      if (i === 0) {
        leafSlotCenters.set(x, Math.round(layout.marginLeft + hw));
      } else {
        const prevX      = leafXValues[i - 1];
        const prevCenter = leafSlotCenters.get(prevX)!;
        const prevHW     = (leafSlotWidths.get(prevX) ?? 0) / 2;
        leafSlotCenters.set(x, Math.round(prevCenter + prevHW + layout.horizontalSpacing + hw));
      }
    });

    // Build full slot-centers map: leaves use their swept center,
    // non-leaves interpolate linearly between surrounding leaf columns.
    const slotCenters = new Map<number, number>();
    uniqueXValues.forEach(x => {
      if (Number.isInteger(x)) {
        slotCenters.set(x, leafSlotCenters.get(x) ?? Math.round(layout.marginLeft));
      } else {
        const lower = Math.floor(x);
        const upper = Math.ceil(x);
        const t = x - lower;
        const lc = leafSlotCenters.get(lower) ?? 0;
        const uc = leafSlotCenters.get(upper) ?? 0;
        slotCenters.set(x, Math.round(lc + t * (uc - lc)));
      }
    });

    const getPixelX = (x: number, nodeWidth: number) => {
      const center = slotCenters.get(x) ?? Math.round(layout.marginLeft + nodeWidth / 2);
      return Math.round(center - nodeWidth / 2);
    };

  

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

  // Canvas width: rightmost rendered node edge + right margin
  const canvasWidth = Math.ceil(
    Math.max(...allNodes.map(n => (slotCenters.get(n.x) ?? 0) + n.width / 2)) + layout.marginRight
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

    const rootId = node.subtreeRoot || 'root';

    if ((layout.colorScheme === 'by-grandparent' || layout.colorScheme === 'by-great-grandparent') && node.generation <= 2) {
      const targetRoots = layout.colorScheme === 'by-great-grandparent' ? greatGrandparents : grandparents;
      if (targetRoots.length > 0) {
        // DFS over all ancestors (father first for left-to-right priority) looking for the
        // first targetRoot.  This handles illegitimate children who have no father but whose
        // mother's line leads to a great-grandparent.
        const findTargetRoot = (personId: string, seen: Set<string>): number => {
          if (seen.has(personId)) return -1;
          seen.add(personId);
          const p = people.find(q => q.id === personId);
          if (!p) return -1;
          for (const parentId of [p.fatherId, p.motherId]) {
            if (!parentId) continue;
            const idx = targetRoots.indexOf(parentId);
            if (idx !== -1) return idx;
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

    const colorRoots = layout.colorScheme === 'by-grandparent' ? grandparents : greatGrandparents;
    const index = colorRoots.indexOf(rootId);
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
        const fatherCenterX = getPixelX(fatherNode.x, fatherNode.width) + fatherNode.width / 2;
        const motherCenterX = getPixelX(motherNode.x, motherNode.width) + motherNode.width / 2;
        const parentsMidX   = (fatherCenterX + motherCenterX) / 2;
        const parentBottomY = Math.max(
          getNodePixelY(fatherNode) + fatherNode.height,
          getNodePixelY(motherNode) + motherNode.height,
        );
        const dropY       = parentBottomY + DROP_DIST;
        void dropY; // only parentBottomY is used for grouping
        const childXs     = children.map(c => getPixelX(c.x, c.width) + c.width / 2);
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
    const fatherCenterX = getPixelX(fatherNode.x, fatherNode.width) + fatherNode.width / 2;
    const motherCenterX = getPixelX(motherNode.x, motherNode.width) + motherNode.width / 2;
    const fatherBottomY = getNodePixelY(fatherNode) + fatherNode.height;
    const motherBottomY = getNodePixelY(motherNode) + motherNode.height;
    const parentBottomY = Math.max(fatherBottomY, motherBottomY);
    const parentsMidX = (fatherCenterX + motherCenterX) / 2;
    const dropDistance = 15;
    const dropY = parentBottomY + dropDistance;
    const isMultiChild = children.length > 1;

    // Sort children left→right (needed for spine)
    const sortedChildren = isMultiChild
      ? [...children].sort((a, b) => (getPixelX(a.x, a.width) + a.width / 2) - (getPixelX(b.x, b.width) + b.width / 2))
      : children;
    const childXs = sortedChildren.map(c => getPixelX(c.x, c.width) + c.width / 2);
    // Spine range covers all children AND both parent drop points
    const _spineLeft  = isMultiChild ? Math.min(Math.min(...childXs), Math.min(fatherCenterX, motherCenterX)) : parentsMidX; void _spineLeft;
    const _spineRight = isMultiChild ? Math.max(Math.max(...childXs), Math.max(fatherCenterX, motherCenterX)) : parentsMidX; void _spineRight;

    // Line color for this couple: derived from the leftmost child's subtree (or borderColor if uniform)
    const coupleLineColor = getLineColor(sortedChildren[0]);

    // ── Parent bar (drawn once per couple) ─────────────────────────────────
    if (layout.lineStyle === 'rounded') {
      // Rounded: each parent drops with a curved corner into its half of the bar.
      // Father path: down → rounded corner → across to parentsMidX (left half of bar)
      const fPts: Array<[number, number]> = [[fatherCenterX, fatherBottomY], [fatherCenterX, dropY], [parentsMidX, dropY]];
      lines.push(<path key={`fd-${ck}`} d={buildRoundedPath(fPts, cornerR)} stroke={coupleLineColor} strokeWidth={layout.lineWidth} fill="none"/>);
      addLineLength(fatherCenterX, fatherBottomY, fatherCenterX, dropY);
      addLineLength(fatherCenterX, dropY, parentsMidX, dropY);
      // Mother path: down → rounded corner → across to parentsMidX (right half of bar)
      const mPts: Array<[number, number]> = [[motherCenterX, motherBottomY], [motherCenterX, dropY], [parentsMidX, dropY]];
      lines.push(<path key={`md-${ck}`} d={buildRoundedPath(mPts, cornerR)} stroke={coupleLineColor} strokeWidth={layout.lineWidth} fill="none"/>);
      addLineLength(motherCenterX, motherBottomY, motherCenterX, dropY);
      addLineLength(motherCenterX, dropY, parentsMidX, dropY);
    } else {
      // Straight: individual line segments
      lines.push(<line key={`fd-${ck}`} x1={fatherCenterX} y1={fatherBottomY} x2={fatherCenterX} y2={dropY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
      addLineLength(fatherCenterX, fatherBottomY, fatherCenterX, dropY);
      lines.push(<line key={`md-${ck}`} x1={motherCenterX} y1={motherBottomY} x2={motherCenterX} y2={dropY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
      addLineLength(motherCenterX, motherBottomY, motherCenterX, dropY);
      if (!isMultiChild) {
        // Single child (straight): f-to-m horizontal at dropY; spine handles it for multi-child
        lines.push(<line key={`ph-${ck}`} x1={fatherCenterX} y1={dropY} x2={motherCenterX} y2={dropY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
        addLineLength(fatherCenterX, dropY, motherCenterX, dropY);
      }
    }

    // ── Marriage info label ───────────────────────────────────────────────
    if (layout.showMarriageInfo && (fatherNode.person.marriageDate || fatherNode.person.marriagePlace)) {
      const labelX = parentsMidX;
      const labelY = parentBottomY + layout.textSize + 2;
      let marriageText = '⚭';
      if (fatherNode.person.marriageDate) marriageText += ' ' + formatDate(fatherNode.person.marriageDate, layout.dateFormat);
      if (fatherNode.person.marriagePlace) marriageText += ' in ' + fatherNode.person.marriagePlace;
      marriageLabels.push(
        <text key={`marriage-${ck}`} x={labelX} y={labelY} textAnchor="middle" fontSize={layout.textSize - 3} fill="#666" style={{ userSelect: 'none' }}>
          {marriageText}
        </text>
      );
    }

    // ── Swap button ───────────────────────────────────────────────────────
    if (onCoupleSwap) {
      const isSwapped = (layout.swappedCouples || []).includes(ck);
      const btnX = (getPixelX(fatherNode.x, fatherNode.width) + fatherNode.width + getPixelX(motherNode.x, motherNode.width)) / 2;
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
      const childCenterX = getPixelX(child.x, child.width) + child.width / 2;
      const childTopY = getNodePixelY(child);
      const maxParentGen = Math.max(fatherNode.generation, motherNode.generation);
      const genGap = maxParentGen - child.generation;
      const standardMidY = (childTopY + parentBottomY) / 2;
      const midY = genGap > 1 ? dropY + 5 : standardMidY;

      if (layout.lineStyle === 'rounded') {
        if (Math.abs(childCenterX - parentsMidX) < 1) {
          // Vertically aligned: straight drop, no corners
          lines.push(<line key={`cv-${child.person.id}`} x1={parentsMidX} y1={dropY} x2={childCenterX} y2={childTopY} stroke={coupleLineColor} strokeWidth={layout.lineWidth}/>);
          addLineLength(parentsMidX, dropY, childCenterX, childTopY);
        } else {
          // Stem down → rounded corner → across → rounded corner → up to child
          const pts: Array<[number, number]> = [
            [parentsMidX, dropY],
            [parentsMidX, midY],
            [childCenterX, midY],
            [childCenterX, childTopY],
          ];
          lines.push(<path key={`child-line-${child.person.id}`} d={buildRoundedPath(pts, cornerR)} stroke={coupleLineColor} strokeWidth={layout.lineWidth} fill="none"/>);
          addLineLength(parentsMidX, dropY, parentsMidX, midY);
          addLineLength(parentsMidX, midY, childCenterX, midY);
          addLineLength(childCenterX, midY, childCenterX, childTopY);
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

      if (layout.lineStyle !== 'rounded') {
        // Straight: explicit parent bar at dropY (for rounded it is covered by the fd/md half-paths)
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
        const childCenterX = getPixelX(child.x, child.width) + child.width / 2;
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

    const childCenterX = getPixelX(node.x, node.width) + node.width / 2;
    const childTopY = getNodePixelY(node);

    const parentCenterX = getPixelX(parent.x, parent.width) + parent.width / 2;
    const parentBottomY = getNodePixelY(parent) + parent.height;

      if (layout.lineStyle === 'rounded') {
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
        x: getPixelX(node.x, node.width),
        y: getNodePixelY(node),
        width: node.width,
        height: node.height,
        color: getPersonBoxColor(node),
      }));
      Promise.resolve().then(() => onNodesLayout(pixelNodes));
    }

  return (
    <div className="p-8 min-h-full">
      <svg
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
          const x = getPixelX(node.x, node.width);
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
                      b. {formatDate(node.person.birthDate, layout.dateFormat)}
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
                      d. {formatDate(node.person.deathDate, layout.dateFormat)}
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
                }

                return elements;
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
