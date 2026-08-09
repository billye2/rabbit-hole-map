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

// ESM build of the pure model for node --test
await esbuild.build({
  entryPoints: ['src/model.ts'],
  outfile: 'dist/model.mjs',
  bundle: true,
  format: 'esm',
  target: 'node20',
  logLevel: 'info',
});
