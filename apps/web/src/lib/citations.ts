const LABEL = String.raw`M\d+\.\d+`;
const CITATION_GROUP = new RegExp(String.raw`\[(${LABEL}(?:\s*,\s*${LABEL})*)\]`, 'g');

export function linkCitations(markdown: string): string {
  return markdown.replace(CITATION_GROUP, (_, group: string) =>
    group
      .split(/\s*,\s*/)
      .map((label) => `[${label}](#cite-${label})`)
      .join(''),
  );
}

export function citationLabel(href: string | undefined): string | null {
  return href?.startsWith('#cite-') ? href.slice('#cite-'.length) : null;
}
