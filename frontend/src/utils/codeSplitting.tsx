/**
 * OptiPlan 360 - Code Splitting Components
 * Lazy loading ve code splitting utility'leri
 */

import React, { Suspense, lazy, ComponentType, ReactNode } from 'react';
import { CircularProgress, Box, Typography, LinearProgress } from '@mui/material';

// Loading component props
interface LoadingProps {
  message?: string;
  progress?: number;
}

// Default loading component
export const DefaultLoading: React.FC<LoadingProps> = ({ 
  message = 'Yükleniyor...', 
  progress 
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      p: 3
    }}
  >
    <CircularProgress size={40} sx={{ mb: 2 }} />
    <Typography variant="body2" color="textSecondary">
      {message}
    </Typography>
    {progress !== undefined && (
      <Box sx={{ width: '100%', maxWidth: 300, mt: 2 }}>
        <LinearProgress variant="determinate" value={progress} />
      </Box>
    )}
  </Box>
);

// Skeleton loading for lists
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <Box sx={{ p: 2 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Box
        key={i}
        sx={{
          height: 60,
          bgcolor: 'grey.100',
          borderRadius: 1,
          mb: 1,
          animation: 'pulse 1.5s ease-in-out infinite',
          '@keyframes pulse': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.5 },
            '100%': { opacity: 1 }
          }
        }}
      />
    ))}
  </Box>
);

// Code splitting with retry
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries: number = 3,
  retryDelay: number = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | undefined;
    
    for (let i = 0; i < retries; i++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error as Error;
        
        // Wait before retrying
        if (i < retries - 1) {
          await new Promise(resolve => 
            setTimeout(resolve, retryDelay * Math.pow(2, i))
          );
        }
      }
    }
    
    throw lastError;
  });
}

// Preload component
export const preloadComponent = <T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): Promise<{ default: T }> => {
  return factory();
};

// Lazy route component
interface LazyRouteProps {
  component: React.LazyExoticComponent<ComponentType<unknown>>;
  loadingComponent?: ReactNode;
  fallback?: ReactNode;
}

export const LazyRoute: React.FC<LazyRouteProps> = ({
  component: Component,
  loadingComponent = <DefaultLoading message="Sayfa yükleniyor..." />,
  fallback,
}) => {
  return (
    <Suspense fallback={fallback ?? loadingComponent}>
      <Component />
    </Suspense>
  );
};

// Feature-based lazy loading
export const lazyFeatures = {
  // AI/ML features (lazy loaded)
  AIServiceDashboard: lazyWithRetry(() => 
    import(/* webpackChunkName: "ai-dashboard" */ '../features/AI/AIServiceDashboard')
  ),
  
  ExportProgress: lazyWithRetry(() => 
    import(/* webpackChunkName: "export-progress" */ '../features/AI/ExportProgress')
  ),
  
  LockStatus: lazyWithRetry(() => 
    import(/* webpackChunkName: "lock-status" */ '../features/AI/LockStatus')
  ),
  
  HealthDashboard: lazyWithRetry(() => 
    import(/* webpackChunkName: "health-dashboard" */ '../features/AI/HealthDashboard')
  ),
  
  // Chart components (lazy loaded)
  Charts: lazyWithRetry(() => 
    import(/* webpackChunkName: "charts" */ 'recharts')
  ),
  
  // Admin features (lazy loaded)
  AdminPanel: lazyWithRetry(() => 
    import(/* webpackChunkName: "admin-panel" */ '../features/AdminPanel')
  ),
  
  // Heavy components
  DataGrid: lazyWithRetry(() => 
    import(/* webpackChunkName: "data-grid" */ '../features/Grid/DataGrid')
  ),
  
  Kanban: lazyWithRetry(() => 
    import(/* webpackChunkName: "kanban" */ '../features/Kanban/KanbanBoard')
  ),
  
  // Reports (lazy loaded)
  ReportsAnalytics: lazyWithRetry(() => 
    import(/* webpackChunkName: "reports" */ '../features/ReportsAnalytics/ReportsDashboard')
  )
};

const handlePrefetchError = (err: unknown): void => {
  if (import.meta.env.DEV) {
    console.debug('Prefetch failed', err);
  }
};
// Prefetch on idle
export const prefetchOnIdle = (factory: () => Promise<unknown>): void => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      factory().catch(handlePrefetchError);
    }, { timeout: 2000 });
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      factory().catch(handlePrefetchError);
    }, 2000);
  }
};

// Prefetch critical features after initial load
export const prefetchCriticalFeatures = (): void => {
  // Wait for initial page load
  if (document.readyState === 'complete') {
    schedulePrefetch();
  } else {
    window.addEventListener('load', schedulePrefetch);
  }
};

function schedulePrefetch(): void {
  // Prefetch features that user might visit next
  setTimeout(() => {
    prefetchOnIdle(() => import('../features/AI/AIServiceDashboard'));
  }, 3000);
  
  setTimeout(() => {
    prefetchOnIdle(() => import('../features/AI/HealthDashboard'));
  }, 5000);
}

// Error boundary for lazy components
interface LazyErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface LazyErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class LazyErrorBoundary extends React.Component<
  LazyErrorBoundaryProps,
  LazyErrorBoundaryState
> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Lazy component error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              color: 'error.main'
            }}
          >
            <Typography variant="h6" gutterBottom>
              Bileşen yüklenirken hata oluştu
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {this.state.error?.message}
            </Typography>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                background: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Yeniden Dene
            </button>
          </Box>
        )
      );
    }

    return this.props.children;
  }
}

// Wrapped lazy component with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> => {
  return (props: P) => (
    <LazyErrorBoundary>
      <Component {...props} />
    </LazyErrorBoundary>
  );
};

// Dynamic import with loading state
export const useDynamicImport = <T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) => {
  const [component, setComponent] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    factory()
      .then((module) => {
        if (isMounted) {
          setComponent(module.default);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [factory]);

  return { component, loading, error };
};

// Export bundle info for debugging
export const getBundleInfo = (): Record<string, unknown> => {
  // This will be populated by the build process
  return {
    buildTime: process.env.REACT_APP_BUILD_TIME,
    buildVersion: process.env.REACT_APP_BUILD_VERSION,
    environment: process.env.NODE_ENV
  };
};

// Initialize prefetching
if (typeof window !== 'undefined') {
  prefetchCriticalFeatures();
}

export default {
  lazyWithRetry,
  preloadComponent,
  prefetchOnIdle,
  prefetchCriticalFeatures,
  LazyRoute,
  LazyErrorBoundary,
  withErrorBoundary,
  DefaultLoading,
  SkeletonList
};
