/**
 * OptiPlan 360 - Frontend Bundle Optimizer
 * Vite/Webpack optimizasyonu ve code splitting stratejileri
 */

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Bundle Analysis Plugin
const bundleAnalyzerPlugin = (): Plugin => ({
  name: 'bundle-analyzer',
  generateBundle(options, bundle) {
    const sizes: Record<string, number> = {};
    
    for (const [fileName, chunk] of Object.entries(bundle)) {
      if ('code' in chunk) {
        sizes[fileName] = chunk.code.length;
      }
    }
    
    // Sort by size
    const sorted = Object.entries(sizes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);
    
    console.log('\n📦 Top 20 Largest Bundles:');
    console.table(sorted.map(([name, size]) => ({
      file: name,
      size: `${(size / 1024).toFixed(2)} KB`
    })));
  }
});

// Performance Budget Plugin
const performanceBudgetPlugin = (budgets: Record<string, number>): Plugin => ({
  name: 'performance-budget',
  generateBundle(options, bundle) {
    const warnings: string[] = [];
    
    for (const [fileName, chunk] of Object.entries(bundle)) {
      const budget = budgets[fileName] || budgets['*'];
      
      if (budget && 'code' in chunk) {
        const sizeKB = chunk.code.length / 1024;
        
        if (sizeKB > budget) {
          warnings.push(
            `⚠️  ${fileName}: ${sizeKB.toFixed(2)}KB exceeds budget of ${budget}KB`
          );
        }
      }
    }
    
    if (warnings.length > 0) {
      console.warn('\n🚨 Performance Budget Warnings:');
      warnings.forEach(w => console.warn(w));
    }
  }
});

// Dynamic Import Optimizer
const dynamicImportOptimizer = (): Plugin => ({
  name: 'dynamic-import-optimizer',
  renderDynamicImport({ targetModuleId }) {
    // Add prefetch hints for critical dynamic imports
    if (targetModuleId?.includes('critical')) {
      return {
        left: 'import(/* webpackPrefetch: true */ ',
        right: ')'
      };
    }
    return null;
  }
});

// Vite Configuration with Optimizations
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react({
        // Fast Refresh optimization
        fastRefresh: true,
        // JSX transform
        jsxRuntime: 'automatic'
      }),
      
      // Gzip compression
      isProduction && compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024,
        deleteOriginFile: false
      }),
      
      // Brotli compression (better than gzip)
      isProduction && compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        deleteOriginFile: false
      }),
      
      // PWA for offline support and caching
      isProduction && VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\./,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                }
              }
            }
          ]
        },
        manifest: {
          name: 'OptiPlan 360',
          short_name: 'OptiPlan',
          description: 'AI/ML Enhanced ERP Platform',
          theme_color: '#1976d2',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      }),
      
      // Bundle visualization (only in analyze mode)
      process.env.ANALYZE && visualizer({
        open: true,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/stats.html'
      }),
      
      // Custom plugins
      bundleAnalyzerPlugin(),
      performanceBudgetPlugin({
        '*': 500, // 500KB default budget
        'index.js': 300,
        'vendor.js': 800
      }),
      dynamicImportOptimizer()
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@features': path.resolve(__dirname, './src/features'),
        '@services': path.resolve(__dirname, './src/services'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@types': path.resolve(__dirname, './src/types')
      }
    },
    
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: ['console.log', 'console.info', 'console.debug']
        }
      },
      
      rollupOptions: {
        output: {
          // Manual code splitting
          manualChunks: {
            // React core
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            
            // MUI
            'mui-vendor': [
              '@mui/material',
              '@mui/icons-material',
              '@emotion/react',
              '@emotion/styled'
            ],
            
            // Charts
            'charts-vendor': ['recharts'],
            
            // AI/ML (lazy loaded)
            'ai-vendor': [
              // AI/ML libraries will be loaded on demand
            ],
            
            // Utils
            'utils-vendor': ['axios', 'date-fns', 'lodash-es']
          },
          
          // Chunk naming
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name || '';
            
            if (/\.css$/.test(info)) {
              return 'css/[name]-[hash][extname]';
            }
            
            if (/\.(png|jpe?g|svg|gif|webp|ico)$/.test(info)) {
              return 'images/[name]-[hash][extname]';
            }
            
            if (/\.(woff2?|ttf|otf|eot)$/.test(info)) {
              return 'fonts/[name]-[hash][extname]';
            }
            
            return 'assets/[name]-[hash][extname]';
          }
        }
      },
      
      // CSS optimization
      cssCodeSplit: true,
      cssMinify: true,
      
      // Asset optimization
      assetsInlineLimit: 4096, // 4KB
      
      // Chunk size warning
      chunkSizeWarningLimit: 500 // 500KB
    },
    
    optimizeDeps: {
      // Pre-bundle these dependencies
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@mui/material',
        '@mui/icons-material',
        'axios',
        'date-fns'
      ],
      
      // Exclude from pre-bundling
      exclude: [
        // Large libraries that should be lazy loaded
      ]
    },
    
    server: {
      // Dev server optimizations
      hmr: {
        overlay: true
      },
      
      // Pre-bundle dependencies on startup
      preTransformRequests: true
    },
    
    preview: {
      // Preview server config
      port: 4173,
      strictPort: true
    },
    
    // Experimental features
    experimental: {
      // Render built time optimization
      renderBuiltUrl(filename, { hostType }) {
        // Use CDN for production assets
        if (isProduction && hostType === 'js') {
          return {
            runtime: `window.__ASSET_CDN__ + ${JSON.stringify(filename)}`
          };
        }
        return { relative: true };
      }
    }
  };
});

// Performance Monitoring Utility
export class BundlePerformanceMonitor {
  private static metrics: PerformanceEntry[] = [];
  
  static init(): void {
    // Monitor Core Web Vitals
    if ('web-vitals' in window) {
      import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
        getCLS(console.log);
        getFID(console.log);
        getFCP(console.log);
        getLCP(console.log);
        getTTFB(console.log);
      });
    }
    
    // Monitor resource loading
    if (window.performance) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const resources = performance.getEntriesByType('resource');
          this.metrics = resources;
          
          this.analyzePerformance();
        }, 0);
      });
    }
  }
  
  private static analyzePerformance(): void {
    const jsResources = this.metrics.filter(r => 
      r.name.includes('.js')
    );
    
    const cssResources = this.metrics.filter(r => 
      r.name.includes('.css')
    );
    
    const totalJS = jsResources.reduce((sum, r) => sum + (r as PerformanceResourceTiming).transferSize, 0);
    const totalCSS = cssResources.reduce((sum, r) => sum + (r as PerformanceResourceTiming).transferSize, 0);
    
    console.log('📊 Bundle Performance Report:');
    console.log(`   JavaScript: ${(totalJS / 1024).toFixed(2)} KB`);
    console.log(`   CSS: ${(totalCSS / 1024).toFixed(2)} KB`);
    console.log(`   Total Resources: ${this.metrics.length}`);
    
    // Warn if bundle is too large
    if (totalJS > 1024 * 1024) { // 1MB
      console.warn('⚠️ JavaScript bundle exceeds 1MB. Consider code splitting.');
    }
  }
  
  static getLargestChunks(n: number = 5): PerformanceEntry[] {
    return this.metrics
      .filter(r => r.entryType === 'resource')
      .sort((a, b) => {
        const sizeA = (a as PerformanceResourceTiming).transferSize;
        const sizeB = (b as PerformanceResourceTiming).transferSize;
        return sizeB - sizeA;
      })
      .slice(0, n);
  }
}

// Lazy loading helper with prefetching
export const lazyWithPrefetch = <T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  prefetchDeps?: (() => Promise<unknown>)[]
) => {
  const LazyComponent = React.lazy(factory);
  
  // Prefetch dependencies
  if (prefetchDeps) {
    prefetchDeps.forEach(dep => {
      // Preload in background
      requestIdleCallback(() => {
        dep().catch(() => {});
      });
    });
  }
  
  return LazyComponent;
};

// Image optimization helper
export const getOptimizedImageUrl = (
  src: string,
  options: { width?: number; height?: number; quality?: number; format?: string } = {}
): string => {
  const { width, height, quality = 80, format = 'webp' } = options;
  
  // If using a CDN or image optimization service
  if (src.includes('cdn.')) {
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    params.append('q', quality.toString());
    params.append('f', format);
    
    return `${src}?${params.toString()}`;
  }
  
  return src;
};

// Preload critical resources
export const preloadCriticalResources = (resources: { href: string; as: string; type?: string }[]): void => {
  resources.forEach(({ href, as, type }) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    if (type) link.type = type;
    document.head.appendChild(link);
  });
};

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  BundlePerformanceMonitor.init();
}

export default BundlePerformanceMonitor;
