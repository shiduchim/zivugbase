/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/* Lists every file in public/ so the service worker can precache it. */
function publicFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? publicFiles(full, base) : [relative(base, full).replaceAll('\\', '/')];
  });
}

/* Builds src/sw/sw.ts into /sw.js and injects the precache list and a build version. The
   service worker is written by hand (no plugin) so the share-target queue stays in our control. */
function serviceWorker(): Plugin {
  return {
    name: 'zivugbase-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const sw = bundle['sw.js'];
      if (!sw || sw.type !== 'chunk') throw new Error('sw.js was not built');
      const built = Object.keys(bundle).filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const files = ['./', ...built, ...publicFiles(resolve('public'))].map((f) => (f.startsWith('./') ? f : './' + f));
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      sw.code = sw.code
        .replace('"__PRECACHE__"', JSON.stringify(files))
        .replace('__BUILD_VERSION__', version);
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), serviceWorker()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: { index: resolve('index.html'), sw: resolve('src/sw/sw.ts') },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js')
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['fake-indexeddb/auto']
  }
});
