import 'server-only';

/**
 * The one multipart call the speech adapters make, injected so tests need no key and no network. The audio travels
 * through as a `Blob` inside the form and is never held anywhere else (design §9).
 */
export type PostForm = (url: string, request: { headers: Readonly<Record<string, string>>; form: FormData }) => Promise<unknown>;

/** Builds the real caller. Keeps the key here, so the adapters themselves never see one. */
export function makePostForm(headers: Readonly<Record<string, string>>): PostForm {
  return async (url, request) => {
    const response = await fetch(url, { method: 'POST', headers: { ...headers, ...request.headers }, body: request.form });
    if (!response.ok) throw new Error(`speech service replied ${response.status}`);
    return response.json();
  };
}
