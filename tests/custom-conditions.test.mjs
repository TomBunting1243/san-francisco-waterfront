import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadConditions,saveConditions,readConditions,timeMinutes,timeText,sanFranciscoTime,weatherLabels} from '../src/conditions.ts';

test('weather and time restore independently, including midnight and the last minute of the day',()=>{
  assert.deepEqual(readConditions('{"minutes":0,"weather":"rain"}'),{minutes:0,weather:'rain'});
  assert.deepEqual(readConditions('{"minutes":1439,"weather":"unknown"}'),{minutes:1439});
  assert.deepEqual(readConditions('{"minutes":1440,"weather":"fog"}'),{weather:'fog'});
  assert.deepEqual(readConditions('{"minutes":-1,"weather":"__proto__"}'),{});
  for(const bad of [null,'42','garbage','null','{"minutes":1.5}'])assert.deepEqual(readConditions(bad),{});
  for(const weather of Object.keys(weatherLabels))assert.deepEqual(readConditions(JSON.stringify({weather})),{weather});
});
test('the native time field round-trips every minute and live time honors San Francisco daylight saving',()=>{
  for(let m=0;m<1440;m++)assert.equal(timeMinutes(timeText(m)),m);
  for(const bad of ['','24:00','12:60','xx:59'])assert.equal(timeMinutes(bad),undefined);
  assert.equal(sanFranciscoTime(new Date('2026-01-15T08:00:00Z')),'00:00');
  assert.equal(sanFranciscoTime(new Date('2026-07-15T08:00:00Z')),'01:00');
});
test('reset clears the saved override and disabled browser storage preserves live defaults',t=>{
  const stored=new Map();
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:{
    setItem:(k,v)=>stored.set(k,v),getItem:k=>stored.get(k)??null,removeItem:k=>stored.delete(k)
  }}});
  t.after(()=>{delete globalThis.window;});
  saveConditions({minutes:480,weather:'snow'});assert.deepEqual(loadConditions(),{minutes:480,weather:'snow'});
  saveConditions({weather:'overcast'});assert.deepEqual(loadConditions(),{weather:'overcast'});
  saveConditions({});assert.equal(stored.size,0);assert.deepEqual(loadConditions(),{});
  Object.defineProperty(globalThis.window,'localStorage',{get(){throw Error('unavailable');}});
  assert.doesNotThrow(()=>saveConditions({weather:'clear'}));assert.deepEqual(loadConditions(),{});
});
