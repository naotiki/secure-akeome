export function splitByLines(input: string, maxLinesPerPage: number): string[] {
  const normalized = input.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage).join('\n'));
  }
  return pages.length ? pages : [''];
}

