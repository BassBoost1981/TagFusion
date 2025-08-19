import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  overlay?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  overlay = false,
  className = '',
}) => {
  const spinnerClass = `loading-spinner ${size} ${className}`;
  const containerClass = overlay ? 'loading-spinner-overlay' : 'loading-spinner-container';

  return (
    <div className={containerClass}>
      <div className="loading-spinner-content">
        <div className={spinnerClass}>
          <div className="spinner-ring">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
        {message && <div className="loading-spinner-message">{message}</div>}
      </div>
    </div>
  );
};

interface LoadingStateProps {
  isLoading: boolean;
  error?: string | null;
  children: React.ReactNode;
  loadingMessage?: string;
  errorFallback?: React.ReactNode;
  onRetry?: () => void;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  error,
  children,
  loadingMessage = 'Loading...',
  errorFallback,
  onRetry,
}) => {
  if (error) {
    if (errorFallback) {
      return <>{errorFallback}</>;
    }

    return (
      <div className="loading-state-error">
        <div className="error-icon">⚠️</div>
        <div className="error-message">{error}</div>
        {onRetry && (
          <button className="retry-button" onClick={onRetry}>
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner message={loadingMessage} overlay />;
  }

  return <>{children}</>;
};

// Hook for managing loading states
export const useLoadingState = (initialLoading = false) => {
  const [isLoading, setIsLoading] = React.useState(initialLoading);
  const [error, setError] = React.useState<string | null>(null);

  const startLoading = React.useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const stopLoading = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  const setLoadingError = React.useCallback((errorMessage: string) => {
    setIsLoading(false);
    setError(errorMessage);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const reset = React.useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setLoadingError,
    clearError,
    reset,
  };
};

// Higher-order component for adding loading states
export const withLoadingState = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const WrappedComponent = (props: P & { isLoading?: boolean; error?: string; loadingMessage?: string }) => {
    const { isLoading, error, loadingMessage, ...componentProps } = props;

    return (
      <LoadingState
        isLoading={isLoading || false}
        error={error}
        loadingMessage={loadingMessage}
      >
        <Component {...(componentProps as P)} />
      </LoadingState>
    );
  };

  WrappedComponent.displayName = `withLoadingState(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};
