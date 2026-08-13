import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: {
    background: 'src/background.ts',
    map: 'src/map/map.ts',
    popup: 'src/popup/popup.ts',
    options: 'src/options/options.ts',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome120',
  sourcemap: false,
  logLevel: 'info',
});

// ESM build of the pure modules for node --test. Adding an entry point here
// is what puts a module on the unit-test seam.
await esbuild.build({
  entryPoints: {
    model: 'src/model.ts',
    gameplay: 'src/map/gameplay.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  format: 'esm',
  target: 'node20',
  logLevel: 'info',
});
