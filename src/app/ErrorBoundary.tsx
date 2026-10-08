import { Component, type ReactNode } from 'react';

/** Fängt Renderfehler ab. Lokale Projekte bleiben unberührt (IndexedDB wird hier nicht verändert). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen center" role="alert">
        <h1>Fehler / Error</h1>
        <p>Die App ist auf einen Fehler gestoßen. Deine lokalen Projekte wurden nicht verändert.</p>
        <p>The app hit an error. Your local projects were not modified.</p>
        <pre className="diag">{this.state.error.name}: {this.state.error.message.slice(0, 300)}</pre>
        <button className="btn primary" onClick={() => location.reload()}>Neu laden / Reload</button>
      </div>
    );
  }
}
