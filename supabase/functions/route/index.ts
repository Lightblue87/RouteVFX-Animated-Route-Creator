// Supabase Edge Function „route“ (Deno). Logik in handler.ts; hier nur Umgebung und Datenbank-Anbindung.
// Secrets (supabase secrets set …): ORS_API_KEY, ROUTING_ALLOWED_ORIGINS, ROUTING_ENABLED, ROUTING_QUOTA_SALT,
// optional ROUTING_PER_CLIENT_DAILY (Standard 50), ROUTING_GLOBAL_DAILY (Standard 1800, unter dem ORS-Limit 2000).
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
import { handleRoute } from './handler.ts';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;

async function takeQuota(clientKey: string, perClient: number, global: number): Promise<boolean> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/routing_take_quota`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_key: clientKey, p_per_key: perClient, p_global: global }),
  });
  if (!res.ok) throw new Error(`quota rpc ${res.status}`);
  return (await res.json()) === true;
}

Deno.serve(async (req) => {
  const res = await handleRoute(
    req,
    {
      orsApiKey: env('ORS_API_KEY'),
      allowedOrigins: env('ROUTING_ALLOWED_ORIGINS'),
      enabled: env('ROUTING_ENABLED', 'false'),
      perClientDaily: Number(env('ROUTING_PER_CLIENT_DAILY', '50')),
      globalDaily: Number(env('ROUTING_GLOBAL_DAILY', '1800')),
      quotaSalt: env('ROUTING_QUOTA_SALT'),
    },
    { fetch, takeQuota },
  );
  // Nur Status loggen – keine Koordinaten, keine IP.
  console.log(`route ${req.method} -> ${res.status}`);
  return res;
});
