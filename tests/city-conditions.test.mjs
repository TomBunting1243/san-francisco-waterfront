import assert from 'node:assert/strict';
import test from 'node:test';
import {cityDate,cityWeather} from '../app/city-conditions.ts';
import {pacificLighting} from '../app/lighting.ts';
import {ferryMarketSchedule} from '../app/ferry-market.ts';

test('the chosen wall clock uses the current San Francisco date, including DST and UTC date rollovers',()=>{
  for(const [now,minutes,expected] of [
    ['2026-07-08T02:30:00Z',0,'2026-07-07T07:00:00.000Z'],
    ['2026-01-05T22:00:00Z',1439,'2026-01-06T07:59:00.000Z'],
    ['2026-11-01T18:00:00Z',90,'2026-11-01T08:30:00.000Z'],
    ['2026-03-08T20:00:00Z',150,'2026-03-08T10:30:00.000Z'],
  ])assert.equal(cityDate(new Date(now),minutes).toISOString(),expected);
  const now=new Date('2026-08-22T23:00:00Z');
  for(const choice of [undefined,-1,1440,NaN])assert.equal(cityDate(now,choice),now);
  const marketOpen=cityDate(now,10*60),night=cityDate(now,22*60);
  assert.equal(pacificLighting(marketOpen).phase,'day');assert.equal(pacificLighting(night).phase,'night');
  assert.equal(ferryMarketSchedule(marketOpen).front,1);assert.equal(ferryMarketSchedule(night).front,0);
});

test('manual weather retains the latest wind bearing and switching back restores the exact live observation',()=>{
  const observation={cloudCover:.6,fog:.1,rain:.3,windKph:30,windFromDegrees:149,visibilityKm:4};
  assert.equal(cityWeather(observation),observation);
  for(const mode of ['clear','overcast','fog','rain','downpour','snow'])assert.equal(cityWeather(observation,mode).windFromDegrees,149);
  assert.equal(cityWeather(null,'downpour').rain,1);
  assert.ok(cityWeather(null,'downpour').windKph>cityWeather(null,'rain').windKph);
  assert.ok(cityWeather(null,'fog').visibilityKm<cityWeather(null,'clear').visibilityKm);
  assert.equal(cityWeather(null,'snow').rain,0);assert.equal(cityWeather(null),null);
});
