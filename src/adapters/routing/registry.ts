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
/**
 * `usedOnline` ist true, sobald eine Anfrage an den Online-Provider ging (auch wenn sie fehlschlug) –
 * Grundlage für die Datenschutz-Kennzeichnung des Projekts.
 */
export async function routeSegment(req: RoutingRequest, settings: RoutingSettings, signal?: AbortSignal): Promise<{ results: RoutingResult[]; fallbackReason?: string; usedOnline: boolean }> {
  if (req.mode === 'plane') return { results: await greatCircleProvider.route(req, signal), usedOnline: false };
  const online = settings.online;
  if (online && online.supportedModes.includes(req.mode)) {
    if (!settings.onlineAllowed) {
      return { results: await estimatedProvider.route(req), fallbackReason: 'online_routing_disabled', usedOnline: false };
    }
    try {
      return { results: await online.route({ ...req, alternatives: true }, signal), usedOnline: true };
    } catch (e) {
      if (e instanceof RoutingError && e.code === 'aborted') throw e;
      return { results: await estimatedProvider.route(req), fallbackReason: e instanceof RoutingError ? e.code : 'network', usedOnline: true };
    }
  }
  return { results: await estimatedProvider.route(req), usedOnline: false };
}
