import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0'),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react'
          return undefined
        },
      },
    },
  },
})
