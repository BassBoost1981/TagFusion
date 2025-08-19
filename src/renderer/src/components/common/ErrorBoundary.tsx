import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Report error to logging service if available
    if (window.electronAPI?.logging?.logError) {
      window.electronAPI.logging.logError({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p className="error-boundary-message">
              An unexpected error occurred. You can try to reload the application or continue with limited functionality.
            </p>
            
            <div className="error-boundary-actions">
              <button 
                className="error-boundary-button primary"
                onClick={this.handleReload}
              >
                Reload Application
              </button>
              <button 
                className="error-boundary-button secondary"
                onClick={this.handleReset}
              >
                Continue Anyway
              </button>
            </div>

            <details className="error-boundary-details">
              <summary>Technical Details</summary>
              <div className="error-boundary-error-info">
                <h4>Error Message:</h4>
                <pre>{this.state.error?.message}</pre>
                
                {this.state.error?.stack && (
                  <>
                    <h4>Stack Trace:</h4>
                    <pre className="error-boundary-stack">
                      {this.state.error.stack}
                    </pre>
                  </>
                )}
                
                {this.state.errorInfo?.componentStack && (
                  <>
                    <h4>Component Stack:</h4>
                    <pre className="error-boundary-stack">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to handle errors
export const useErrorHandler = () => {
  const handleError = (error: Error, errorInfo?: string) => {
    console.error('Error caught by useErrorHandler:', error);
    
    // Report error to logging service if available
    if (window.electronAPI?.logging?.logError) {
      window.electronAPI.logging.logError({
        message: error.message,
        stack: error.stack,
        additionalInfo: errorInfo,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return { handleError };
};

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};
