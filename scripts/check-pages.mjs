import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const distRoot = path.join(projectRoot, 'dist');
const expectedBase = '/computer-architecture-visual-lab/';
const config = await readFile(path.join(projectRoot, 'vite.config.ts'), 'utf8');
const base = config.match(/\bbase\s*:\s*(['"])(.*?)\1/)?.[2];

function fail(message) {
  throw new Error(`GitHub Pages check failed: ${message}`);
}

if (base !== expectedBase) fail(`Vite base must be ${expectedBase}, found ${base ?? 'unset'}.`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  }));
  return nested.flat();
}

const files = await listFiles(distRoot).catch(() => fail('dist/ is missing. Run Vite build first.'));
const indexPath = path.join(distRoot, 'index.html');
if (!files.includes(indexPath)) fail('dist/index.html is missing.');
if (!files.some((file) => file.endsWith('.js'))) fail('No production JavaScript was generated.');
if (!files.some((file) => file.endsWith('.css'))) fail('No production CSS was generated.');

let referenceCount = 0;

async function verifyReference(rawReference, owner, requireBase = false) {
  const reference = rawReference.trim();
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference)) return;
  if (reference.startsWith('/') && !reference.startsWith(base)) {
    fail(`${path.relative(distRoot, owner)} references an asset outside the Pages base: ${reference}`);
  }
  if (requireBase && !reference.startsWith(base)) {
    fail(`index.html resource must start with ${base}: ${reference}`);
  }
  const pathname = decodeURIComponent(reference.split(/[?#]/)[0]);
  const target = pathname.startsWith(base)
    ? path.resolve(distRoot, pathname.slice(base.length))
    : path.resolve(path.dirname(owner), pathname);
  const relativeTarget = path.relative(distRoot, target);
  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    fail(`Asset escapes dist/: ${reference}`);
  }
  const info = await stat(target).catch(() => fail(`Missing asset ${reference} from ${path.relative(distRoot, owner)}.`));
  if (!info.isFile()) fail(`Asset is not a file: ${reference}`);
  referenceCount += 1;
}

for (const file of files) {
  if (!/\.(?:html|css|js|json|svg)$/i.test(file)) continue;
  const source = await readFile(file, 'utf8');
  if (/(?:[a-z]:[\\/](?:Users|Documents and Settings)[\\/]|\/Users\/)/i.test(source)) {
    fail(`${path.relative(distRoot, file)} contains a local computer path.`);
  }
  if (file.endsWith('.html')) {
    for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
      await verifyReference(match[1], file, file === indexPath);
    }
  }
  if (file.endsWith('.css')) {
    for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      await verifyReference(match[1], file);
    }
    for (const match of source.matchAll(/@import\s+["']([^"']+)["']/g)) {
      await verifyReference(match[1], file);
    }
  }
  if (file.endsWith('.js')) {
    // Inspect emitted ES module references. Relative chunk imports are valid beneath the repository base.
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
      if (/^(?:\.{1,2}\/|\/)/.test(match[1])) await verifyReference(match[1], file);
    }
    for (const match of source.matchAll(/\bnew\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/g)) {
      await verifyReference(match[1], file);
    }
  }
}

console.log(`GitHub Pages check passed: ${files.length} files, ${referenceCount} asset references, base ${base}`);
