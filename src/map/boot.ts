// The map page's only side-effectful entry: map.html loads dist/map.js,
// which is this file. Everything else in src/map/ is importable inert.
import { main } from './map.js';

main();
