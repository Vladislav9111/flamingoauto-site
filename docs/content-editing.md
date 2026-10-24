# Article editing

Published source records live in `content/posts/<id>.json`. Keep IDs, original
creation dates, photo arrays and other existing metadata when editing. Existing
article addresses are permanent. The original duplicate Estonian record is
retained; the build publishes one copy of identical text in each language.

Article content is plain text with a small formatting subset:

- `## Heading` and `### Heading` make sections.
- Lines beginning with `- ` form a list.
- Blank lines separate paragraphs. Source HTML is escaped, never executed.

Set `updated` to an ISO date only after a substantive editorial change. Do not
change dates merely to make a page look fresh. Original `created` stays intact.
`translation` names a reciprocal article ID in the other language and must only
be set for genuinely equivalent content. `related` lists existing IDs in the
same language. Optional `references` contain a `title` and an HTTPS `url`.

Use confirmed business conditions. Do not invent turnaround guarantees, towing
prices, fee coverage, statistics, reviews, office addresses or author credentials.
Official transaction guidance belongs in links to Transpordiamet. Check the
source again before changing administrative or tax information.

Build with `npm run build` and run `npm run test:security`. The build verifies
canonical addresses, language pairs, internal links, editorial dates and the
boundary between public files and server-only settings. Review both languages
on mobile before publishing. Deployment previews remain excluded from indexing.

The shared phone number is deliberately omitted at the owner's request.
The published contact channel is the email address and the existing lead form.
