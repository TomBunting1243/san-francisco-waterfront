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
    duration:8,currentTime:7.25,readyState:2,paused:true,seekable:{length:1,end:()=>8},dataset:{},
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
  movie.ended=true;movie.currentTime=8;direction.value='bridge';groups[0].dispatchEvent(new Event('change'));
  requests[2].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(movie.poster,'city-to-bridge-night.webp');assert.equal(movie.currentTime,8);
  assert.equal(enter.href,'../?opening=bridge&film=night');
});

test('all eight delivered MP4 editions contain eight seconds of film at 24 fps',async()=>{
  // Read the actual MP4 track sample table in both the portfolio and city
  // export. These silent clips each contain a single video track.
  function box(parent,type){
    for(let at=0;at+8<=parent.length;){
      const length=parent.readUInt32BE(at);
      assert.ok(length>=8&&at+length<=parent.length,'valid MP4 box size');
      if(parent.toString('ascii',at+4,at+8)===type)return parent.subarray(at+8,at+length);
      at+=length;
    }
    assert.fail('Missing MP4 box '+type);
  }
  for(const shot of ['bridge-to-city','city-to-bridge'])for(const light of ['','-night'])for(const aspect of ['','-portrait']){
    const file=shot+light+aspect+'.mp4';
    const movie=await readFile(new URL('../public/openings/'+file,import.meta.url));
    const media=box(box(box(movie,'moov'),'trak'),'mdia');
    assert.equal(box(media,'hdlr').toString('ascii',8,12),'vide',file);
    const header=box(media,'mdhd'),scale=header.readUInt32BE(header[0]===1?20:12);
    const table=box(box(box(media,'minf'),'stbl'),'stts');
    assert.equal(table.readUInt32BE(4),1,'constant cadence in '+file);
    const frames=table.readUInt32BE(8),ticksPerFrame=table.readUInt32BE(12);
    assert.equal(frames,192,file);
    assert.equal(scale/ticksPerFrame,24,file);
    assert.equal(frames*ticksPerFrame/scale,8,file);
  }
});
