import { RoutingError, type RoutingProvider, type RoutingRequest, type RoutingResult } from '../../core/types';
import { estimatedProvider, greatCircleProvider } from './local';

export interface RoutingSettings {
  /** Nutzer hat der Übertragung von Routenpunkten an Online-Dienste zugestimmt. */
  onlineAllowed: boolean;
  online?: RoutingProvider;
}

/**
 * Wählt je Modus den besten erlaubten Provider. Fällt bei fehlendem Online-Opt-in oder Fehler
 * auf eine *gekennzeichnete* Schätzung zurück – nie stillschweigend als echte Route.
 */
export async function routeSegment(req: RoutingRequest, settings: RoutingSettings, signal?: AbortSignal): Promise<{ results: RoutingResult[]; fallbackReason?: string }> {
  if (req.mode === 'plane') return { results: await greatCircleProvider.route(req, signal) };
  const online = settings.online;
  if (online && online.supportedModes.includes(req.mode)) {
    if (!settings.onlineAllowed) {
      return { results: await estimatedProvider.route(req), fallbackReason: 'online_routing_disabled' };
    }
    try {
      return { results: await online.route({ ...req, alternatives: true }, signal) };
    } catch (e) {
      if (e instanceof RoutingError && e.code === 'aborted') throw e;
      return { results: await estimatedProvider.route(req), fallbackReason: e instanceof RoutingError ? e.code : 'network' };
    }
  }
  return { results: await estimatedProvider.route(req) };
}
