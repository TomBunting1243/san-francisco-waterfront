import test from 'node:test';
import assert from 'node:assert/strict';
import blocks from '../public/data/survey-blocks.json' with {type:'json'};
import survey from '../public/data/curb-survey.json' with {type:'json'};
import corners from '../public/data/fremont-corner-curbs.json' with {type:'json'};
import {replacementPavement} from '../app/curb-survey.ts';
import {fremontPoles} from '../app/fremont-howard-signals.ts';

function world(u,v){
  return [-27.00800104+.0012973094*u-.0084729829*v,-33.37263659+.0084728164*u+.0012965840*v];
}
function inside([x,z],ring){
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [a,b]=ring[i],[c,d]=ring[j];
    if((b>z)!==(d>z)&&x<a+(c-a)*(z-b)/(d-b))hit=!hit;
  }
  return hit;
}
function parcel(kind,index){
  return replacementPavement(kind,index,blocks.streets[kind][index]);
}
function covers(plan,p){
  return plan.some(([outer,...holes])=>inside(p,outer)&&holes.every(h=>!inside(p,h)));
}
test('the two photographed terminal bars clear final walk and curb across their full widths',()=>{
  const street=parcel('street',78),exclusions=[...parcel('curb',346),...parcel('curb',350),...parcel('sidewalk',224),...parcel('sidewalk',225)];
  for(const [u,v,width,height] of [[189,162.75,32,4.5],[54.25,285,4.5,32]]){
    for(let x=0;x<=16;x++)for(let y=0;y<=16;y++){
      const p=world(u+width*x/16,v+height*y/16);
      assert.ok(covers(street,p)&&!covers(exclusions,p),String(p));
    }
  }
});
test('the full signal shafts remain seated on the two corrected sidewalk landings',()=>{
  for(const [pole,id] of [[fremontPoles.ne,225],[fremontPoles.sw,224]]){
    for(let i=0;i<24;i++){
      const a=i*Math.PI/12;
      assert.ok(covers(parcel('sidewalk',id),[pole.x+.0075*Math.cos(a),pole.z+.0075*Math.sin(a)]));
    }
  }
  assert.deepEqual(Object.keys(corners.stations.street),['78']);
  assert.deepEqual(Object.keys(corners.stations.curb),['346','350']);
  assert.deepEqual(Object.keys(corners.stations.sidewalk),['224','225']);
});

test('the separate Beale end of curb 346 retains its original surveyed override',()=>{
  assert.deepEqual(parcel('curb',346).slice(1),survey.overrides.curb[346].slice(1));
});
