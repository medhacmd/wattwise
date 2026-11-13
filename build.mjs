import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/public', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('styles.css', 'dist/styles.css');
await cp('app.js', 'dist/app.js');
await cp('public/manus-routes.json', 'dist/manus-routes.json');
console.log('Wattwise static build ready in dist/');
