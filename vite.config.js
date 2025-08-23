import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        content: 'src/content.ts',
        options: 'src/options/options.ts',
        background: 'src/background.ts'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    target: 'es2020',
    minify: 'terser',
    sourcemap: false
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'public/manifest.json',
          dest: '.'
        },
        {
          src: 'public/icons/*',
          dest: 'icons'
        },
        {
          src: 'src/options/options.html',
          dest: '.',
          rename: 'options.html'
        },
        {
          src: 'src/options/options.css', 
          dest: '.'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});