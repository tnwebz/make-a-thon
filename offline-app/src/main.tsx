import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            maxWidth: '400px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#e11d48', margin: '0 0 12px 0' }}>
              SkillForge Offline Error
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0', wordBreak: 'break-word' }}>
              {this.state.error?.message || 'An unexpected error occurred while initializing.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#0f172a',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Restart App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
