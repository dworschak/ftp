import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import type { LayoutSettings as LayoutSettingsType, BackgroundSkin, ColorScheme, DateFormat, LineStyle } from '../types';

interface LayoutSettingsProps {
  layout: LayoutSettingsType;
  onUpdate: (layout: LayoutSettingsType) => void;
}

const backgroundSkins: { value: BackgroundSkin; label: string; color: string }[] = [
  { value: 'white', label: 'White', color: '#FFFFFF' },
  { value: 'cream', label: 'Cream', color: '#FFFEF0' },
  { value: 'light-blue', label: 'Light Blue', color: '#EFF6FF' },
  { value: 'light-green', label: 'Light Green', color: '#F0FDF4' },
];

const colorSchemes: { value: ColorScheme; label: string; description: string }[] = [
  { value: 'uniform', label: 'Uniform', description: 'All boxes the same color' },
  { value: 'by-grandparent', label: 'By Grandparent', description: 'One color per grandparent subtree' },
  { value: 'by-great-grandparent', label: 'By Great-Grandparent', description: 'One color per great-grandparent subtree' },
  { value: 'by-parish', label: 'By Parish', description: 'Color by birth parish (last part of birth place)' },
];

/** Reusable labeled checkbox row */
function CheckRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

/** Reusable labeled range slider row */
function SliderRow({
  id, label, min, max, step = 1, value, onChange, hint,
}: {
  id: string; label: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm mb-1">
        {label}: <span className="font-medium">{value}px</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
      />
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export function LayoutSettings({ layout, onUpdate }: LayoutSettingsProps) {
  const set = (key: keyof LayoutSettingsType, value: number | boolean | string | null) =>
    onUpdate({ ...layout, [key]: value });

  return (
    <Accordion type="multiple" defaultValue={['scope', 'content', 'appearance']} className="w-full">

      {/* ── 1. Scope ─────────────────────────────────────────── */}
      <AccordionItem value="scope">
        <AccordionTrigger className="text-sm font-semibold">Scope</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <div>
            <label htmlFor="generations" className="block text-sm mb-1">
              Max Generations
            </label>
            <select
              id="generations"
              value={layout.maxGenerations === null ? 'all' : layout.maxGenerations.toString()}
              onChange={(e) => {
                const v = e.target.value;
                set('maxGenerations', v === 'all' ? null : parseInt(v));
              }}
              className="w-full px-3 py-2 text-sm bg-input-background border border-border rounded"
            >
              <option value="all">All generations</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(n => (
                <option key={n} value={n.toString()}>
                  {n} {n === 1 ? 'generation' : 'generations'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <CheckRow
              checked={layout.showSiblingsGen0}
              onChange={(v) => set('showSiblingsGen0', v)}
              label="Show root person's siblings"
            />
            <CheckRow
              checked={layout.showSiblingsGen1}
              onChange={(v) => set('showSiblingsGen1', v)}
              label="Show parents' siblings"
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 2. Content ───────────────────────────────────────── */}
      <AccordionItem value="content">
        <AccordionTrigger className="text-sm font-semibold">Content</AccordionTrigger>
        <AccordionContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Birth &amp; Death</p>
            <CheckRow checked={layout.showBirthDate}  onChange={(v) => set('showBirthDate', v)}  label="Birth date" />
            <CheckRow checked={layout.showBirthPlace} onChange={(v) => set('showBirthPlace', v)} label="Birth place" />
            <CheckRow checked={layout.showDeathDate}  onChange={(v) => set('showDeathDate', v)}  label="Death date" />
            <CheckRow checked={layout.showDeathPlace} onChange={(v) => set('showDeathPlace', v)} label="Death place" />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Other</p>
            <CheckRow
              checked={layout.showMarriageInfo}
              onChange={(v) => set('showMarriageInfo', v)}
              label="Marriage info on connecting lines"
            />
            <CheckRow
              checked={layout.showGenderSymbol ?? false}
              onChange={(v) => set('showGenderSymbol', v)}
              label="Gender symbol (♂/♀) on person tiles"
            />
          </div>

          <div>
            <label htmlFor="dateFormat" className="block text-sm mb-1">Date Format</label>
            <select
              id="dateFormat"
              value={layout.dateFormat}
              onChange={(e) => set('dateFormat', e.target.value as DateFormat)}
              className="w-full px-3 py-2 text-sm bg-input-background border border-border rounded"
            >
              <option value="DD.MM.YYYY">DD.MM.YYYY — 22.06.1975</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY — 06/22/1975</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD — 1975-06-22</option>
              <option value="DD MMM YYYY">DD MMM YYYY — 22 Jun 1975</option>
            </select>
          </div>

          <SliderRow
            id="textSize"
            label="Text size"
            min={8} max={20}
            value={layout.textSize}
            onChange={(v) => set('textSize', v)}
          />
        </AccordionContent>
      </AccordionItem>

      {/* ── 3. Appearance ────────────────────────────────────── */}
      <AccordionItem value="appearance">
        <AccordionTrigger className="text-sm font-semibold">Appearance</AccordionTrigger>
        <AccordionContent className="space-y-4">
          {/* Background */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Background</p>
            <div className="grid grid-cols-2 gap-2">
              {backgroundSkins.map((skin) => (
                <button
                  key={skin.value}
                  onClick={() => set('backgroundSkin', skin.value)}
                  className={`px-3 py-2 rounded border-2 transition-colors text-sm ${
                    layout.backgroundSkin === skin.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-foreground/20'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-border flex-shrink-0" style={{ backgroundColor: skin.color }} />
                    {skin.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Color scheme */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Color Scheme</p>
            <div className="space-y-1.5">
              {colorSchemes.map((scheme) => (
                <label
                  key={scheme.value}
                  className={`flex items-start gap-3 p-2.5 rounded border-2 cursor-pointer transition-colors ${
                    layout.colorScheme === scheme.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-foreground/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="colorScheme"
                    value={scheme.value}
                    checked={layout.colorScheme === scheme.value}
                    onChange={(e) => set('colorScheme', e.target.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{scheme.label}</div>
                    <div className="text-xs text-muted-foreground leading-tight">{scheme.description}</div>
                  </div>
                </label>
              ))}
            </div>
            {layout.colorScheme !== 'uniform' && (
              <CheckRow
                checked={layout.showLegend ?? true}
                onChange={(v) => set('showLegend', v)}
                label="Show legend"
              />
            )}
          </div>

          {/* Lines */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Connecting Lines</p>
            <div className="space-y-2">
              <div>
                <label htmlFor="lineStyle" className="block text-sm mb-1">Line Style</label>
                <select
                  id="lineStyle"
                  value={layout.lineStyle}
                  onChange={(e) => set('lineStyle', e.target.value as LineStyle)}
                  className="w-full px-3 py-2 text-sm bg-input-background border border-border rounded"
                >
                  <option value="rounded">Rounded corners</option>
                  <option value="straight">Straight lines</option>
                </select>
              </div>
              <CheckRow
                checked={layout.colorLines}
                onChange={(v) => set('colorLines', v)}
                label="Color lines by subtree"
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── 4. Layout & Spacing ──────────────────────────────── */}
      <AccordionItem value="layout">
        <AccordionTrigger className="text-sm font-semibold">Layout &amp; Spacing</AccordionTrigger>
        <AccordionContent className="space-y-4">
          {/* Spacing */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Spacing</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="hSpacing" className="block text-sm mb-1">
                  Horizontal: {layout.horizontalSpacing}px
                </label>
                <input
                  id="hSpacing"
                  type="range"
                  min="1" max="100"
                  value={layout.horizontalSpacing}
                  onChange={(e) => set('horizontalSpacing', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="vSpacing" className="block text-sm mb-1">
                  Vertical: {layout.verticalSpacing}px
                </label>
                <input
                  id="vSpacing"
                  type="range"
                  min="30" max="120"
                  value={layout.verticalSpacing}
                  onChange={(e) => set('verticalSpacing', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Box dimensions */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Person Box</p>
            <div className="space-y-3">
              <SliderRow
                id="minBoxWidth"
                label="Min width"
                min={0} max={150} step={5}
                value={layout.minBoxWidth}
                onChange={(v) => set('minBoxWidth', v)}
                hint="0 = content width only"
              />
              <SliderRow
                id="boxPadding"
                label="Padding"
                min={0} max={24}
                value={layout.personBoxPadding}
                onChange={(v) => set('personBoxPadding', v)}
              />
            </div>
          </div>

          {/* Birth year spread */}
          <SliderRow
            id="birthYearSpread"
            label="Birth year spread"
            min={0} max={200} step={5}
            value={layout.birthYearSpread}
            onChange={(v) => set('birthYearSpread', v)}
            hint="Offset nodes vertically by birth year within each generation row (0 = off)"
          />

          {/* Margins */}
          <SliderRow
            id="margin"
            label="Page margin"
            min={0} max={50}
            value={layout.marginTop}
            onChange={(v) => onUpdate({ ...layout, marginTop: v, marginRight: v, marginBottom: v, marginLeft: v })}
            hint="Applied to all sides"
          />

          {/* Borders */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Borders</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="borderWidth" className="block text-sm mb-1">Box border</label>
                <input
                  id="borderWidth"
                  type="number"
                  min="0" max="5"
                  value={layout.borderWidth}
                  onChange={(e) => set('borderWidth', parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
                />
              </div>
              <div>
                <label htmlFor="lineWidth" className="block text-sm mb-1">Line width</label>
                <input
                  id="lineWidth"
                  type="number"
                  min="0" max="5"
                  value={layout.lineWidth}
                  onChange={(e) => set('lineWidth', parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="borderColor" className="block text-sm mb-1">Border &amp; line color</label>
                <input
                  id="borderColor"
                  type="color"
                  value={layout.borderColor}
                  onChange={(e) => set('borderColor', e.target.value)}
                  className="w-full h-[34px] bg-input-background border border-border rounded"
                />
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

    </Accordion>
  );
}
