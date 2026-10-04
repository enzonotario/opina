import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Opina',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2019',
    minify: true,
    sourcemap: process.env.OPINA_WIDGET_SOURCEMAP === '1',
  },
})
