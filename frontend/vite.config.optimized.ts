import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // Bundle optimization
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
      mangle: {
        safari10: true,
      },
    },
    
    // Chunk optimization
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main.tsx'),
        vendor: resolve(__dirname, 'src/vendor.ts'),
      },
      output: {
        manualChunks: {
          // Core framework chunks
          react: ['react', 'react-dom', 'react-router-dom'],
          
          // UI library chunks
          ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          
          // Utility chunks
          utils: ['date-fns', 'clsx', 'tailwind-merge'],
          
          // API client chunk
          api: ['./src/services/apiClient.ts'],
          
          // Charts and visualization
          charts: ['recharts'],
          
          // Forms and validation
          forms: ['react-hook-form', '@hookform/resolvers/zod'],
          
          // File handling
          files: ['file-saver', 'xlsx'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    
    // Code splitting
    cssCodeSplit: true,
    
    // Asset optimization
    assetsInlineLimit: 4096, // Inline small assets
    
    // Source maps for debugging
    sourcemap: false, // Disabled for production
    
    // Report compression
    reportCompressedSize: true,
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500,
  },
  
  // Optimization plugins
  plugins: [
    // Bundle analyzer
    process.env.NODE_ENV === 'analyze' && 
      (await import('rollup-plugin-visualizer')).default({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  
  // Resolve optimization
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  
  // CSS optimization
  css: {
    devSourcemap: false,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },
  
  // Server configuration for preview
  server: {
    port: 4173,
    host: true,
  },
  
  // Preview configuration
  preview: {
    port: 4173,
    host: true,
  },
  
  // Environment-specific optimization
  define: {
    __VITE_OPTIMIZED__: JSON.stringify(true),
    __VITE_CHUNK_SIZE_WARNING__: JSON.stringify(500),
  },
});
