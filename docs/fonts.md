# Site font

Noto Sans is served locally from `/static/fonts/`. The WOFF2 files are unmodified
subsets returned by the official Google Fonts CSS2 API for normal style,
weights 300–900. Cyrillic, Latin and Latin Extended are selected using the
original unicode-range declarations. `font-display: swap` preserves readable
fallback text while the font loads. Existing system fallbacks stay available.

The Latin subset is preloaded because every page uses Latin text in its logo.
Filenames include SHA256 prefixes so the existing long static cache remains
safe when fonts change. No build-time external font request is needed.

The original SIL Open Font License and copyright notice are distributed at
`/static/fonts/OFL.txt`. Source stylesheet:
https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300..900&display=swap

- noto-sans-v42-cyrillic-70af9f67.woff2 — SHA256 70af9f676b2ab2b28a248ec79b498762cc981ec6d52d6a6dc8b42a3ba5c05f50
- noto-sans-v42-latin-ext-be4f6d04.woff2 — SHA256 be4f6d04a074f3887553c9b1c09e563470f3fe975456a13fc5bf7e20b5612976
- noto-sans-v42-latin-afc7a910.woff2 — SHA256 afc7a910f4ff04ee2ff7b3a2ef8b24f8340b8ea8d8125f2779f1f0b69d1b56b9
