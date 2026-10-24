# Flamingo Auto security release

This change is scoped to flamingoauto.eu, its repository and `@Flamingoauto_bot`. No financial-bot or AllCars credentials are used or modified. It includes the preceding SEO foundation commit.

## Findings and containment

The historical browser configuration is publicly reachable in the current production deployment. Its credentials have been removed from the present source and excluded from generated site output. The original Telegram token returns HTTP 401 on `getMe`; its username cannot be recovered through that invalid token. The owner independently identified the intended bot as `@Flamingoauto_bot`. Check BotFather and rotate this bot's token without pasting it into tickets, chat or source code.

The leak was introduced in commit `62c2720d686ba4cae60149c8dac60d31815710ef`. A scan of 268 reachable commits and 679 unique blobs found the originally reported token, chat ID and password together in one historical configuration blob. Removing them from the latest tree does not remove that historical blob. Credential revocation/rotation is required independently of optional history cleanup. Do not force-push rewritten history without coordinating all branches and clones. The full local backup deliberately retains the old history and must remain private.

Browser password comparisons, default passwords, unauthenticated credential-reset helpers and diagnostic responses are retired. All 22 legacy endpoints return 410 without performing writes. Administration now uses a server-verified scrypt password hash and a signed 30-minute HttpOnly/Secure/SameSite=Strict cookie. Changing the server password hash invalidates existing sessions. Creation/editing preserves source metadata and photos; this UI does not delete articles.

## Owner setup in this Netlify project only

Set new values in **Environment variables**, scoped to **Functions** where the plan supports it, with secret values marked secret. This project's free plan locks scope selection; **All scopes** is acceptable without upgrading because the reviewed static build does not substitute environment values into public files and only server functions read credentials. Never use `VITE_`, `NEXT_PUBLIC_`, browser scripts or frontend build substitution. Do not copy secrets into `netlify.toml`.

| Variable | Meaning |
|---|---|
| `FLAMINGO_TELEGRAM_BOT_TOKEN` | New token for `@Flamingoauto_bot` only. The handler verifies the bot username before sending. |
| `FLAMINGO_TELEGRAM_CHAT_ID` | Authorized destination for Flamingo leads, retained privately by the owner. |
| `FLAMINGO_TURNSTILE_SITE_KEY` | Public widget key for flamingoauto.eu; only this key is returned to the browser. |
| `FLAMINGO_TURNSTILE_SECRET_KEY` | Private server-side verification key. |
| `FLAMINGO_ADMIN_PASSWORD_HASH` | New scrypt hash produced by the interactive helper below. |
| `FLAMINGO_ADMIN_SESSION_SECRET` | Independent random signing key produced by the helper. |
| `FLAMINGO_GITHUB_TOKEN` | Fine-grained repository credential restricted to `Vladislav9111/flamingoauto-site`, Contents read/write, for administration only. |
| `FLAMINGO_ALLOWED_ORIGINS` | Comma-separated exact origins. Defaults to `https://flamingoauto.eu`. Add an exact preview origin only when testing it. No wildcards. |

The first six settings enable leads and login; the GitHub credential separately enables article editing. No old generic credential is used as a fallback. The form and login fail closed if their new settings are missing. Do not publish an unconfigured production release.

For the new admin password, run `node scripts/create-admin-settings.mjs /absolute/private/path/flamingo-admin-settings.env` interactively from this repository. Use a unique password of at least 16 characters. Input is hidden; the helper creates a new file with mode 0600 outside the repository and never prints values. The owner must enter the generated settings into Netlify; do not send them to the agent. Keep the password in a password manager.

The owner must enter and submit new credentials personally. The old browser password is no longer accepted by this implementation. If it was reused elsewhere, address those accounts separately without changing unrelated project credentials here.

The active routes are `/api/lead`, `/api/form-config`, `/api/admin/session` and `/api/admin/posts`. Direct function aliases are rejected by the handlers to prevent bypassing route-level controls.

## Form protection

The lead function permits same-origin multipart POST requests only, validates required fields and bounded text lengths, and limits total payload size, photo count, type and magic bytes. A honeypot and minimum elapsed time are additional heuristics. Turnstile is mandatory and verified on the server with the expected hostname and action. Failures do not contact Telegram.

Lead requests and login attempts additionally use a shared server quota of 5 attempts per IP per 60 seconds. A deploy-specific Netlify Blobs store in Frankfurt uses strong reads and conditional writes to prevent parallel instances bypassing the limit. It stores only hashed IP identifiers and bounded counters, never raw IPs, credentials or lead content. Each endpoint ledger is capped at 1024 active clients; expired counters are pruned on writes. Storage failures deny requests rather than disabling protection. Session reads and logout do not consume login attempts. Netlify's native rate-limit declarations remain an additional layer, but their enforcement has not been observed in preview and is not relied on.

User text is sent as plain text with no Telegram markup mode. No request body, credential, token-bearing URL, upstream response or stack trace is logged or returned. Photo delivery failure after successful text delivery is shown to the visitor, rather than silently reporting complete success or resending the lead.

## Validation and deployment gates

- `npm run test:security`: adversarial server tests with synthetic credentials and mocked Telegram, Cloudflare and GitHub; no real leads or content writes.
- `npm run build`: static pages, SEO validation, explicit public file allowlist and secret/browser-boundary scan.
- `npm run build:preview`: additionally makes generated preview responses noindex without mutating production source headers.
- Browser QA uses the actual new handler with mocked third-party responses. A real Turnstile challenge and end-to-end receipt still require owner setup.
- Node 24 is the build target and was used locally; confirm the actual function runtime is Node 24 and not overridden by legacy Netlify settings.

Confirmed existing production deploy: `6975d07565b50100083b4142`, main commit `4f59fbb4b44dae3a1a7fdf4257e5467ff36d677f`, project `mellifluous-moxie-db6fec`. Main auto-publishes. A downloaded file backup was verified as a readable ZIP and stored privately, alongside the Git bundle and public snapshot. It contains historical credentials and must never be published.

Before release, verify a branch/PR preview, bundled functions, CSP, redirects, noindex, unauthorized admin requests, real challenge enforcement, rate-limit rules and authorized lead receipt. Preserve an independent safe rollback artifact and configuration backup. The old deploy is an insecure reference, not a safe security rollback. Never restore old credentials. Old deploy permalinks and functions must also be considered during containment; removing the archive from a new deployment alone does not erase old artifacts.

Do not revoke existing generic GitHub/Netlify credentials without checking their ownership and other consumers. If old endpoints or old deployment artifacts could still use them, arrange scoped replacements and revocation with the owner while preserving financial-bot and AllCars services.
