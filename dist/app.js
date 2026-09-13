import {wrap,difference,clamp,moonAt,phaseName,compassName,orientationBasis,guidance,readSavedLocation} from './navigation.js';
const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['locate','sensor','message','instruction','mode','marker','symbol','location-status','sensor-status','azimuth','altitude','phase','time','horizon','connection','offline-status'].map(id=>[id,$(id)]));
let location=null,moon=null,basis=null,watch=null,geoGeneration=0,offset=null,lastSensor=0,sensorWanted=false,sensorState='',declination=null,magneticReliable=false;
let lastRender=0,lastAbsolute=0;
const text=(id,value)=>{if(ui[id].textContent!==value)ui[id].textContent=value;};
function setLocationStatus(){if(!location)return;const saved=location.saved?'保存した位置':'現在地';const stamp=new Date(location.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});text('location-status',`${saved} · ${stamp}取得${Number.isFinite(location.accuracy)?` · 誤差 約${Math.round(location.accuracy)}m`:''}`);}
function updateMoon(){
  if(!location)return;
  moon=moonAt(new Date(),location.latitude,location.longitude,globalThis.SunCalc);
  try{const field=globalThis.geomagnetism.model(new Date()).point([location.latitude,location.longitude]);declination=field.decl;magneticReliable=Number.isFinite(declination)&&field.h>=2000;}catch{declination=null;magneticReliable=false;}
  text('azimuth',compassName(moon.azimuth));ui.azimuth.title=`真北から時計回り ${moon.azimuth.toFixed(1)}°`;
  text('altitude',`${Math.round(moon.altitude)}°`);text('phase',phaseName(moon.phase));ui.phase.title=`明るい面 ${Math.round(moon.illumination*100)}%`;
  text('time',new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}));
  text('horizon',`${moon.altitude<0?'地平線の下':'地平線の上'} · 方位 ${Math.round(moon.azimuth)}° · 明るい面 ${Math.round(moon.illumination*100)}%`);render();
}
function resetOrientation(){basis=null;offset=null;lastSensor=0;lastAbsolute=0;}
function geoError(error,generation){
  if(generation!==geoGeneration)return;
  ui.locate.disabled=false;ui.locate.hidden=!!location;ui.locate.textContent='現在地をもう一度取得';
  const reason=error.code===1?'位置情報が必要です。Safariや端末の位置情報の許可を確認してね。':error.code===3?'現在地の取得に時間がかかっている。空の開けた場所でもう一度。':'現在地を取得できなかった。端末の位置情報を確認してね。';
  if(location){location.saved=true;setLocationStatus();text('location-status',`${ui['location-status'].textContent}（現在地は取得できなかった）`);}else{text('location-status',reason);}
  if(!location){text('message','位置情報が必要です');text('instruction',reason);}
}
function locate(){
  if(!window.isSecureContext){geoError({code:2},geoGeneration);text('location-status','HTTPSで開いてね。位置と方角の取得に必要。');return;}
  if(!navigator.geolocation){geoError({code:2},geoGeneration);return;}
  if(watch!==null)navigator.geolocation.clearWatch(watch);
  const generation=++geoGeneration;ui.locate.disabled=true;text('location-status','現在地を取得中…');
  watch=navigator.geolocation.watchPosition(p=>{
    if(generation!==geoGeneration)return;
    if(!Number.isFinite(p.coords.latitude)||!Number.isFinite(p.coords.longitude))return;
    const moved=!location||Math.abs(location.latitude-p.coords.latitude)+Math.abs(location.longitude-p.coords.longitude)>.02;
    location={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp,saved:false};
    try{localStorage.setItem('tsukidoko.location',JSON.stringify(location));}catch{}
    if(moved)resetOrientation();ui.locate.disabled=false;ui.locate.hidden=true;ui.sensor.hidden=sensorWanted;setLocationStatus();updateMoon();
  },e=>geoError(e,generation),{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
}
function onOrientation(e){
  if(document.hidden||!sensorWanted||!location)return;
  if(![e.alpha,e.beta,e.gamma].every(Number.isFinite))return;
  let alpha=e.alpha;
  if(Number.isFinite(e.webkitCompassHeading)&&e.webkitCompassHeading>=0){
    if(!magneticReliable){basis=null;sensorState='この場所・日時では方角を補正できない。下の月情報を目印にしてね。';render();return;}
    if(!Number.isFinite(e.webkitCompassAccuracy)||e.webkitCompassAccuracy<0||e.webkitCompassAccuracy>25){basis=null;sensorState='方角が不安定。磁石や金属から離れ、画面を上にして水平に持ってね。';render();return;}
    // Safari alpha is relative. Establish Earth yaw only with the screen face up
    // and flat, where compass heading and alpha are unambiguous. Keep that offset
    // while tilting through vertical so the rear-camera ray never flips 180°.
    if(Math.abs(e.beta)<20&&Math.abs(e.gamma)<20){
      const candidate=wrap(-e.webkitCompassHeading-declination-e.alpha);
      offset=offset===null?candidate:wrap(offset+difference(candidate,offset)*.08);
    }
    if(offset===null){sensorState='一度、画面を上にして水平に持ってね。';render();return;}
    alpha=wrap(e.alpha+offset);
  }else if(e.absolute===true){lastAbsolute=performance.now();}
  else{if(performance.now()-lastAbsolute>1500){basis=null;sensorState='この端末では方角を取得できない。下の月情報を目印にしてね。';render();}return;}
  lastSensor=performance.now();sensorState='';
  // Filter the rotated vectors, not Euler angles: equivalent angle triplets can
  // jump at vertical and must not produce a false sweep across the sky.
  const next=orientationBasis(alpha,e.beta,e.gamma);
  if(basis){for(const key of ['right','up','forward']){const v=next[key].map((x,i)=>basis[key][i]*.65+x*.35);const length=Math.hypot(...v);if(length>.001)next[key]=v.map(x=>x/length);}}
  basis=next;
  if(lastSensor-lastRender>60){lastRender=lastSensor;render();}
}
async function enableSensors(){
  const event=window.DeviceOrientationEvent;
  if(!event||!window.isSecureContext){sensorState='この端末では方角を取得できない。下の月情報を目印にしてね。';render();return;}
  try{
    // Must be invoked directly from this click, before any unrelated await.
    const permission=typeof event.requestPermission==='function'?await event.requestPermission(true):'granted';
    if(permission!=='granted'){sensorState='方角の利用が許可されなかった。許可の設定を確認するか、下の月情報を使ってね。';render();return;}
    resetOrientation();sensorWanted=true;sensorState='方角を取得中。画面を上にして水平に持ってね。';ui.sensor.hidden=true;
    window.addEventListener('deviceorientation',onOrientation);window.addEventListener('deviceorientationabsolute',onOrientation);
    render();setTimeout(()=>{if(sensorWanted&&!basis){sensorState=offset===null?'方角を待機中。画面を上にして水平に持ってね。反応しない場合はSafariで直接開き、方角を再試行。':'方角が届かない。もう一度試してね。';ui.sensor.hidden=false;ui.sensor.textContent='方角を再試行';render();}},7000);
  }catch{sensorState='方角を取得できなかった。Safariで直接開き、もう一度試してね。';ui.sensor.hidden=false;render();}
}
function setMarker(symbol,kind='idle',x=0,y=0){text('symbol',symbol);ui.marker.className=`marker ${kind}`;ui.marker.style.transform=`translate(${x}px,${y}px)`;}
function render(){
  text('sensor-status',sensorState);
  if(!moon)return;
  if(moon.altitude<0){setMarker('↓','below');text('mode','今は、空の下側。');text('message','いま月は地平線の下です');text('instruction',`${compassName(moon.azimuth)}・高度 ${Math.round(moon.altitude)}°。今は空に見えない。`);return;}
  if(window.innerWidth>window.innerHeight&&sensorWanted){setMarker('↻');text('message','スマホを縦に戻してね');text('instruction','画面を自分に向けて、空へかざそう。');return;}
  text('mode','月のある方へ。');
  if(!basis||performance.now()-lastSensor>4000){setMarker('☾');text('message',`月は${compassName(moon.azimuth)}、高度${Math.round(moon.altitude)}°`);text('instruction',sensorWanted?'方角が整うと、ここに矢印が出る。':'方角を許可すると、矢印で案内する。');return;}
  const g=guidance(moon,basis);
  if(g.aligned){setMarker('●','found');text('message','🌕 この先');text('instruction','この向きの空に月がある。雲の向こうかも。');return;}
  const horizontal=Math.abs(g.horizontal)>Math.abs(g.vertical);
  const symbol=horizontal?(g.horizontal>0?'→':'←'):(g.vertical>0?'↑':'↓');
  const parts=[];if(Math.abs(g.horizontal)>5)parts.push(`${g.horizontal>0?'右':'左'}に約${Math.round(Math.abs(g.horizontal))}°`);if(Math.abs(g.vertical)>5)parts.push(`${g.vertical>0?'上':'下'}に約${Math.round(Math.abs(g.vertical))}°`);
  const radius=ui.marker.parentElement.clientWidth*.32;
  const sx=clamp(g.horizontal/60,-1,1),sy=clamp(-g.vertical/60,-1,1),norm=Math.max(1,Math.hypot(sx,sy));
  setMarker(symbol,'tracking',sx/norm*radius,sy/norm*radius);text('message',parts.join(' · '));text('instruction',g.behind?'月は背中側。まず左右に向きを変えよう。':'画面を自分に向けて、背面カメラを空へ。');
}
function connection(){text('connection',navigator.onLine?'今、この場所から':'オフライン');}
ui.locate.addEventListener('click',locate);ui.sensor.addEventListener('click',enableSensors);$('refresh').addEventListener('click',locate);
$('forget').addEventListener('click',()=>{geoGeneration++;if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;try{localStorage.removeItem('tsukidoko.location');}catch{}location=moon=null;resetOrientation();ui.locate.hidden=false;ui.locate.disabled=false;ui.sensor.hidden=true;['azimuth','altitude','phase','time'].forEach(id=>text(id,'—'));setMarker('☾');text('message','位置情報が必要です');text('instruction','現在地を使って、月の方向を調べる。');text('location-status','保存した位置を消した。');text('horizon','現在地を取得すると表示される');});
window.addEventListener('online',connection);window.addEventListener('offline',connection);window.addEventListener('resize',render);
document.addEventListener('visibilitychange',()=>{resetOrientation();if(!document.hidden){updateMoon();if(location)locate();}});
window.addEventListener('pageshow',e=>{if(e.persisted){resetOrientation();updateMoon();}});
setInterval(()=>{if(!document.hidden){if(location&&Date.now()-location.timestamp>=86400000){location=moon=null;resetOrientation();ui.locate.hidden=false;ui.sensor.hidden=true;text('message','現在地を取り直してね');text('instruction','保存した位置が古くなった。');['azimuth','altitude','phase'].forEach(id=>text(id,'—'));setMarker('☾');}updateMoon();}},15000);
setInterval(()=>{if(sensorWanted&&basis&&performance.now()-lastSensor>4000){basis=null;sensorState='方角の更新が止まった。方角を再試行してね。';ui.sensor.hidden=false;ui.sensor.textContent='方角を再試行';render();}},1000);
connection();try{location=readSavedLocation(localStorage);if(location){location.saved=true;setLocationStatus();ui.sensor.hidden=false;ui.locate.textContent='現在地を取り直す';updateMoon();}}catch{}
if('serviceWorker' in navigator&&window.isSecureContext){navigator.serviceWorker.register('./sw.js').then(async reg=>{await navigator.serviceWorker.ready;text('offline-status','オフライン起動の準備ができた。');if(reg.waiting)text('offline-status','新しい版がある。アプリを閉じて開き直すと更新される。');}).catch(()=>text('offline-status','オフライン保存ができなかった。通信のある場所で開き直してね。'));}
// Optional read-only agent access uses the same calculated state and never
// requests permissions or returns the user's coordinates.
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_current_moon',description:'Read the current moon direction already shown on the page. Does not request location or sensor permission.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('Expected an empty object');if(!moon)return {status:'location_required'};return {status:'ready',azimuth:moon.azimuth,altitude:moon.altitude,phase:phaseName(moon.phase),aboveHorizon:moon.altitude>=0,savedLocation:!!location.saved};}})).catch(()=>{});}catch{}}
