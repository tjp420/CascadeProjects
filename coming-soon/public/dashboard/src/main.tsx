import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/globals.css';
import { clearAuthAndRedirect } from './config';

const rootEl = document.getElementById('app-main') || document.getElementById('root');

if (rootEl) {
    // Wrap global fetch so any 401 from API triggers auth clear + redirect to signin.
    // This ensures hosted preview pages gracefully redirect users to sign-in
    // instead of silently failing with repeated 401 errors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).fetch) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const _origFetch = (window as any).fetch;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).fetch = async function (input: any, init?: any) {
            try {
                const resp = await _origFetch(input, init);
                try {
                    if (resp && resp.status === 401) {
                        clearAuthAndRedirect();
                    }
                } catch (e) {
                    // ignore
                }
                return resp;
            } catch (e) {
                throw e;
            }
        };
    }
    const root = ReactDOM.createRoot(rootEl);
    root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </React.StrictMode>
    );
}
