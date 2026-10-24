// A deliberately small text format: paragraphs, ##/### headings and - lists.
// Source HTML and Markdown links remain text; they never become executable HTML.
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

export function renderArticleText(content) {
  const output = [];
  let paragraph = [], list = [];
  function flush() {
    if (paragraph.length) output.push(`<p>${escape(paragraph.join('\n'))}</p>`);
    if (list.length) output.push(`<ul>${list.map(text => `<li>${escape(text)}</li>`).join('')}</ul>`);
    paragraph = []; list = [];
  }
  for (const line of String(content).trim().split(/\r?\n/)) {
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    const item = line.match(/^-\s+(.+)$/);
    if (!line.trim()) { flush(); continue; }
    if (heading) {
      flush();
      output.push(`<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`);
    } else if (item) {
      if (paragraph.length) flush();
      list.push(item[1]);
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return output.join('\n');
}

export function referenceLink(reference) {
  const url = new URL(reference.url);
  if (url.protocol !== 'https:' || url.username || url.password || !reference.title) {
    throw new Error('Article references require a titled, credential-free HTTPS URL');
  }
  return `<li><a href="${escape(url.href)}">${escape(reference.title)}</a></li>`;
}
