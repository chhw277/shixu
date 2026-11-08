import { extractFile, listPackage } from '@electron/asar';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function walk(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${directory}/${e.name}`) : `${directory}/${e.name}`))).flat();
}
export async function verifyPackage(bundle, expectedVersion) {
  const archive = bundle.endsWith('.app') ? path.join(bundle, 'Contents/Resources/app.asar') : path.join(bundle, 'resources/app.asar');
  const version = JSON.parse(extractFile(archive, 'package.json')).version;
  if (version !== expectedVersion) throw new Error(`Unexpected packaged version ${version}`);
  const files = [];
  for (const entry of [...await walk('dist'), ...await walk('src'), ...await walk('electron'), 'THIRD_PARTY_NOTICES.txt']) {
    const source = await readFile(path.join(root, entry));
    const packaged = extractFile(archive, entry.split('/').join(path.sep));
    const matches = source.equals(packaged);
    files.push({ path: entry, sha256: createHash('sha256').update(source).digest('hex'), matches });
    if (!matches) throw new Error(`Package differs from source: ${entry}`);
  }
  for (const entry of listPackage(archive)) {
    const normalized = entry.replaceAll('\\', '/');
    if (!/^\/(?:package\.json|THIRD_PARTY_NOTICES\.txt|dist(?:\/|$)|src(?:\/|$)|electron(?:\/|$))/.test(normalized)) throw new Error(`Unexpected packaged file: ${entry}`);
  }
  return { version, files, userDataIncluded: false };
}
