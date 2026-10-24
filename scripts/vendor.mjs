// Copies three.js (core + the postprocessing addons the game uses) and the two fonts into www/vendor,
// so the app runs fully offline inside the Android WebView. Run once after `npm install`.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
const nm = 'node_modules';
const out = 'www/vendor';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/three/addons`, { recursive: true });
mkdirSync(`${out}/fonts`, { recursive: true });
cpSync(`${nm}/three/build/three.module.js`, `${out}/three/three.module.js`);
for (const dir of ['postprocessing', 'shaders']) cpSync(`${nm}/three/examples/jsm/${dir}`, `${out}/three/addons/${dir}`, { recursive: true });
cpSync(`${nm}/three/LICENSE`, `${out}/three/LICENSE`);
cpSync(`${nm}/@fontsource/bungee/files/bungee-latin-400-normal.woff2`, `${out}/fonts/bungee-400.woff2`);
for (const w of [400, 600, 700]) cpSync(`${nm}/@fontsource/chakra-petch/files/chakra-petch-latin-${w}-normal.woff2`, `${out}/fonts/chakra-petch-${w}.woff2`);
console.log('vendor files copied to', out);
