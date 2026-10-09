import type { RoutingProvider } from '../../core/types';
import { createOrsProxyProvider } from './orsProxy';
import { createOsrmProvider } from './osrm';

/**
 * Online-Routing-Anbieter. Mit VITE_ROUTING_PROXY_URL (öffentliche URL der Supabase Edge Function „route“)
 * wird openrouteservice über den eigenen Proxy genutzt; ohne URL bleibt der FOSSGIS-OSRM-Demoserver als
 * Prototyp (Best-Effort, vor öffentlichem Start zu ersetzen – ADR-004).
 */
export function createOnlineRoutingProvider(proxyUrl = (import.meta.env.VITE_ROUTING_PROXY_URL as string | undefined)?.trim()): RoutingProvider {
  return proxyUrl ? createOrsProxyProvider(proxyUrl) : createOsrmProvider();
}
