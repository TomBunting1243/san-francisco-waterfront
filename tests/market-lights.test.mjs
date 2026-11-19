import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {addMarketLights,insideMarketLampFooting} from '../app/market-lights.ts';
import {collectStreetGlobes,createStreetField} from '../app/street-illumination.ts';
import {frostPlazaSurface} from '../app/california-sidewalk.ts';
import inventory from '../public/data/market-lights.json' with {type:'json'};

test('both surveyed rows retain every Path of Gold pole, its three lit glass centres and its pool',()=>{
  const root=new T.Group();addMarketLights(root);root.updateMatrixWorld(true);
  const poles=root.getObjectsByProperty('name','Market Street Path of Gold standard');
  assert.equal(poles.length,55);assert.equal(new Set(inventory.poles.map(row=>row[0])).size,55);
  // The historic trident faces across the street. At the California stop the
  // two arms lie along the same axis as the adjacent curb, not across the rails.
  const colors=new Set(),bounds=new T.Box3(),axis=new T.Vector3(.151,0,1).normalize();
  for(const [i,[id,x,z,y]] of inventory.poles.entries()){
    const pole=poles[i];assert.deepEqual([pole.userData.inventoryId,pole.position.x,pole.position.z],[id,x,z]);
    bounds.setFromObject(pole);
    assert.ok(Math.abs(bounds.min.y-(frostPlazaSurface(x,z)??y))<.0001);
    assert.ok(Math.abs(bounds.max.y-bounds.min.y-9.83*.06)<.0001);
    const [a,b,c]=pole.children.map(o=>o.getWorldPosition(new T.Vector3()));
    assert.ok(Math.abs(b.y-a.y-.80*.06)<.00001&&Math.abs(a.y-c.y)<.00001);
    assert.ok(c.clone().sub(a).normalize().dot(axis)>.999);
    assert.ok(Math.abs(c.distanceTo(a)-1.09*.06)<.00001);
    const lit=pole.geometry.getAttribute('signLight');
    assert.ok(lit&&lit.array.some(v=>v>200)&&lit.array.some(v=>v===0));colors.add(pole.geometry);
  }
  assert.equal(colors.size,2);
  const globes=collectStreetGlobes(root,[]),field=createStreetField(globes);
  assert.equal(globes.length,55*3*3);
  for(const [,x,z] of inventory.poles){
    const col=Math.floor((x+56)/.12),row=Math.floor((z+64)/.12);
    assert.ok(field.image.data[(row*field.image.width+col)*4]>225);
  }
  const wires=root.getObjectsByProperty('name','Market trolley span between surveyed poles');
  assert.ok(wires.length>15&&wires.length<=Math.floor(poles.length/2));
  for(const wire of wires){
    const pos=wire.geometry.attributes.position;
    const p=new T.Vector3();
    for(const side of [-1,1]){
      let end;
      for(let i=0;i<pos.count;i++){wire.localToWorld(p.fromBufferAttribute(pos,i));if(!end||side*p.x>side*end.x)end=p.clone();}
      assert.ok(poles.some(m=>Math.hypot(end.x-m.position.x,end.z-m.position.z)<.003));
    }
  }
  field.dispose();
});


test('the registered lamp and tree inventories never draw a trunk through the Market pedestal',async()=>{
  const {default:street}=await import('../public/data/market-street.json',{with:{type:'json'}});
  const overlapping=street.trees.filter(([,p,,dbh])=>insideMarketLampFooting(...p,dbh*.0254*.03));
  assert.deepEqual(overlapping.map(tree=>tree[0]),[195298]);
});
