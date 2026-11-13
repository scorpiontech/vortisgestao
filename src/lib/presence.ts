/** Usuário é considerado online se enviou sinal nos últimos 4 minutos (heartbeat a cada 2). */
export const ONLINE_WINDOW_MS = 4 * 60 * 1000;
export const isOnline = (p: { online: boolean; last_seen_at: string } | undefined, now = Date.now()) =>
  !!p && p.online && now - new Date(p.last_seen_at).getTime() < ONLINE_WINDOW_MS;
