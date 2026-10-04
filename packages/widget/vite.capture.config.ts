import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/capture.ts'),
      name: 'OpinaCapture',
      formats: ['iife'],
      fileName: () => 'capture.js',
    },
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    target: 'es2019',
    minify: true,
    sourcemap: false,
  },
})
