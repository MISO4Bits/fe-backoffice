/**
 * Convierte el volcado de variables de Figma en el archivo de tokens SCSS
 * que alimenta el tema. No se escribe ningun color a mano: la fuente es
 * design/figma-tokens.json, extraido del archivo Solventa Design System.
 *
 *   node tools/tokens-to-scss.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origen = join(raiz, 'design', 'figma-tokens.json');
const destino = join(raiz, 'src', 'styles', '_tokens.scss');

const t = JSON.parse(readFileSync(origen, 'utf8'));

/** Material expresa la tipografia en rem sobre una base de 16 px. */
const rem = (px) => `${+(px / 16).toFixed(4)}rem`;

const lineas = [];
const escribir = (s = '') => lineas.push(s);

escribir('// Generado por tools/tokens-to-scss.mjs a partir de design/figma-tokens.json.');
escribir(`// Archivo de Figma: ${t.$origen.archivo} (${t.$origen.fileKey}).`);
escribir('// No editar a mano: volver a extraer de Figma y ejecutar npm run tokens:build.');
escribir('');

// --- color ---------------------------------------------------------------
for (const modo of ['light', 'dark']) {
  escribir(`$sys-${modo}: (`);
  for (const [nombre, valores] of Object.entries(t.esquemas)) {
    escribir(`  ${nombre}: ${valores[modo]},`);
  }
  escribir(');');
  escribir('');
}

// --- tipografia ----------------------------------------------------------
const familia = (clave) => `(${t.fuentes[clave]}, sans-serif)`;

escribir('// Familia del producto. La del logo vive en $brand y no se usa aqui.');
escribir(`$font-plain: ${familia('plain')};`);
escribir(`$font-brand: ${familia('brand')};`);
escribir('');

escribir('$sys-typescale: (');
for (const [escala, v] of Object.entries(t.typescale)) {
  escribir(`  ${escala}-font: ${familia(v.font)},`);
  escribir(`  ${escala}-size: ${rem(v.size)},`);
  escribir(`  ${escala}-line-height: ${rem(v['line-height'])},`);
  escribir(`  ${escala}-tracking: ${rem(v.tracking)},`);
  escribir(`  ${escala}-weight: ${t.fuentes.pesos[v.weight]},`);
}
escribir(');');
escribir('');

// --- forma ---------------------------------------------------------------
// Material solo reconoce un subconjunto de radios. El resto se expone como
// variable propia para los componentes de Solventa.
const RADIOS_MATERIAL = new Set([
  'corner-none',
  'corner-extra-small',
  'corner-small',
  'corner-medium',
  'corner-large',
  'corner-extra-large',
  'corner-full',
]);

escribir('$sys-shape: (');
for (const [nombre, px] of Object.entries(t.forma)) {
  if (RADIOS_MATERIAL.has(nombre)) escribir(`  ${nombre}: ${px}px,`);
}
escribir(');');
escribir('');

escribir('$shape-extra: (');
for (const [nombre, px] of Object.entries(t.forma)) {
  if (!RADIOS_MATERIAL.has(nombre)) escribir(`  ${nombre}: ${px}px,`);
}
escribir(');');
escribir('');

// --- marca y reticula ----------------------------------------------------
escribir('$brand: (');
for (const [nombre, valor] of Object.entries(t.marca)) {
  const v = typeof valor === 'string' && !valor.startsWith('#') ? `'${valor}'` : valor;
  escribir(`  ${nombre}: ${v},`);
}
escribir(');');
escribir('');

// "columnas" es un conteo, no una longitud: va sin unidad.
const SIN_UNIDAD = new Set(['columnas']);

escribir('$grid: (');
for (const [nombre, valor] of Object.entries(t.reticula)) {
  escribir(`  ${nombre}: ${valor}${SIN_UNIDAD.has(nombre) ? '' : 'px'},`);
}
escribir(');');
escribir('');

writeFileSync(destino, lineas.join('\n'), 'utf8');

const n = Object.keys(t.esquemas).length;
const e = Object.keys(t.typescale).length;
console.log(
  `_tokens.scss generado: ${n} roles de color en dos modos, ${e} escalas tipograficas, ` +
    `${Object.keys(t.forma).length} radios.`,
);
