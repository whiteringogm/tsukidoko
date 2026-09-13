import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const html=readFileSync('dist/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))assert.ok(existsSync('dist/'+match[1]),`Missing ${match[1]}`);
const manifest=JSON.parse(readFileSync('dist/manifest.json','utf8'));
for(const icon of manifest.icons){const b=readFileSync('dist/'+icon.src);assert.equal(b.toString('hex',1,4),'504e47');assert.equal(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`,icon.sizes);}
for(const file of [...readdirSync('dist').filter(f=>f.endsWith('.js')).map(f=>'dist/'+f),'dist/vendor/suncalc.js','dist/vendor/geomagnetism.js'])execFileSync(process.execPath,['--check',file]);
const sw=readFileSync('dist/sw.js','utf8');for(const m of sw.matchAll(/'\.\/([^']*)'/g))assert.ok(existsSync('dist/'+(m[1]||'index.html')),`Cache asset missing: ${m[1]}`);
console.log('Entrypoints, local assets, manifest icons, cache list and JavaScript syntax verified.');
