import {mkdir,copyFile,readFile,rm,stat,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=process.cwd(),dist=resolve(root,'dist');
if(dist!==resolve(root,'dist'))throw Error('Invalid build directory');
// Only generated deployment output is replaced. Source artwork stays intact.
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
const html=(await Promise.all(['index.html','events.html','community.html'].map(file=>readFile(file,'utf8')))).join('\n');
const files=new Set(['index.html','events.html','community.html','dj.html','dj-panel.js','notifications.js','community-chat.js','performance-utils.js','vendor/supabase-2.118.0.min.js','vendor/SUPABASE-LICENSE','events-data.js','events.js','dispatch-data.js','offline.html','station-config.js','radio-player.js','player-loader.js','navigation.js','pwa.js','sw.js','manifest.webmanifest',...[...html.matchAll(/(?:src|href)="(assets\/[^"?#]+)"/g)].map(m=>m[1])]);
for(const name of await readdir('assets/fonts'))if(/\.(?:woff2|css|txt)$/.test(name))files.add('assets/fonts/'+name);
for(const size of [192,512])files.add(`assets/ukr-pwa-${size}.png`);
let bytes=0;
for(const file of files){
 const source=resolve(root,file);
 const target=resolve(dist,file);if(!target.startsWith(dist+'/')&&!target.startsWith(dist+'\\'))throw Error('Unsafe asset path');
 await mkdir(dirname(target),{recursive:true});await copyFile(source,target);bytes+=(await stat(target)).size;
}
console.log(`Built ${files.size} files (${bytes.toLocaleString()} bytes). Original artwork excluded from deployment.`);
