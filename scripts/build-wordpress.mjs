import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = process.env.BDS_BUILD_MODULES || path.join(repo, 'wordpress/build-tools/node_modules');
const require = createRequire(path.join(modules, '../package.json'));
const esbuild = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const source = path.join(repo, 'frontend/src');
const build = path.join(repo, 'wordpress/bds-marvel-app/build');
await fs.rm(build, { recursive: true, force: true });
await fs.mkdir(path.join(build, 'static'), { recursive: true });
const routeCSSBuild = await esbuild.build({
  entryPoints: { stays: path.join(source, 'stays/route.css'), owner: path.join(source, 'owner/owner.css') },
  bundle: true, minify: true, outdir: path.join(build, 'static/css'),
  entryNames: '[name].[hash]', assetNames: '../media/[name].[hash]',
  loader: { '.png': 'file', '.svg': 'file' }, nodePaths: [modules], metafile: true,
  target: 'es2020', legalComments: 'none',
});
const routeCSS = {};
for (const [file, meta] of Object.entries(routeCSSBuild.metafile.outputs)) {
  if (file.endsWith('.css') && meta.entryPoint) {
    const group = meta.entryPoint.endsWith('route.css') ? 'stays' : 'owner';
    routeCSS[group] = '../css/' + path.basename(file);
  }
}
const result = await esbuild.build({
  entryPoints: [path.join(source, 'index.js')], bundle: true, minify: true, jsx: 'automatic', jsxImportSource: 'bds-editable',
  outdir: path.join(build, 'static'), entryNames: '[ext]/main.[hash]', chunkNames: 'chunks/[name]-[hash]', assetNames: 'media/[name].[hash]',
  format: 'esm', splitting: true, target: 'es2020',
  loader: { '.js': 'jsx', '.png': 'file', '.svg': 'file', '.gif': 'file' },
  alias: { '@': source, 'bds-editable/jsx-runtime': path.join(source, 'wordpress-jsx-runtime.js') }, nodePaths: [modules], metafile: true,
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.PUBLIC_URL': '""',
    'process.env.REACT_APP_WORDPRESS_MODE': '"true"', 'process.env.REACT_APP_BACKEND_URL': '""',
    'process.env.REACT_APP_BDS_STAYS_CSS': JSON.stringify(routeCSS.stays),
    'process.env.REACT_APP_BDS_OWNER_CSS': JSON.stringify(routeCSS.owner) },
  plugins: [{ name: 'route-css', setup(build) {
    build.onLoad({ filter: /(?:stays\/stays|owner\/owner|leaflet)\.css$/ }, () => ({ contents: '', loader: 'empty' }));
  } }],
  legalComments: 'linked'
});
const outputs = Object.keys(result.metafile.outputs).map(p => path.resolve(p));
const sandbox = { module: { exports: {} }, require };
vm.runInNewContext(await fs.readFile(path.join(repo, 'frontend/tailwind.config.js'), 'utf8'), sandbox);
const config = sandbox.module.exports;
// Scan every bundled route, including lazy chunks, instead of unused UI files.
config.content = Object.keys(result.metafile.inputs)
  .map(p => path.resolve(p)).filter(p => p.startsWith(source + path.sep) && /\.[jt]sx?$/.test(p));
// Tailwind directives live in index.css; transform every CSS output because
// code splitting can emit additional stylesheets for lazy-loaded modules.
for (const cssFile of outputs.filter(p => p.endsWith('.css'))) {
  const css = await fs.readFile(cssFile, 'utf8');
  const processed = await postcss([tailwind(config), autoprefixer]).process(css, { from: cssFile, to: cssFile, map: false });
  const minified = await esbuild.transform(processed.css, { loader: 'css', minify: true, target: 'es2020', legalComments: 'none' });
  await fs.writeFile(cssFile, minified.code);
}
await fs.cp(path.join(repo, 'frontend/public/clients'), path.join(build, 'clients'), { recursive: true });
const sourceEntry = path.resolve(source, 'index.js');
const rootEntry = Object.entries(result.metafile.outputs).find(([file, meta]) =>
  file.endsWith('.js') && meta.entryPoint && path.resolve(meta.entryPoint) === sourceEntry
) ;
const jsEntrypoint = rootEntry?.[0];
const rootCSS = rootEntry?.[1].cssBundle && path.resolve(rootEntry[1].cssBundle);
// Esbuild hoists the app's imported CSS into the root stylesheet. Route CSS
// outputs are duplicates and aren't needed as separate browser requests.
for (const cssFile of outputs.filter(p => p.endsWith('.css') && p !== rootCSS)) {
  await fs.rm(cssFile, { force: true });
}
const entrypoints = [rootCSS, jsEntrypoint && path.resolve(jsEntrypoint)]
  .filter(Boolean).map(p => path.relative(build, p));
if (rootCSS) {
  const cssContent = await fs.readFile(rootCSS);
  const cssName = `main.${createHash('sha256').update(cssContent).digest('hex').slice(0, 12)}.css`;
  const finalCSS = path.join(path.dirname(rootCSS), cssName);
  await fs.rename(rootCSS, finalCSS);
  entrypoints[entrypoints.findIndex(p => p.endsWith('.css'))] = path.relative(build, finalCSS);
}
await fs.writeFile(path.join(build, 'asset-manifest.json'), JSON.stringify({ entrypoints }, null, 2));
// One authoritative listing catalogue for server-side pricing and guest capacity.
const app = await fs.readFile(path.join(source, 'App.js'), 'utf8');
const dataText = app.match(/const stays = (?:wordpressContent\("stays", )?(\[[\s\S]*?\n\])\)?;/)[1];
const stays = (new Function(`return ${dataText}`))();
const bookingCatalogue = stays.map(s => ({
  slug: s.slug,
  name: s.name,
  guests: s.guests,
  nightly: Number(s.price.replace(/[^\d]/g, '')),
  booking_mode: s.bookingMode === 'instant' ? 'instant' : 'request'
}));
const catalogueJSON = JSON.stringify(bookingCatalogue, null, 2);
await fs.writeFile(path.join(repo, 'wordpress/bds-marvel-app/includes/stays.json'), catalogueJSON);
await fs.writeFile(path.join(repo, 'backend/stays.json'), catalogueJSON);
console.log(`Built ${entrypoints.length} entrypoints and ${stays.length} stay records.`);
