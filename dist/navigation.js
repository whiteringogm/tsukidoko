export const rad = Math.PI / 180;
export const wrap = n => ((n % 360) + 360) % 360;
export const difference = (target, current) => wrap(target - current + 180) - 180;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function compassName(deg) { return ['北','北北東','北東','東北東','東','東南東','南東','南南東','南','南南西','南西','西南西','西','西北西','北西','北北西'][Math.round(wrap(deg)/22.5)%16]; }
export function moonAt(date, latitude, longitude, sunCalc) {
  const position = sunCalc.getMoonPosition(date, latitude, longitude);
  const light = sunCalc.getMoonIllumination(date);
  return {azimuth:wrap(position.azimuth/rad+180),altitude:position.altitude/rad,phase:light.phase,illumination:light.fraction};
}
export function phaseName(phase) { return ['新月','満ちる月','上弦','満ちる月','満月','欠ける月','下弦','欠ける月'][Math.round(phase*8)%8]; }
// W3C intrinsic Z-X'-Y'' rotation. Columns are screen right, screen up,
// and the screen normal in the Earth east/north/up frame. Aim is -Z (rear camera).
export function orientationBasis(alpha,beta,gamma) {
  const [a,b,g]=[alpha,beta,gamma].map(x=>x*rad);
  const [ca,sa,cb,sb,cg,sg]=[Math.cos(a),Math.sin(a),Math.cos(b),Math.sin(b),Math.cos(g),Math.sin(g)];
  return {right:[ca*cg-sa*sb*sg,sa*cg+ca*sb*sg,-cb*sg],up:[-sa*cb,ca*cb,sb],forward:[-ca*sg-sa*sb*cg,-sa*sg+ca*sb*cg,-cb*cg]};
}
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export function guidance(moon,basis) {
  const a=moon.azimuth*rad,h=moon.altitude*rad;
  const target=[Math.cos(h)*Math.sin(a),Math.cos(h)*Math.cos(a),Math.sin(h)];
  const [x,y,z]=[dot(target,basis.right),dot(target,basis.up),dot(target,basis.forward)];
  const separation=Math.acos(clamp(z,-1,1))/rad;
  const horizontal=Math.atan2(x,z)/rad;
  const vertical=Math.atan2(y,Math.hypot(x,z))/rad;
  // For a target behind the phone, prefer a deliberate horizontal turn.
  const dx=z<0 ? (x<0?-1:1)*Math.max(90,Math.abs(horizontal)) : horizontal;
  return {horizontal:dx,vertical,separation,aligned:separation<=10,behind:z<0};
}
export function readSavedLocation(storage,now=Date.now()) {
  try {const p=JSON.parse(storage.getItem('tsukidoko.location'));return p && Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&Number.isFinite(p.timestamp)&&now>=p.timestamp&&now-p.timestamp<86400000 ? p : null;}catch{return null;}
}
