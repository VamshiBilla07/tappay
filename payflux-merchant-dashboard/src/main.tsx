import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/** Keeps a render crash from turning the checkout into a blank page. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('PayFlux crashed while rendering:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#edeae4] flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl border border-neutral-100 shadow-xl p-6 space-y-3">
            <h1 className="text-lg font-extrabold text-neutral-900">Something broke while rendering</h1>
            <p className="text-sm text-neutral-500">
              Nothing was sent on-chain. Reload the page, and if it keeps happening check the browser console.
            </p>
            <pre className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 overflow-auto max-h-40 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-bold cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
