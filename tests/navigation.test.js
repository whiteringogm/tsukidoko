import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {wrap,difference,compassName,moonAt,orientationBasis,guidance,readSavedLocation} from '../dist/navigation.js';
const context=vm.createContext({});context.window=context;vm.runInContext(readFileSync(new URL('../dist/vendor/suncalc.js',import.meta.url),'utf8'),context);vm.runInContext(readFileSync(new URL('../dist/vendor/geomagnetism.js',import.meta.url),'utf8'),context);
const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('north wrap takes the short turn',()=>{assert.equal(wrap(-1),359);assert.equal(difference(1,359),2);assert.equal(difference(359,1),-2);assert.equal(compassName(359),'北');assert.equal(compassName(112.5),'東南東');});
test('SunCalc published regression fixture, radians converted to north-clockwise',()=>{const m=moonAt(new Date('2013-03-05UTC'),50.5,30.5,context.SunCalc);near(m.altitude,.014551482243892251*180/Math.PI,1e-7);near(m.azimuth,(-.9783999522438226*180/Math.PI+180),1e-7);});
for(const heading of [0,90,180,270,359])test(`rear camera at heading ${heading}, elevation 30 aligns`,()=>{const result=guidance({azimuth:heading,altitude:30},orientationBasis(-heading,120,0));near(result.separation,0,1e-5);assert.equal(result.aligned,true);});
test('left/right/up/down are screen-relative',()=>{const basis=orientationBasis(0,90,0);assert.ok(guidance({azimuth:30,altitude:0},basis).horizontal>0);assert.ok(guidance({azimuth:330,altitude:0},basis).horizontal<0);assert.ok(guidance({azimuth:0,altitude:30},basis).vertical>0);assert.ok(guidance({azimuth:0,altitude:-30},basis).vertical<0);});
test('behind never counts as aligned and requests a turn',()=>{const r=guidance({azimuth:180,altitude:0},orientationBasis(0,90,0));assert.equal(r.behind,true);assert.equal(r.aligned,false);assert.ok(Math.abs(r.horizontal)>=90);});
test('zenith and rolled device remain finite',()=>{for(const beta of [89.99,90,90.01,179.99,180]){const b=orientationBasis(350,beta,30);for(const axis of Object.values(b))near(Math.hypot(...axis),1);const g=guidance({azimuth:10,altitude:90},b);assert.ok(Number.isFinite(g.separation));}});
test('10-degree capture cone uses angular separation, not separate axis thresholds',()=>{const g=guidance({azimuth:9,altitude:9},orientationBasis(0,90,0));assert.equal(g.aligned,false);});
test('saved location rejects corruption, impossible coordinates, future and stale timestamps',()=>{const now=1e9;for(const raw of ['broken','null',JSON.stringify({latitude:91,longitude:0,timestamp:now}),JSON.stringify({latitude:0,longitude:0,timestamp:now+1}),JSON.stringify({latitude:0,longitude:0,timestamp:now-86400001})])assert.equal(readSavedLocation({getItem:()=>raw},now),null);assert.equal(readSavedLocation({getItem:()=>JSON.stringify({latitude:35,longitude:139,timestamp:now-100})},now).latitude,35);});
test('WMM2025 reference at 80N 0E, 2025 epoch',()=>{const field=context.geomagnetism.model(new Date('2025-01-01T00:00:00Z')).point([80,0,0]);near(field.decl,1.28,.1);});

