// Deliberate pilot bug: whitespace titles are not normalized yet.
export const normalizeTitle = value => typeof value === 'string' ? value : '';
