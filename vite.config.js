import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Entry point
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'VirtualAdvisor',
      fileName: (format) => `virtual-advisor.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      output: {
        // Ensure UMD build has the correct global name
        globals: {
          'virtual-advisor': 'VirtualAdvisor'
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  
  // Development server
  server: {
    port: 3000,
    open: '/test/example.html'
  },
  
  // CSS handling
  css: {
    modules: false
  },
  
  // Public directory
  publicDir: 'test'
});