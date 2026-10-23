# SEO foundation: release notes

This branch is prepared for review. Production deployment has not been verified or performed.

## Local verification

Run `npm run build` and `npm run verify`. The build needs Node's standard library only; the existing function dependencies are unchanged. It creates 11 unique article pages from the 12 retained JSON records and a sitemap of 15 URLs. `npm run build:preview` adds a global noindex response header only to the generated `_site` directory. A subsequent production build does not retain that preview header.

The public build uses an explicit allowlist rather than publishing the repository root. Source archives, configuration files, diagnostic HTML, scripts and Git history are excluded. This does not disable serverless diagnostic endpoints or replace authentication. Functions remain in `netlify/functions`.

## Required before release

- Confirm the Netlify site, production branch, deployed commit, build settings, function bundling and environment-variable scope without copying values into tickets or logs.
- Review and rotate potentially exposed credentials in the existing repository; removing them from website output does not remove Git history.
- Review administrative and diagnostic function authentication and personal-data logging. No production probes or real messages were sent during local testing.
- Review factual, legal and commercial claims in existing articles. Original records and photos are retained; the new static pages currently render article text without embedded article photos.
- Verify actual Netlify redirects, clean URLs, security headers, preview noindex, CMS operation and authorized lead receipt. Local browser testing used a route simulation and intercepted successful form responses.
- Capture the known-good deploy ID, artifact and applicable data/configuration backup. Rehearse restoration in a safe environment. Never undo credential rotation during rollback or restore a version that republishes sensitive configuration.

After release, inspect Google-selected canonicals and indexing in Search Console and submit the sitemap. Record the Estonia traffic and qualified-lead baseline before attributing any change to this release. DNS changes are not needed.
