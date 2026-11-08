import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { access, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { verifyPackage } from './verify-package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const platform = process.argv[2] || process.platform;
const arch = process.argv[3] || (platform === 'win32' ? 'x64' : process.arch);
if (!['darwin', 'win32'].includes(platform)) throw new Error('Supported package targets: darwin, win32');
if (!['arm64', 'x64'].includes(arch)) throw new Error('Supported architectures: arm64, x64');
await access(path.join(root, 'dist/index.html'));
const icon = path.join(root, 'build', platform === 'darwin' ? 'shixu.icns' : 'shixu.ico');
await access(icon);
const result = await packager({
  dir: root, out: path.join(root, 'artifacts'), name: '拾序',
  executableName: platform === 'win32' ? 'Shixu' : '拾序',
  appBundleId: 'local.shixu.desktop', appCategoryType: 'public.app-category.productivity',
  platform, arch, asar: true, overwrite: true, prune: true,
  ...(process.env.SHIXU_ELECTRON_ZIP_DIR ? { electronZipDir: process.env.SHIXU_ELECTRON_ZIP_DIR } : {}),
  appVersion: manifest.version, buildVersion: `${manifest.version}.0`,
  appCopyright: '拾序 · 独立本地任务管理应用',
  ...(platform === 'darwin' ? { extendInfo: { LSMinimumSystemVersion: '13.0' } } : {
    win32metadata: { ProductName: '拾序', FileDescription: '拾序 · 本地任务管理', 'requested-execution-level': 'asInvoker' },
  }),
  // Only ship the runtime; exclude local research, reports, tests and credentials.
  ignore: file => file !== '' && !['package.json', 'dist', 'electron', 'src', 'THIRD_PARTY_NOTICES.txt'].some(entry => file === `/${entry}` || file.startsWith(`/${entry}/`)),
  icon,
});
for (const destination of result) {
  const bundle = platform === 'darwin' ? path.join(destination, '拾序.app') : destination;
  if (platform === 'darwin' && process.platform === 'darwin') {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', bundle], { stdio: 'inherit' });
  }
  const report = await verifyPackage(bundle, manifest.version);
  await writeFile(path.join(root, 'artifacts', `package-integrity-${platform}-${arch}.json`), JSON.stringify(report, null, 2) + '\n');
  console.log(bundle);
}
