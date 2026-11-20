import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const template=new URL('../city-standalone/public/openings/',import.meta.url);
const room=existsSync(template)?template:new URL('../public/openings/',import.meta.url);
const script=await readFile(new URL('room.js',room),'utf8');
const markup=await readFile(new URL('index.html',room),'utf8');

test('the gallery selects one native frame, preserves its scrubbed second and cancels an obsolete switch',async()=>{
  assert.match(markup,/<source media="\(orientation: portrait\)" src="\.\/bridge-to-city-portrait\.mp4"/);
  assert.doesNotMatch(markup,/<video[^>]+\bsrc=/);
  const baseURI='https://example.test/openings/',portrait=Object.assign(new EventTarget(),{matches:true});
  const movie=Object.assign(new EventTarget(),{currentSrc:baseURI+'bridge-to-city-portrait.mp4',
    duration:12,currentTime:7.25,readyState:2,paused:true,seekable:{length:1,end:()=>12},dataset:{},
    setAttribute(){},load(){this.currentTime=0;},play(){this.paused=false;return Promise.resolve();}});
  const enter={},errorLink={},error={hidden:true,querySelector:()=>errorLink},groups=[new EventTarget(),new EventTarget()];
  const direction={value:'skyline'},light={value:'day'},requests=[];
  const document={baseURI,querySelector(q){
    return q==='video'?movie:q==='.enter'?enter:q==='.error'?error:q.includes('opening')?direction:light;
  },querySelectorAll:()=>groups};
  const blobs=[];
  class RoomURL extends URL{
    static createObjectURL(){const name='blob:'+blobs.length;blobs.push(name);return name;}
    static revokeObjectURL(){}
  }
  vm.runInNewContext(script,{document,window:new EventTarget(),matchMedia:()=>portrait,URL:RoomURL,AbortController,
    fetch:(src,{signal})=>new Promise(resolve=>requests.push({src,signal,resolve:()=>resolve({ok:true,blob:async()=>new Blob()})})),
  });
  assert.equal(movie.poster,'bridge-to-city-portrait.webp');assert.equal(requests.length,0);
  light.value='night';groups[1].dispatchEvent(new Event('change'));
  assert.equal(requests[0].src,baseURI+'bridge-to-city-night-portrait.mp4');
  portrait.matches=false;portrait.dispatchEvent(new Event('change'));
  assert.ok(requests[0].signal.aborted);assert.equal(requests[1].src,baseURI+'bridge-to-city-night.mp4');
  for(const request of requests)request.resolve();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(movie.currentTime,7.25);assert.equal(movie.paused,true);
  assert.equal(movie.dataset.filmSrc,requests[1].src);assert.equal(blobs.length,1);
  assert.equal(enter.href,'../?opening=skyline&film=night');
  movie.ended=true;movie.currentTime=12;direction.value='bridge';groups[0].dispatchEvent(new Event('change'));
  requests[2].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(movie.poster,'city-to-bridge-night.webp');assert.equal(movie.currentTime,12);
  assert.equal(enter.href,'../?opening=bridge&film=night');
});
