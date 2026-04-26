/**
 * build-tokens.mjs
 *
 * Generiert CSS Custom Properties aus den JSON-Token-Dateien.
 * Laeuft ohne externe Dependencies - nur Node.js.
 *
 * Usage:
 *   node design-system/build-tokens.mjs
 *
 * Generiert:
 *   packages/shared/styles/tokens.css        (Foundation)
 *   apps/antipol/src/styles/theme.css         (ANTIPOL Brand)
 *   apps/momance/src/styles/theme.css         (Momance Brand)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadJSON(path) {
  return JSON.parse(readFileSync(join(__dirname, path), 'utf-8'));
}

function resolveValue(val) {
  if (typeof val === 'object' && val.$value !== undefined) return String(val.$value);
  return String(val);
}

// ── Foundation Tokens → shared/styles/tokens.css ──

function buildFoundationCSS() {
  const f = loadJSON('foundation/tokens.json');
  const lines = [
    '/*',
    ' * ANTIPOL x Momance - Shared Design Tokens',
    ' * AUTO-GENERIERT aus design-system/foundation/tokens.json',
    ' * Nicht manuell bearbeiten - aendere die JSON-Quelle.',
    ' */',
    '',
    ':root {'
  ];

  const sections = {
    'Spacing': 'spacing',
    'Radii': 'radii',
    'Transitions': 'transitions',
    'Layout': 'layout',
    'Z-Index Scale': 'z-index'
  };

  for (const [comment, key] of Object.entries(sections)) {
    lines.push(`  /* ${comment} */`);
    const group = f[key];
    for (const [name, token] of Object.entries(group)) {
      const v = resolveValue(token);
      const desc = token.$description ? `  /* ${token.$description} */` : '';
      const prefixMap = { 'spacing': 'space', 'radii': 'radius', 'transitions': 'transition', 'z-index': 'z', 'layout': '' };
      const prefix = prefixMap[key];
      const varName = prefix ? `${prefix}-${name}` : name;
      lines.push(`  --${varName}: ${v};${desc}`);
    }
    lines.push('');
  }

  lines.push('}');
  lines.push('');
  lines.push('@media (max-width: 768px) {');
  lines.push('  :root {');
  lines.push('    --content-padding: var(--content-padding-mobile);');
  lines.push('  }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ── Brand Tokens → theme.css ──

function buildBrandCSS(brandName, brandPath) {
  const b = loadJSON(brandPath);
  const lines = [
    '/*',
    ` * ${brandName} Theme`,
    ` * AUTO-GENERIERT aus design-system/brands/${brandName.toLowerCase()}/tokens.json`,
    ' * Nicht manuell bearbeiten - aendere die JSON-Quelle.',
    ' */',
    '',
    ':root {'
  ];

  // Colors
  lines.push('  /* -- Farben -- */');
  for (const [name, token] of Object.entries(b.color)) {
    if (name.startsWith('$')) continue;
    const v = resolveValue(token);
    const label = token.name ? `  /* ${token.name} */` : '';
    lines.push(`  --color-${name}: ${v};${label}`);
  }
  lines.push('');

  // Typography
  lines.push('  /* -- Typografie -- */');
  for (const [name, token] of Object.entries(b.typography)) {
    if (name.startsWith('$') || name === 'google-fonts-url') continue;
    lines.push(`  --${name}: ${resolveValue(token)};`);
  }
  lines.push('');

  // Components
  lines.push('  /* -- Komponenten-Varianten -- */');
  for (const [name, token] of Object.entries(b.components)) {
    if (name.startsWith('$')) continue;
    let v = resolveValue(token);
    // Resolve token references like {radii.md} or {color.surface}
    v = v.replace(/\{radii\.(\w+)\}/g, 'var(--radius-$1)');
    v = v.replace(/\{color\.(\w+)\}/g, 'var(--color-$1)');
    lines.push(`  --${name.startsWith('card') || name.startsWith('nav') || name.startsWith('panel') ? '' : 'component-'}${name}: ${v};`);
  }
  lines.push('}');
  lines.push('');

  // Momance: Light mode
  if (b['color-light']) {
    lines.push('/* Heller Kontext: .theme-light auf Container-Element */');
    lines.push('.theme-light {');
    for (const [name, token] of Object.entries(b['color-light'])) {
      if (name.startsWith('$')) continue;
      const v = resolveValue(token);
      const label = token.name ? `  /* ${token.name} */` : '';
      if (name === 'bg-secondary') {
        lines.push(`  --color-bg-secondary: ${v};${label}`);
      } else {
        lines.push(`  --color-${name.replace('bg', 'bg')}: ${v};${label}`);
      }
    }
    lines.push('}');
    lines.push('');
  }

  // Momance: Category colors
  if (b['color-categories']) {
    lines.push('/* Kategorie-Farben (6 Lebensbereiche) */');
    lines.push(':root {');
    for (const [name, token] of Object.entries(b['color-categories'])) {
      if (name.startsWith('$')) continue;
      lines.push(`  --color-category-${name}: ${resolveValue(token)};`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

// ── Run ──

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

const foundationCSS = buildFoundationCSS();
const foundationPath = join(root, 'packages/shared/styles/tokens.css');
ensureDir(foundationPath);
writeFileSync(foundationPath, foundationCSS, 'utf-8');
console.log('  tokens.css ← foundation/tokens.json');

const antipolCSS = buildBrandCSS('ANTIPOL', 'brands/antipol/tokens.json');
const antipolPath = join(root, 'apps/antipol/src/styles/theme.css');
ensureDir(antipolPath);
writeFileSync(antipolPath, antipolCSS, 'utf-8');
console.log('  antipol/theme.css ← brands/antipol/tokens.json');

const momanceCSS = buildBrandCSS('Momance', 'brands/momance/tokens.json');
const momancePath = join(root, 'apps/momance/src/styles/theme.css');
ensureDir(momancePath);
writeFileSync(momancePath, momanceCSS, 'utf-8');
console.log('  momance/theme.css ← brands/momance/tokens.json');

console.log('\nDone. 3 CSS-Dateien generiert aus JSON-Tokens.');
