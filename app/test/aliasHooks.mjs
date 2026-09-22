import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts'];

const withExtension = (file) => {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  for (const extension of EXTENSIONS) {
    const candidate = file + extension;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const file = withExtension(path.join(SRC, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = path.dirname(fileURLToPath(context.parentURL));
    const file = withExtension(path.resolve(base, specifier));
    if (file && file.endsWith('.ts')) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
