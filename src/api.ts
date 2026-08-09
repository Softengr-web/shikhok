export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.ok) throw new Error(body.message || 'কিছু একটা সমস্যা হয়েছে।');
  return body.data as T;
}
export const post = <T,>(path:string, body?:unknown) => api<T>(path,{method:'POST',body:JSON.stringify(body ?? {})});
export const put = <T,>(path:string, body:unknown) => api<T>(path,{method:'PUT',body:JSON.stringify(body)});
