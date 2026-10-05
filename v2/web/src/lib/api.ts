// Client HTTP unique de l'application. Même origine que l'API (cookie de session HttpOnly).

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public champs?: Record<string, string>,
    public details?: any,
    public code?: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined | string[]>;

function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
  }
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${withQuery(path, query)}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Le serveur ne répond pas. Vérifiez la connexion internet puis réessayez.');
  }
  if (res.status === 204) return undefined as T;
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? `Erreur ${res.status}`, data?.champs, data?.details, data?.code);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/** Message d'erreur lisible, quelle que soit l'erreur. */
export function messageErreur(e: unknown): string {
  if (e instanceof ApiError) {
    const extra = Array.isArray(e.details?.erreurs) ? ` ${e.details.erreurs.join(' ')}` : '';
    return e.message + extra;
  }
  if (e instanceof Error) return e.message;
  return 'Une erreur inattendue est survenue.';
}

export function fichierUrl(id: number, telecharger = false): string {
  // Démonstration hors ligne : adresse blob: d'un aperçu généré dans la page (src/demo).
  if (import.meta.env.MODE === 'demo') return (globalThis as unknown as { __evocomDemo: { fichierUrl(id: number): string } }).__evocomDemo.fichierUrl(id);
  return `/api/fichiers/${id}/contenu${telecharger ? '?telecharger=1' : ''}`;
}
