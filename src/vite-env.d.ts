/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Öffentliche URL der Supabase Edge Function „route“ (Routing-Proxy, kein Geheimnis). Leer = FOSSGIS-OSRM-Prototyp. */
  readonly VITE_ROUTING_PROXY_URL?: string;
}
