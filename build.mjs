import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: {
    background: 'src/background.ts',
    map: 'src/map/boot.ts',
    popup: 'src/popup/popup.ts',
    options: 'src/options/options.ts',
  },
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'chrome120',
  sourcemap: false,
  logLevel: 'info',
  // Sprite frames ride inside the bundle as data URLs: no manifest entries,
  // no web_accessible_resources, and the PNG export's SVG clone keeps them.
  loader: { '.png': 'dataurl' },
});

// ESM build of the pure modules for node --test. Adding an entry point here
// is what puts a module on the unit-test seam.
await esbuild.build({
  entryPoints: {
    model: 'src/model.ts',
    gameplay: 'src/map/gameplay.ts',
    schema: 'src/schema.ts',
    storage: 'src/storage.ts',
    force: 'src/map/force.ts',
    view: 'src/map/view.ts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  format: 'esm',
  target: 'node20',
  logLevel: 'info',
});
