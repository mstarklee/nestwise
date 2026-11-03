/** Fired on window after any successful request: there is signal, so the outbox can send. */
export const API_OK = 'nestwise:api-ok';

/** Calls the app's own /api/v1 from the browser (the session cookie goes along). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'Offline', 'No connection');
  }
  const json = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
  if (!response.ok) throw new ApiError(response.status, json.error?.code ?? 'ServerError', json.error?.message ?? '');
  window.dispatchEvent(new Event(API_OK));
  return json as T;
}
