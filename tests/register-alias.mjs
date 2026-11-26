import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');

const loaderCode = `
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = ${JSON.stringify(rootDir)};

function resolveWithExtension(targetPath) {
  const candidates = [
    targetPath,
    targetPath + '.ts',
    targetPath + '.tsx',
    path.join(targetPath, 'index.ts'),
    path.join(targetPath, 'index.tsx'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return pathToFileURL(c).href;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const resolved = resolveWithExtension(path.join(rootDir, rel));
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const parentDir = path.dirname(new URL(context.parentURL).pathname.replace(/^\\/([A-Za-z]:)/, '$1'));
    const resolved = resolveWithExtension(path.resolve(parentDir, specifier));
    if (resolved) {
      return { url: resolved, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript;base64,${Buffer.from(loaderCode).toString('base64')}`, pathToFileURL('./'));

