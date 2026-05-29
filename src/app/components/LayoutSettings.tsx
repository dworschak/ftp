import { LayoutSettings as LayoutSettingsType, BackgroundSkin, ColorScheme, DateFormat, LineStyle } from '../types';

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
  { value: 'uniform', label: 'Uniform', description: 'All boxes same color' },
  { value: 'by-grandparent', label: 'By Grandparent', description: 'One color per grandparent subtree' },
  { value: 'by-great-grandparent', label: 'By Great-Grandparent', description: 'One color per great-grandparent subtree' },
  { value: 'by-parish', label: 'By Parish', description: 'Color by birth parish (last part of birth place)' },
];

export function LayoutSettings({ layout, onUpdate }: LayoutSettingsProps) {
  const handleChange = (key: keyof LayoutSettingsType, value: number | boolean | string | null) => {
    onUpdate({ ...layout, [key]: value });
  };

  const handleMaxGenerationsChange = (value: string) => {
    if (value === 'all') {
      handleChange('maxGenerations', null);
    } else {
      handleChange('maxGenerations', parseInt(value));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="generations" className="block text-sm mb-2">
          Maximum Generations: {layout.maxGenerations === null ? 'All' : layout.maxGenerations}
        </label>
        <select
          id="generations"
          value={layout.maxGenerations === null ? 'all' : layout.maxGenerations.toString()}
          onChange={(e) => handleMaxGenerationsChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-input-background border border-border rounded"
        >
          <option value="all">Show All Generations</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20].map(num => (
            <option key={num} value={num.toString()}>
              {num} {num === 1 ? 'Generation' : 'Generations'}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Default is to show all available generations
        </p>
      </div>

      <div>
        <h4 className="mb-3">Background Skin</h4>
        <div className="grid grid-cols-2 gap-2">
          {backgroundSkins.map((skin) => (
            <button
              key={skin.value}
              onClick={() => handleChange('backgroundSkin', skin.value)}
              className={`px-3 py-2 rounded border-2 transition-colors text-sm ${
                layout.backgroundSkin === skin.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-foreground/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: skin.color }}
                />
                {skin.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-3">Color Scheme</h4>
        <div className="space-y-2">
          {colorSchemes.map((scheme) => (
            <label
              key={scheme.value}
              className={`flex items-start gap-3 p-3 rounded border-2 cursor-pointer transition-colors ${
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
                onChange={(e) => handleChange('colorScheme', e.target.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">{scheme.label}</div>
                <div className="text-xs text-muted-foreground">{scheme.description}</div>
              </div>
            </label>
          ))}
        </div>
        {layout.colorScheme !== 'uniform' && (
          <label className="flex items-center gap-2 mt-3">
            <input
              type="checkbox"
              checked={layout.showLegend ?? true}
              onChange={(e) => handleChange('showLegend', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show legend</span>
          </label>
        )}
      </div>

      <div>
        <h4 className="mb-3">Display Options</h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showBirthDate}
              onChange={(e) => handleChange('showBirthDate', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show birth dates</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showBirthPlace}
              onChange={(e) => handleChange('showBirthPlace', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show birth places</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showDeathDate}
              onChange={(e) => handleChange('showDeathDate', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show death dates</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showDeathPlace}
              onChange={(e) => handleChange('showDeathPlace', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show death places</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showMarriageInfo}
              onChange={(e) => handleChange('showMarriageInfo', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show marriage info on lines</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.colorLines}
              onChange={(e) => handleChange('colorLines', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Linien in Teilbaum-Farbe</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showSiblingsGen0}
              onChange={(e) => handleChange('showSiblingsGen0', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show siblings of root person (Gen 0)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showSiblingsGen1}
              onChange={(e) => handleChange('showSiblingsGen1', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show siblings of root's parents (Gen 1)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={layout.showGenderSymbol ?? false}
              onChange={(e) => handleChange('showGenderSymbol', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Show gender symbol (♂/♀) on person tiles</span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="dateFormat" className="block text-sm mb-2">
          Date Format
        </label>
        <select
          id="dateFormat"
          value={layout.dateFormat}
          onChange={(e) => handleChange('dateFormat', e.target.value as DateFormat)}
          className="w-full px-3 py-2 text-sm bg-input-background border border-border rounded"
        >
          <option value="DD.MM.YYYY">DD.MM.YYYY (22.06.1975)</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY (06/22/1975)</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD (1975-06-22)</option>
          <option value="DD MMM YYYY">DD MMM YYYY (22 Jun 1975)</option>
        </select>
      </div>

      <div>
        <label htmlFor="lineStyle" className="block text-sm mb-2">
          Connecting Line Style
        </label>
        <select
          id="lineStyle"
          value={layout.lineStyle}
          onChange={(e) => handleChange('lineStyle', e.target.value as LineStyle)}
          className="w-full px-3 py-2 text-sm bg-input-background border border-border rounded"
        >
          <option value="rounded">Rounded Corners</option>
          <option value="straight">Straight Lines</option>
        </select>
      </div>

      <div>
        <label htmlFor="textSize" className="block text-sm mb-2">
          Text Size: {layout.textSize}px
        </label>
        <input
          id="textSize"
          type="range"
          min="8"
          max="20"
          value={layout.textSize}
          onChange={(e) => handleChange('textSize', parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label htmlFor="birthYearSpread" className="block text-sm mb-2">
          Geburtsjahr-Streuung: {layout.birthYearSpread}px
        </label>
        <input
          id="birthYearSpread"
          type="range"
          min="0"
          max="200"
          step="5"
          value={layout.birthYearSpread}
          onChange={(e) => handleChange('birthYearSpread', parseInt(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Früher Geborene weiter oben, später Geborene weiter unten (0 = aus)
        </p>
      </div>

       <div>
         <label htmlFor="minBoxWidth" className="block text-sm mb-2">
           Minimum Person Box Width: {layout.minBoxWidth}px
         </label>
         <input
           id="minBoxWidth"
           type="range"
           min="0"
           max="150"
           step="5"
           value={layout.minBoxWidth}
           onChange={(e) => handleChange('minBoxWidth', parseInt(e.target.value))}
           className="w-full"
         />
         <p className="text-xs text-muted-foreground mt-1">
           0 = content width only, smaller values = more compact boxes
         </p>
       </div>

      <div>
        <label htmlFor="boxPadding" className="block text-sm mb-2">
          Box Padding: {layout.personBoxPadding}px
        </label>
        <input
          id="boxPadding"
          type="range"
          min="0"
          max="24"
          value={layout.personBoxPadding}
          onChange={(e) => handleChange('personBoxPadding', parseInt(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Box size adjusts automatically based on content
        </p>
      </div>

      <div>
        <h4 className="mb-3">Spacing</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="hSpacing" className="block text-sm mb-1">
              Horizontal: {layout.horizontalSpacing}px
            </label>
            <input
              id="hSpacing"
              type="range"
              min="1"
              max="100"
              value={layout.horizontalSpacing}
              onChange={(e) => handleChange('horizontalSpacing', parseInt(e.target.value))}
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
              min="30"
              max="120"
              value={layout.verticalSpacing}
              onChange={(e) => handleChange('verticalSpacing', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="margin" className="block text-sm mb-2">
          Page Margin: {layout.marginTop}px
        </label>
        <input
          id="margin"
          type="range"
          min="0"
          max="50"
          value={layout.marginTop}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onUpdate({ ...layout, marginTop: val, marginRight: val, marginBottom: val, marginLeft: val });
          }}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Applies to all sides (top, right, bottom, left)
        </p>
      </div>

      <div>
        <h4 className="mb-3">Border</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="borderWidth" className="block text-sm mb-1">Box Border Width</label>
            <input
              id="borderWidth"
              type="number"
              min="0"
              max="5"
              value={layout.borderWidth}
              onChange={(e) => handleChange('borderWidth', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
            />
          </div>
          <div>
            <label htmlFor="lineWidth" className="block text-sm mb-1">Line Width</label>
            <input
              id="lineWidth"
              type="number"
              min="0"
              max="5"
              value={layout.lineWidth}
              onChange={(e) => handleChange('lineWidth', parseInt(e.target.value))}
              className="w-full px-2 py-1.5 text-sm bg-input-background border border-border rounded"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="borderColor" className="block text-sm mb-1">Color</label>
            <input
              id="borderColor"
              type="color"
              value={layout.borderColor}
              onChange={(e) => handleChange('borderColor', e.target.value)}
              className="w-full h-[34px] bg-input-background border border-border rounded"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
