import { mkdtemp, readFile, access, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { verifyPackage } from './verify-package.mjs';

if (process.platform !== 'win32') throw new Error('Installer smoke must run on Windows');
const run = promisify(execFile);
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const directory = await mkdtemp(path.join(os.tmpdir(), 'shixu 安装测试-'));
const installPath = path.join(directory, 'Application with spaces');
const installer = path.resolve(`artifacts/Shixu-${version}-Windows-x64-Setup.exe`);
await run(installer, ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', `/DIR=${installPath}`], { timeout: 180000 });
await verifyPackage(installPath, version);
process.env.SHIXU_SMOKE_EXECUTABLE = path.join(installPath, 'Shixu.exe');
process.env.SHIXU_SMOKE_REPORT = 'artifacts/windows-installed-smoke.json';
await import('./desktop-smoke.mjs');
const smoke = JSON.parse(await readFile(process.env.SHIXU_SMOKE_REPORT, 'utf8'));
const saved = await readFile(smoke.dataPath, 'utf8');
await run(path.join(installPath, 'unins000.exe'), ['/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'], { timeout: 180000 });
await assert.rejects(access(path.join(installPath, 'Shixu.exe')), { code: 'ENOENT' });
assert.equal(await readFile(smoke.dataPath, 'utf8'), saved);
await writeFile('artifacts/windows-installer-smoke.json', JSON.stringify({
  version, result: 'passed', silentInstall: true, installedAppSmoke: 'passed',
  unicodeAndSpacePath: true, uninstall: true, userDataSurvivesUninstall: true,
}, null, 2) + '\n');
