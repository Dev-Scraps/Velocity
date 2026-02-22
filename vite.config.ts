import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-window', 'react-virtualized-auto-sizer'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/manifest': {
        target: 'https://manifest.googlevideo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/manifest/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/api/videoplayback': {
        target: 'https://rr3---sn-cvh7knze.googlevideo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/videoplayback/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('videoplayback proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending videoplayback Request:', req.method, req.url);
            // Add required headers for Google Video CDN
            proxyReq.setHeader('Origin', 'https://www.youtube.com');
            proxyReq.setHeader('Referer', 'https://www.youtube.com/');
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received videoplayback Response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
})
