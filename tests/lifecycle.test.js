import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as navigation from '../dist/navigation.js';
function app({permission='granted',below=false}={}){
 const elements=new Map(),listeners={},intervals=[];let success,error,clickActive=false,requestedInClick=false,clock=10000,tool;
 const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,disabled:false,style:{},parentElement:{clientWidth:280},events:{},addEventListener(n,f){this.events[n]=f;}});return elements.get(id);};
 const context=vm.createContext({...navigation,console,Date,Math,Number,Promise,Error,Object,Array,JSON,performance:{now:()=>clock},setInterval:(f,ms)=>intervals.push({f,ms}),setTimeout:()=>{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{hidden:false,getElementById:element,addEventListener(n,f){listeners['document:'+n]=f;},modelContext:{registerTool(t){tool=t;}}},navigator:{onLine:true,geolocation:{watchPosition(ok,err){success=ok;error=err;return 1;},clearWatch(){}}},SunCalc:{getMoonPosition:()=>({azimuth:Math.PI,altitude:(below?-30:30)*Math.PI/180}),getMoonIllumination:()=>({phase:.5,fraction:1})},geomagnetism:{model:()=>({point:()=>({decl:0,h:30000})})}});
 context.window=context;context.isSecureContext=true;context.innerWidth=390;context.innerHeight=844;context.DeviceOrientationEvent={requestPermission(){requestedInClick=clickActive;return Promise.resolve(permission);}};context.addEventListener=(n,f)=>listeners[n]=f;
 let source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/,'');vm.runInContext(source,context);
 return {elements,context,listeners,intervals,get tool(){return tool;},get requestedInClick(){return requestedInClick;},async click(id){clickActive=true;const p=element(id).events.click();clickActive=false;await p;},locate(){success({coords:{latitude:35,longitude:139,accuracy:10},timestamp:Date.now()});},denyLocation(){error({code:1});},emit(e){listeners.deviceorientation(e);},advance(ms){clock+=ms;for(const i of intervals)if(i.ms<=ms)i.f();}};
}
test('permission is requested in the click; denial preserves moon fallback',async()=>{const a=app({permission:'denied'});await a.click('locate');a.locate();await a.click('sensor');assert.equal(a.requestedInClick,true);assert.match(a.elements.get('sensor-status').textContent,/許可されなかった/);assert.match(a.elements.get('message').textContent,/高度30/);assert.equal(a.elements.get('sensor').hidden,false);});
test('position denial shows required-location message',async()=>{const a=app();await a.click('locate');a.denyLocation();assert.equal(a.elements.get('message').textContent,'位置情報が必要です');assert.equal(a.elements.get('locate').disabled,false);});
test('iOS calibrates flat then aims rear camera, stops on bad accuracy',async()=>{const a=app();await a.click('locate');a.locate();await a.click('sensor');a.emit({alpha:45,beta:0,gamma:0,webkitCompassHeading:0,webkitCompassAccuracy:5});for(let i=0;i<30;i++){a.emit({alpha:45,beta:120,gamma:0,webkitCompassHeading:180,webkitCompassAccuracy:5});a.advance(70);}assert.equal(a.elements.get('message').textContent,'🌕 この先');a.emit({alpha:45,beta:120,gamma:0,webkitCompassHeading:180,webkitCompassAccuracy:-1});assert.match(a.elements.get('message').textContent,/高度30/);});
test('relative alpha alone is never used as north; absolute sensor works',async()=>{const a=app();await a.click('locate');a.locate();await a.click('sensor');a.emit({alpha:0,beta:120,gamma:0,absolute:false});assert.match(a.elements.get('sensor-status').textContent,/取得できない/);a.emit({alpha:0,beta:120,gamma:0,absolute:true});assert.equal(a.elements.get('message').textContent,'🌕 この先');a.advance(5000);assert.match(a.elements.get('sensor-status').textContent,/更新が止まった/);assert.notEqual(a.elements.get('message').textContent,'🌕 この先');});
test('below-horizon message wins over sensor guidance',async()=>{const a=app({below:true});await a.click('locate');a.locate();await a.click('sensor');a.emit({alpha:0,beta:60,gamma:0,absolute:true});assert.equal(a.elements.get('message').textContent,'いま月は地平線の下です');});
test('read-only moon tool exposes no location coordinates and rejects invalid input',async()=>{const a=app();assert.equal(a.tool.execute({}).status,'location_required');await a.click('locate');a.locate();const r=a.tool.execute({});assert.equal(r.status,'ready');assert.equal(r.latitude,undefined);assert.throws(()=>a.tool.execute({latitude:0}));});
test('forget removes displayed moon and prevents late geolocation callbacks',async()=>{const a=app();await a.click('locate');a.locate();await a.click('forget');a.locate();assert.equal(a.elements.get('message').textContent,'位置情報が必要です');assert.equal(a.elements.get('azimuth').textContent,'—');});
test('service worker precaches full shell and serves navigation offline in a subpath',async()=>{
 const handlers={},files=new Map(),names=['unrelated-cache','tsukidoko-old'];let removed=[];
 const scope='https://example.com/tsukidoko/';const key=r=>new URL(typeof r==='string'?r:r.url,scope).href;
 const cache={async addAll(paths){for(const p of paths)files.set(key(p),{asset:p});},async match(r){return files.get(key(r));}};
 const c=vm.createContext({URL,fetch:()=>Promise.reject(Error('offline')),caches:{open:async()=>cache,keys:async()=>names,delete:async n=>removed.push(n)},self:{location:{origin:'https://example.com'},registration:{scope},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f}});
 vm.runInContext(readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'),c);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.ok(files.has(scope+'vendor/geomagnetism.js'));
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(removed,['tsukidoko-old']);
 handlers.fetch({request:{url:scope+'?installed=1',method:'GET',mode:'navigate'},respondWith:p=>pending=p});assert.equal((await pending).asset,'./index.html');
 handlers.fetch({request:{url:scope+'app.js',method:'GET',mode:'same-origin'},respondWith:p=>pending=p});assert.equal((await pending).asset,'./app.js');
});
