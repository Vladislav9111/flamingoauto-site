// Offer a language choice while keeping stable, crawlable ET/RU URLs.
// Only browser language is read; preferences and form data are not stored.
document.addEventListener('DOMContentLoaded', () => {
  const suggestion = document.getElementById('language-suggestion');
  if (!suggestion) return;
  const languages = Array.from(navigator.languages || [navigator.language || 'et']);
  const preferred = languages.map(value => value.toLowerCase().split('-')[0]).find(value => value === 'et' || value === 'ru') || 'et';
  suggestion.hidden = preferred === document.documentElement.lang;
  document.getElementById('dismiss-language').addEventListener('click', () => { suggestion.hidden = true; });
});
