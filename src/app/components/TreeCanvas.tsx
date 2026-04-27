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
  '#FFEBEE', // Light red
  '#E3F2FD', // Light blue
  '#F1F8E9', // Light green
  '#FFF3E0', // Light orange
  '#F3E5F5', // Light purple
  '#E0F2F1', // Light teal
  '#FFF9C4', // Light yellow
  '#FCE4EC', // Light pink
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

    return { width: Math.max(width, 120 * scale), height: Math.max(height, 60 * scale) };
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

  const maxGeneration = Math.max(...allNodes.map(n => n.generation));

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

  

  // Pre-compute pixel Y for each generation to avoid O(n) lookups
  const genPixelYs = new Map<number, number>();
  {
    let y = layout.marginTop;
    for (let g = maxGeneration; g >= 0; g--) {
      genPixelYs.set(g, Math.round(y));
      if (g > 0) y += (genHeights.get(g) || 80) + layout.verticalSpacing;
    }
  }
  const getPixelYCached = (generation: number) => genPixelYs.get(generation) ?? Math.round(layout.marginTop);

  // Canvas width: rightmost rendered node edge + right margin
  const canvasWidth = Math.ceil(
    Math.max(...allNodes.map(n => (slotCenters.get(n.x) ?? 0) + n.width / 2)) + layout.marginRight
  );

  let canvasHeight = layout.marginTop + layout.marginBottom;
  genHeights.forEach(height => {
    canvasHeight += height;
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
        let cur: Person | undefined = node.person;
        while (cur && cur.fatherId) {
          const father = people.find(p => p.id === cur!.fatherId);
          if (!father) break;
          const idx = targetRoots.indexOf(father.id);
          if (idx !== -1) {
            return subtreeColors[idx % subtreeColors.length];
          }
          cur = father;
        }
      }
      // Fall through to normal behaviour if no paternal ancestor match.
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

    // Generate connection lines and marriage labels
    const lines: ReactElement[] = [];
    const marriageLabels: ReactElement[] = [];
    let totalLineLength = 0;

    // Helper to accumulate line segment length
    const addLineLength = (x1: number, y1: number, x2: number, y2: number) => {
    totalLineLength += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    };

    allNodes.forEach(node => {
    // For line rendering, always use original fatherId/motherId for node lookup
    const fatherNode = node.person.fatherId ? nodeMap.get(node.person.fatherId) : null;
    const motherNode = node.person.motherId ? nodeMap.get(node.person.motherId) : null;

    const childCenterX = getPixelX(node.x, node.width) + node.width / 2;
    const childTopY = getPixelYCached(node.generation);

    if (fatherNode && motherNode) {
      const fatherCenterX = getPixelX(fatherNode.x, fatherNode.width) + fatherNode.width / 2;
      const motherCenterX = getPixelX(motherNode.x, motherNode.width) + motherNode.width / 2;
      const fatherBottomY = getPixelYCached(fatherNode.generation) + fatherNode.height;
      const motherBottomY = getPixelYCached(motherNode.generation) + motherNode.height;
      const parentBottomY = Math.max(fatherBottomY, motherBottomY);
      const parentsMidX = (fatherCenterX + motherCenterX) / 2;

      const maxParentGen = Math.max(fatherNode.generation, motherNode.generation);
      const genGap = maxParentGen - node.generation;
      const dropDistance = 15;
      const standardMidY = (childTopY + parentBottomY) / 2;
      const midY = genGap > 1 ? parentBottomY + dropDistance + 5 : standardMidY;

      if (layout.lineStyle === 'rounded') {
        const cornerRadius = 10;

        const path1 = `M ${fatherCenterX} ${fatherBottomY} L ${fatherCenterX} ${parentBottomY} L ${motherCenterX} ${parentBottomY} L ${motherCenterX} ${motherBottomY}`;
        // Approximate length: vertical father drop + horizontal span + vertical mother drop
        addLineLength(fatherCenterX, fatherBottomY, fatherCenterX, parentBottomY);
        addLineLength(fatherCenterX, parentBottomY, motherCenterX, parentBottomY);
        addLineLength(motherCenterX, parentBottomY, motherCenterX, motherBottomY);

        const horizontalDist = Math.abs(childCenterX - parentsMidX);
        const useRounded = horizontalDist > cornerRadius * 2;

        let path2;
        if (useRounded && childCenterX > parentsMidX) {
          path2 = `M ${parentsMidX} ${parentBottomY} L ${parentsMidX} ${midY} Q ${parentsMidX} ${midY - cornerRadius}, ${parentsMidX + cornerRadius} ${midY - cornerRadius} L ${childCenterX - cornerRadius} ${midY - cornerRadius} Q ${childCenterX} ${midY - cornerRadius}, ${childCenterX} ${midY} L ${childCenterX} ${childTopY}`;
        } else if (useRounded && childCenterX < parentsMidX) {
          path2 = `M ${parentsMidX} ${parentBottomY} L ${parentsMidX} ${midY} Q ${parentsMidX} ${midY - cornerRadius}, ${parentsMidX - cornerRadius} ${midY - cornerRadius} L ${childCenterX + cornerRadius} ${midY - cornerRadius} Q ${childCenterX} ${midY - cornerRadius}, ${childCenterX} ${midY} L ${childCenterX} ${childTopY}`;
        } else {
          path2 = `M ${parentsMidX} ${parentBottomY} L ${parentsMidX} ${midY} L ${childCenterX} ${midY} L ${childCenterX} ${childTopY}`;
        }
        // Approximate path2 length
        addLineLength(parentsMidX, parentBottomY, parentsMidX, midY);
        addLineLength(parentsMidX, midY, childCenterX, midY);
        addLineLength(childCenterX, midY, childCenterX, childTopY);

        lines.push(
          <path
            key={`parents-line-${node.person.id}`}
            d={path1}
            stroke={layout.borderColor}
            strokeWidth={layout.lineWidth}
            fill="none"
          />
        );

        lines.push(
          <path
            key={`child-line-${node.person.id}`}
            d={path2}
            stroke={layout.borderColor}
            strokeWidth={layout.lineWidth}
            fill="none"
          />
        );
       } else {
        // Straight line style
        // dropY is below the taller parent – both vertical lines extend all the way to dropY
        // so there is no gap when parents have different heights.
        const dropY = Math.max(fatherBottomY, motherBottomY) + dropDistance;

        lines.push(
          <line
            key={`father-down-${node.person.id}`}
            x1={fatherCenterX} y1={fatherBottomY}
            x2={fatherCenterX} y2={dropY}
            stroke={layout.borderColor} strokeWidth={layout.lineWidth}
          />
        );
        addLineLength(fatherCenterX, fatherBottomY, fatherCenterX, dropY);

        lines.push(
          <line
            key={`mother-down-${node.person.id}`}
            x1={motherCenterX} y1={motherBottomY}
            x2={motherCenterX} y2={dropY}
            stroke={layout.borderColor} strokeWidth={layout.lineWidth}
          />
        );
        addLineLength(motherCenterX, motherBottomY, motherCenterX, dropY);

        lines.push(
          <line
            key={`parents-${node.person.id}`}
            x1={fatherCenterX} y1={dropY}
            x2={motherCenterX} y2={dropY}
            stroke={layout.borderColor} strokeWidth={layout.lineWidth}
          />
        );
        addLineLength(fatherCenterX, dropY, motherCenterX, dropY);

        lines.push(
          <line
            key={`parents-mid-${node.person.id}`}
            x1={parentsMidX} y1={dropY}
            x2={parentsMidX} y2={midY}
            stroke={layout.borderColor} strokeWidth={layout.lineWidth}
          />
        );
        addLineLength(parentsMidX, dropY, parentsMidX, midY);

        if (Math.abs(childCenterX - parentsMidX) > 1) {
          lines.push(
            <line
              key={`child-h-${node.person.id}`}
              x1={parentsMidX} y1={midY}
              x2={childCenterX} y2={midY}
              stroke={layout.borderColor} strokeWidth={layout.lineWidth}
            />
          );
          addLineLength(parentsMidX, midY, childCenterX, midY);
        }

        lines.push(
          <line
            key={`child-v-${node.person.id}`}
            x1={childCenterX} y1={midY}
            x2={childCenterX} y2={childTopY}
            stroke={layout.borderColor} strokeWidth={layout.lineWidth}
          />
        );
        addLineLength(childCenterX, midY, childCenterX, childTopY);
      }

      // Marriage info label + swap button
      if (layout.showMarriageInfo && (fatherNode.person.marriageDate || fatherNode.person.marriagePlace)) {
        const labelX = (fatherCenterX + motherCenterX) / 2;
        const fatherBottomYLabel = getPixelYCached(fatherNode.generation) + fatherNode.height;
        const motherBottomYLabel = getPixelYCached(motherNode.generation) + motherNode.height;
        const parentBottomYLabel = Math.max(fatherBottomYLabel, motherBottomYLabel);
        const labelY = parentBottomYLabel + layout.textSize + 2;

        let marriageText = 'oo';
        if (fatherNode.person.marriageDate) {
          marriageText += ' ' + formatDate(fatherNode.person.marriageDate, layout.dateFormat);
        }
        if (fatherNode.person.marriagePlace) {
          marriageText += ' in ' + fatherNode.person.marriagePlace;
        }

        marriageLabels.push(
          <text
            key={`marriage-${node.person.id}`}
            x={labelX}
            y={labelY}
            textAnchor="middle"
            fontSize={layout.textSize - 3}
            fill="#666"
            style={{ userSelect: 'none' }}
          >
            {marriageText}
          </text>
        );
      }

      // Swap button (always shown for couples)
      if (onCoupleSwap) {
        const key = coupleKey(node.person.fatherId!, node.person.motherId!);
        const fatherBottomYBtn = getPixelYCached(fatherNode.generation) + fatherNode.height;
        const motherBottomYBtn = getPixelYCached(motherNode.generation) + motherNode.height;
        const parentBottomYBtn = Math.max(fatherBottomYBtn, motherBottomYBtn);
        const btnX = (getPixelX(fatherNode.x, fatherNode.width) + fatherNode.width + getPixelX(motherNode.x, motherNode.width)) / 2;
        const btnY = parentBottomYBtn - fatherNode.height / 2;
        const isSwapped = (layout.swappedCouples || []).includes(key);

        marriageLabels.push(
          <g
            key={`swap-btn-${node.person.id}`}
            onClick={(e) => { e.stopPropagation(); onCoupleSwap(key); }}
            style={{ cursor: 'pointer' }}
          >
            <title>Mann/Frau tauschen</title>
            <rect
              x={btnX - 10}
              y={btnY - 9}
              width={20}
              height={18}
              rx={4}
              fill={isSwapped ? '#3b82f6' : '#e5e7eb'}
              stroke={isSwapped ? '#2563eb' : '#9ca3af'}
              strokeWidth={1}
            />
            <text
              x={btnX}
              y={btnY + 5}
              textAnchor="middle"
              fontSize={12}
              fill={isSwapped ? 'white' : '#374151'}
              style={{ userSelect: 'none', fontFamily: 'monospace' }}
            >
              ⇄
            </text>
          </g>
        );
      }
    } else if (fatherNode || motherNode) {
      const parent = fatherNode || motherNode!;
      const parentCenterX = getPixelX(parent.x, parent.width) + parent.width / 2;
      const parentBottomY = getPixelYCached(parent.generation) + parent.height;

      if (layout.lineStyle === 'rounded') {
        const cornerRadius = 10;
        const horizontalDist = Math.abs(childCenterX - parentCenterX);
        const verticalDist = childTopY - parentBottomY;
        const useRounded = horizontalDist > cornerRadius * 2 && verticalDist > cornerRadius * 2;

        let path;
        if (useRounded && childCenterX > parentCenterX) {
          const midY = (childTopY + parentBottomY) / 2;
          path = `M ${parentCenterX} ${parentBottomY} L ${parentCenterX} ${midY - cornerRadius} Q ${parentCenterX} ${midY}, ${parentCenterX + cornerRadius} ${midY} L ${childCenterX - cornerRadius} ${midY} Q ${childCenterX} ${midY}, ${childCenterX} ${midY + cornerRadius} L ${childCenterX} ${childTopY}`;
        } else if (useRounded && childCenterX < parentCenterX) {
          const midY = (childTopY + parentBottomY) / 2;
          path = `M ${parentCenterX} ${parentBottomY} L ${parentCenterX} ${midY - cornerRadius} Q ${parentCenterX} ${midY}, ${parentCenterX - cornerRadius} ${midY} L ${childCenterX + cornerRadius} ${midY} Q ${childCenterX} ${midY}, ${childCenterX} ${midY + cornerRadius} L ${childCenterX} ${childTopY}`;
        } else {
          path = `M ${parentCenterX} ${parentBottomY} L ${childCenterX} ${childTopY}`;
        }
        addLineLength(parentCenterX, parentBottomY, childCenterX, childTopY);

        lines.push(
          <path
            key={`single-parent-${node.person.id}`}
            d={path}
            stroke={layout.borderColor}
            strokeWidth={layout.lineWidth}
            fill="none"
          />
        );
      } else {
        lines.push(
          <line
            key={`single-parent-${node.person.id}`}
            x1={parentCenterX} y1={parentBottomY}
            x2={childCenterX} y2={childTopY}
            stroke={layout.borderColor} strokeWidth={layout.lineWidth}
          />
        );
        addLineLength(parentCenterX, parentBottomY, childCenterX, childTopY);
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
        y: getPixelYCached(node.generation),
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
          const y = getPixelYCached(node.generation);
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
