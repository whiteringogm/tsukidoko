import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {moonAt,nextMoonEvent,formatMoonEventTime,moonHorizon,rad} from '../dist/navigation.js';
const context=vm.createContext({});context.window=context;
vm.runInContext(readFileSync(new URL('../dist/vendor/suncalc.js',import.meta.url),'utf8'),context);
const sunCalc=context.SunCalc;

test('next set matches SunCalc published fixture and ignores the earlier rise',()=>{
  const now=new Date('2013-03-04T05:00:00Z');
  const event=nextMoonEvent(now,50.5,30.5,sunCalc,true);
  assert.equal(event.type,'set');
  assert.equal(event.time.toISOString().slice(0,19),'2013-03-04T07:47:58');
  assert.equal(moonAt(new Date(event.time.getTime()-300000),50.5,30.5,sunCalc).aboveHorizon,true);
  assert.equal(moonAt(new Date(event.time.getTime()+300000),50.5,30.5,sunCalc).aboveHorizon,false);
});
test('next rise matches published fixture; its state changes to above the horizon',()=>{
  const now=new Date('2013-03-04T12:00:00Z');
  const event=nextMoonEvent(now,50.5,30.5,sunCalc,false);
  assert.equal(event.type,'rise');
  assert.equal(event.time.toISOString().slice(0,19),'2013-03-04T23:54:29');
  assert.equal(moonAt(new Date(event.time.getTime()-300000),50.5,30.5,sunCalc).aboveHorizon,false);
  assert.equal(moonAt(new Date(event.time.getTime()+300000),50.5,30.5,sunCalc).aboveHorizon,true);
});
test('past events, absent events and UTC year rollover are handled',()=>{
  const calls=[];const now=new Date('2026-12-31T23:30:00Z');
  const fake={getMoonTimes(date,lat,lon,utc){calls.push(date.toISOString());assert.equal(utc,true);
    if(calls.length===1)return {rise:new Date('2026-12-31T23:00:00Z')};
    if(calls.length===2)return {alwaysDown:true};
    return {rise:new Date('2027-01-02T01:00:00Z')};
  }};
  assert.equal(nextMoonEvent(now,80,0,fake,false).time.toISOString(),'2027-01-02T01:00:00.000Z');
  assert.deepEqual(calls,['2026-12-31T00:00:00.000Z','2027-01-01T00:00:00.000Z','2027-01-02T00:00:00.000Z']);
});
test('a passed or exactly-current event is never displayed as upcoming',()=>{
  const now=new Date('2026-10-07T00:00:00Z');let count=0;
  const fake={getMoonTimes(){return {set:new Date(now.getTime()+(count++)*86400000)};}};
  assert.equal(nextMoonEvent(now,35,139,fake,true).time.getTime(),now.getTime()+86400000);
});
test('polar no-event period is bounded and does not fabricate a time',()=>{
  let calls=0;const fake={getMoonTimes(){calls++;return {alwaysUp:true};}};
  assert.deepEqual(nextMoonEvent(new Date('2026-10-07T00:00:00Z'),90,0,fake,true),{type:'set',time:null});
  assert.equal(calls,33);
});
test('date labels use calendar days across month/year and DST boundaries',()=>{
  assert.match(formatMoonEventTime(new Date(2026,9,7,18,24),new Date(2026,9,7,1)),/^今日 18:24ごろ$/);
  assert.match(formatMoonEventTime(new Date(2027,0,1,1,5),new Date(2026,11,31,23)),/^明日 01:05ごろ$/);
  assert.match(formatMoonEventTime(new Date(2027,0,2,1,5),new Date(2026,11,31,23)),/^1月2日 01:05ごろ$/);
  assert.match(formatMoonEventTime(new Date(2026,2,9,0,15),new Date(2026,2,8,0,15)),/^明日 /);
});
test('horizon state shares the rise/set library threshold',()=>{
  for(const [altitude,expected] of [[moonHorizon-.001,false],[moonHorizon+.001,true]]){
    const fake={getMoonPosition:()=>({azimuth:0,altitude:altitude*rad}),getMoonIllumination:()=>({phase:.5,fraction:1})};
    assert.equal(moonAt(new Date(),0,0,fake).aboveHorizon,expected);
  }
});
