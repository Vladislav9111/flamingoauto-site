import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const findings = [];
async function scan(directory, browser = false) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '_site'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await scan(filename, browser); continue; }
    if (!/\.(js|mjs|html|json|md|txt|yml|toml|css)$/.test(entry.name)) continue;
    const text = await readFile(filename, 'utf8');
    // Report only file names and types, never matching substrings.
    if (/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|\b\d{7,}:[A-Za-z0-9_-]{25,})/.test(text)) {
      findings.push({ file: path.relative(root, filename), kind: 'credential format' });
    }
    if (browser && /\.(js|html)$/.test(entry.name) && /api\.telegram\.org|FLAMINGO_TELEGRAM_BOT_TOKEN|FLAMINGO_ADMIN_PASSWORD_HASH|FLAMINGO_ADMIN_SESSION_SECRET/.test(text)) {
      findings.push({ file: path.relative(root, filename), kind: 'server-only value or direct Telegram access in browser asset' });
    }
  }
}
await scan(root);
await scan(path.join(root, '_site'), true);
if (findings.length) { console.error(JSON.stringify(findings)); process.exitCode = 1; }
else console.log('Secret-format and browser-boundary scans passed. No secret values printed.');
