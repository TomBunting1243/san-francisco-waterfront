import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaterfrontWeatherReader} from '../app/waterfront-weather.ts';

const minute=60_000,initial=Date.parse('2026-11-18T19:24:00Z');
function setup(){
  const f={time:initial,calls:0,data:{
    visibility:{metadata:{id:'9414296'},data:[{t:'2026-11-18 19:18',v:'4.89',f:'0,0,0'}]},
    wind:{metadata:{id:'9414311'},data:[{t:'2026-11-18 19:18',s:'1.8',d:'288.0',f:'0,0'}]},
    sky:{properties:{updateTime:'2026-11-18T18:27:03Z',
      skyCover:{values:[{validTime:'2026-11-18T13:00:00Z/PT6H',value:48},{validTime:'2026-11-18T19:00:00Z/PT1H',value:98}]},
      weather:{values:[{validTime:'2026-11-18T12:00:00Z/PT9H',value:[{coverage:'definite',intensity:'moderate',weather:'rain_showers'}]}]}}}
  }};
  f.store=new Map();
  f.options={now:()=>f.time,storage:{getItem:k=>f.store.get(k),setItem:(k,v)=>f.store.set(k,v)},
    request:async url=>{
      f.calls++;
      const product=new URL(url).searchParams.get('product')??'sky';
      const payload=f.data[product];
      return new Response(JSON.stringify(payload??{}),{status:payload?200:503});
    }};
  f.read=createWaterfrontWeatherReader(f.options);
  return f;
}

test('NOAA Pier 17 and Pier 1 units and the NWS valid-hour forecast compose once across callers',async()=>{
  const f=setup();
  assert.equal(f.calls,0);
  const [a,b]=await Promise.all([f.read(),f.read()]);
  assert.deepEqual(a,b);assert.equal(f.calls,4);
  assert.equal(a.visibilityKm,4.89);assert.equal(a.windKph,6.48);assert.equal(a.windFromDegrees,288);
  assert.equal(a.station,'9414296+9414311');assert.equal(a.observedAt,'2026-11-18T19:18:00.000Z');
  assert.equal(a.cloudCover,.98);assert.equal(a.rain,.66);
  assert.ok(a.fog>0&&a.fog<.5);assert.ok(a.cloudKnown&&a.rainKnown);
  await f.read();assert.equal(f.calls,4);
});

test('Each product expires independently across reloads, missing feeds and forecast-window boundaries',async()=>{
  const f=setup();await f.read();f.data={};f.time+=37*minute;
  const read=createWaterfrontWeatherReader(f.options),cached=await read();
  assert.equal(cached.windFromDegrees,288);
  assert.equal(cached.cloudKnown,false,'19:00 one-hour cloud forecast expired');
  assert.equal(cached.rainKnown,true,'12:00 nine-hour rain period still applies');
  f.time+=4*minute;const forecast=await read();
  assert.equal(forecast.station,'MTR/86,106');assert.equal(forecast.visibilityKm,null);assert.equal(forecast.windKph,null);
  assert.equal(forecast.fog,0);assert.equal(forecast.rain,.66);assert.equal(forecast.observedAt,'2026-11-18T18:27:03.000Z');
  f.time+=59*minute;assert.equal(await read(),null,'Expired forecast periods cannot extend a complete outage');
});

test('Flagged data, malformed numbers, stale or future times and mismatched stations are excluded',async()=>{
  const f=setup();f.data.sky.properties.updateTime='2026-11-17T18:00:00Z';f.data.visibility.data[0].f='0,1,0';f.data.wind.data[0].s='';
  assert.equal(await f.read(),null);
  f.time+=minute;f.data.wind.data[0].s='0';f.data.wind.data[0].t='2026-11-18 19:50';
  f.data.visibility.data[0].f='0,0,0';f.data.visibility.metadata.id='other';
  assert.equal(await f.read(),null);
  f.time+=minute;f.data.wind.data[0].t='2026-11-18 19:18';
  const calm=await f.read();
  assert.equal(calm.windKph,0);assert.equal(calm.windFromDegrees,null);
  assert.equal(calm.visibilityKm,null);assert.equal(calm.cloudKnown,false);assert.equal(calm.rainKnown,false);
});

test('Low measured visibility thickens fog and forecast chances alone do not manufacture rain',async()=>{
  const f=setup();f.data.visibility.data[0].v='0.3';
  f.data.sky.properties.weather.values[0].value[0].coverage='slight_chance';
  const mist=await f.read();assert.ok(mist.fog>.85);assert.equal(mist.rain,0);assert.equal(mist.rainKnown,true);
  f.time+=11*minute;f.data.visibility.data[0]={t:'2026-11-18 19:30',v:'15',f:'0,0,0'};
  f.data.wind.data[0].d='bad';
  const clear=await f.read();assert.equal(clear.fog,0);assert.equal(clear.windFromDegrees,null);
});

test('Empty offline result resolves within the abort budget and backs off after failure',async()=>{
  const f=setup();let calls=0;
  const read=createWaterfrontWeatherReader({...f.options,timeoutMs:10,request:(_url,{signal})=>new Promise((_resolve,reject)=>{
    calls++;signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  })});
  assert.equal(await read(),null);assert.equal(await read(),null);assert.equal(calls,4);
});


test('a fresh local radar echo sets rain strength even during a forecast gap and expires independently',async()=>{
  const f=setup();f.data.sky.properties.weather.values[0].value=[];
  let observed=true;
  const read=createWaterfrontWeatherReader({...f.options,radar:async()=>observed?{at:initial-8*minute,value:.94}:undefined});
  assert.equal((await read()).rain,.94);assert.equal((await read()).rainSource,'radar');
  observed=false;f.time+=18*minute;assert.equal((await read()).rainSource,'forecast');assert.equal((await read()).rain,0);
});

test('the Christmas override changes at Pacific midnight, including visitors in other time zones',async()=>{
  const {harborChristmasSnow}=await import('../app/waterfront-weather.ts');
  for(const [at,expected] of [['2026-12-24T07:59:59Z',false],['2026-12-24T08:00:00Z',true],['2026-12-26T07:59:59Z',true],['2026-12-26T08:00:00Z',false]])
    assert.equal(harborChristmasSnow(new Date(at)),expected);
});

test('the radar palette resolves the actual harbor sample; missing or unknown colors fall back',async()=>{
  const {radarStrength}=await import('../app/waterfront-radar.ts');
  const lake=[8,102,11,255,50,115,8,255,8,98,10,255,9,115,12,255,10,119,13,255,9,94,9,255,11,136,15,255,11,132,14,255,10,119,13,255];
  assert.ok(radarStrength(lake)>.60&&radarStrength(lake)<.75);assert.equal(radarStrength(Array(36).fill(0)),null);
});

test('sunset light follows the western sun through twilight',async()=>{
  const {pacificLighting}=await import('../app/lighting.ts');
  assert.ok(pacificLighting(new Date('2026-11-21T00:49:00Z')).sunset>.8);
  assert.equal(pacificLighting(new Date('2026-11-20T15:00:00Z')).sunset,0);
  assert.equal(pacificLighting(new Date('2026-11-21T06:00:00Z')).sunset,0);
});

test('five solar studies preserve their shadow pigments, sun and room-light proportions',async()=>{
  const {harborWash}=await import('../app/lighting.ts');
  const midpoint=harborWash(0,270); // Halfway between blue hour and evening gold in Cartesian OKLab.
  assert.deepEqual([midpoint.sky,midpoint.horizon,midpoint.fill],[0x6273a2,0xb498a0,0x8d8092]);
  const stops=[
    [6,95,0x8f9ce0,0x6a6fa3,2.3,.78,.03],
    [55,180,0xbcd3e8,0x7b8db3,2.2,1.1,0],
    [6,260,0xd9a98c,0x5f5a96,2.5,.62,.05],
    [-6,270,0x46558f,0x1f2a52,0,.95,.40],
    [-22,300,0x23324d,0x0f1a2b,.12,.75,.30],
  ];
  for(const [alt,az,fill,bounce,key,hemi,share] of stops){
    const row=harborWash(alt,az);
    assert.deepEqual([row.fill,row.bounce,row.sunIntensity,row.ambient,row.litShare],[fill,bounce,key,hemi,share]);
  }
});

test('east and west low sun have distinct washes that converge at solar noon and through the night',async()=>{
  const {harborWash}=await import('../app/lighting.ts');
  const dawn=harborWash(6,105),dusk=harborWash(6,255);
  for(const field of ['sky','horizon','sun','water','fill','bounce'])assert.notEqual(dawn[field],dusk[field],field);
  for(const altitude of [-55,-15,26,71])assert.deepEqual(harborWash(altitude,179.99),harborWash(altitude,180.01));
  const neutral=harborWash(35,180);
  for(const lowSun of [dawn,dusk])assert.ok(lowSun.sunIntensity/lowSun.ambient>neutral.sunIntensity/neutral.ambient);
});

test('a clear day casts shadows and a solid cloud deck or a sun below the horizon removes the shadow pass',async()=>{
  const {directSunVisibility}=await import('../app/lighting.ts');
  assert.equal(directSunVisibility(30,.1,0),1);
  assert.equal(directSunVisibility(30,.99,0),0);
  assert.equal(directSunVisibility(-3,.1,0),0);
  assert.ok(directSunVisibility(1,.85,.3)>0&&directSunVisibility(1,.85,.3)<.1);
});
