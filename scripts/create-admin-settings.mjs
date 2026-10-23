import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { open } from 'node:fs/promises';
import path from 'node:path';

// Run interactively by the owner. Never pass a password as a command argument.
// The output file is outside the repository; its contents are never printed.
if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('An interactive owner terminal is required');
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) throw new Error('Pass an absolute private output path outside the repository');
const repository = process.cwd();
if (path.resolve(destination).startsWith(repository + path.sep)) throw new Error('The settings file must be outside the repository');
async function secret(prompt) {
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = '';
  return new Promise((resolve, reject) => {
    const listener = chunk => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { cleanup(); reject(new Error('Cancelled')); return; }
        if (char === '\r' || char === '\n') { cleanup(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    function cleanup() { process.stdin.off('data', listener); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); }
    process.stdin.on('data', listener);
  });
}
const password = await secret('New Flamingo admin password (hidden, at least 16 characters): ');
const confirm = await secret('Repeat password (hidden): ');
if (password !== confirm || password.length < 16 || password.length > 256) throw new Error('Password mismatch or invalid length');
const salt = randomBytes(16);
const key = await promisify(scrypt)(password, salt, 64, { N: 16384, r: 8, p: 1 });
const file = await open(destination, 'wx', 0o600);
try {
  await file.writeFile(`FLAMINGO_ADMIN_PASSWORD_HASH=scrypt$${salt.toString('hex')}$${key.toString('hex')}\nFLAMINGO_ADMIN_SESSION_SECRET=${randomBytes(32).toString('hex')}\n`);
} finally { await file.close(); }
console.log('Private server settings saved. No password or setting values were printed.');
