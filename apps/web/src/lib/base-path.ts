/** The path the app is served under, for example "/projects/snaphunt". Empty when it is served from the root. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Prefixes a public path (images, audio) with the base path; Next adds it to links and routes on its own. */
export const withBase = (path: string, base = BASE_PATH) => `${base}${path}`;
