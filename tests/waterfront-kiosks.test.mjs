import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {addWaterfrontKiosk} from '../app/waterfront-kiosks.ts';
import {waterfrontKioskSites} from '../app/waterfront-kiosk-sites.ts';
import {kioskCampaignIds,kioskCampaignMaterial} from '../app/kiosk-campaigns.ts';
import {shuffleBillboardAds} from '../app/approach-billboards.ts';
import {billboardSites} from '../app/billboard-sites.ts';
import {bakeRigidChunk} from '../app/city-blocks.ts';

function mesh(g,c,x,y,z,parent){
  const part=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:c}));part.position.set(x,y,z);parent.add(part);return part;
}
test('surveyed kiosks carry two separate commercial assignments and the designated service face',()=>{
  assert.equal(waterfrontKioskSites.length,11);
  const wide=billboardSites.length,count=wide+2*waterfrontKioskSites.length;
  const draw=()=>.53,first=shuffleBillboardAds(count,draw,[],wide),second=shuffleBillboardAds(count,draw,first,wide);
  assert.ok(first.slice(0,wide).every(id=>!kioskCampaignIds.includes(id)));
  assert.ok(first.slice(wide).some(id=>kioskCampaignIds.includes(id)));
  assert.ok(second.every((id,i)=>id!==first[i]));
  for(const [i,s] of waterfrontKioskSites.entries()){
    const offset=wide+2*i,pair=first.slice(offset,offset+2);
    const root=new THREE.Group(),g=addWaterfrontKiosk(mesh,root,s,pair);
    assert.equal(g.name,s.name);assert.equal(g.rotation.y,s.yaw);
    assert.deepEqual(g.position.toArray(),[s.x,s.footY,s.z]);
    assert.ok(Math.abs(new THREE.Box3().setFromObject(g,true).min.y-s.footY)<1e-7);
    assert.deepEqual(g.userData.commercialFaces,pair);assert.notEqual(...pair);
    assert.equal(g.getObjectByName('Public service face').userData.artwork,'civic');
    assert.equal(!!g.getObjectByName('Closed vending doors'),s.kind==='vending');
  }
});
test('each cabinet opening exposes a single print surface across both commercial panels and the public panel',()=>{
  for(const style of ['historic','modern'])for(const kind of ['vending','column']){
    const g=addWaterfrontKiosk(mesh,new THREE.Group(),{name:'isolated',x:0,z:0,footY:0,yaw:.71,kind,style},['waymo','palantir']);
    g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(g),height=bounds.max.y-bounds.min.y;
    assert.ok(height>=14*.3048*.06&&height<17.5*.3048*.06);
    const housing=g.children[0].geometry;housing.computeBoundingBox();
    const footprint=housing.boundingBox.max.x-housing.boundingBox.min.x;
    assert.ok(Math.abs(footprint/.06-(style==='historic'?1.65:1.905))<.014);
    const tris=g.children[0].geometry.getAttribute('position').count/3;
    assert.ok(tris<1300);
    const prints=[];
    for(const [i,face] of g.children.filter(o=>o.isGroup).entries()){
      const sheet=face.children[0];prints.push(sheet);
      assert.ok(sheet.geometry.hasAttribute(i===0?'billboardPrint':'kioskPrint'));
      const p=sheet.geometry.attributes.position;
      for(let k=0;k<p.count/2-1;k++)for(const u of [.05,.52,.95])for(const v of [.01,.49,.99]){
        const start=new THREE.Vector3().fromBufferAttribute(p,k);
        const next=new THREE.Vector3().fromBufferAttribute(p,k+1);
        const bottom=new THREE.Vector3().fromBufferAttribute(p,k+p.count/2);
        const point=start.clone().lerp(next,u);point.y=THREE.MathUtils.lerp(start.y,bottom.y,v);
        const normal=new THREE.Vector3().subVectors(next,start).cross(new THREE.Vector3(0,1,0)).normalize();
        normal.transformDirection(face.matrixWorld);face.localToWorld(point);
        const ray=new THREE.Raycaster(point.clone().addScaledVector(normal,.1),normal.negate(),0,.101);
        const hits=ray.intersectObject(g,true);
        assert.ok(hits.length&&hits.every(hit=>hit.object===sheet),style+'/'+kind+'/'+i+'/'+k+'/'+u+'/'+v);
      }
    }
    const baked=bakeRigidChunk('atlas',prints.slice(1),kioskCampaignMaterial());
    assert.equal(baked.geometry.attributes.uv.count,prints.slice(1).reduce((n,p)=>n+p.geometry.attributes.kioskPrint.count,0));
    assert.ok(baked.material.emissiveIntensity>0&&baked.material.emissive.getHex()>0);
  }
});

test('all eleven kiosk footings meet the assembled sidewalk or forecourt across their base',async()=>{
  const {createLandscape}=await import('../app/landscape.ts');
  const world=createLandscape();world.root.updateMatrixWorld(true);
  const parts=[];
  world.root.traverse(m=>{
    if(m.isMesh&&!m.isInstancedMesh&&!m.isBatchedMesh&&m.visible&&m.material.colorWrite)
      parts.push([m,new THREE.Box3().setFromObject(m)]);
  });
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  for(const site of waterfrontKioskSites){
    for(const dx of [-.024,.024])for(const dz of [-.024,.024]){
      ray.set(new THREE.Vector3(site.x+dx,site.footY+.015,site.z+dz),down);ray.far=.018;
      const near=parts.filter(([,b])=>b.max.y>=site.footY-.003&&b.min.y<=site.footY+.015&&ray.ray.intersectsBox(b));
      const hit=ray.intersectObjects(near.map(([m])=>m),false)[0];
      assert.ok(hit&&hit.point.y>=site.footY-.0004&&hit.point.y<site.footY+.008,
        site.name+' floats over the ground or sinks past its plinth at '+[dx,dz]);
    }
  }
});

test('thirteen portrait editions retain distinct near and distant prints inside replicated atlas gutters',async()=>{
  const {default:sharp}=await import('sharp');
  const {fileURLToPath}=await import('node:url');
  const {renderKioskCampaign}=await import('../app/kiosk-campaigns.ts');
  const file=fileURLToPath(new URL('../public/kiosk-campaigns.webp',import.meta.url));
  const {data,info}=await sharp(file).removeAlpha().raw().toBuffer({resolveWithObject:true});
  assert.deepEqual([info.width,info.height,info.channels],[1400,2088,3]);
  const reads=[new Set(),new Set()];
  const ids=[...kioskCampaignIds,'yahoo','coke','anthropic','spacex','palantir','civic'];
  for(const [i,id] of ids.entries()){
    const print=renderKioskCampaign(id,.0744,.19164,new THREE.Group(),mesh);
    const uv=print.geometry.getAttribute('kioskPrint'),x=8+i%5*280,y=8+Math.floor(i/5)*696;
    const pixel=(i)=>[Math.round(uv.getX(i)*info.width),Math.round((1-uv.getY(i))*info.height)];
    assert.deepEqual([pixel(0),pixel(3)],[[x,y],[x+264,y+680]],id);
    const at=(x,y,c)=>data[(y*info.width+x)*3+c];
    // Lossy WebP may perturb an edge by a few levels. All eight gutter pixels
    // should still match the nearest art edge, including the four corners.
    let sum=0,count=0;
    for(let v=-8;v<688;v++)for(let u=-8;u<272;u++){
      if(u>=0&&u<264&&v>=0&&v<680)continue;
      const U=x+THREE.MathUtils.clamp(u,0,263),V=y+THREE.MathUtils.clamp(v,0,679);
      for(let c=0;c<3;c++){sum+=Math.abs(at(x+u,y+v,c)-at(U,V,c));count++;}
    }
    assert.ok(sum/count<3,id+' gutter variation '+sum/count);
    for(const [level,w] of [24,132].entries()){
      const sample=await sharp(file).extract({left:x,top:y,width:264,height:680}).resize(w).greyscale().raw().toBuffer();
      const sorted=Buffer.from(sample).sort(),contrast=sorted[Math.floor(sorted.length*.95)]-sorted[Math.floor(sorted.length*.05)];
      assert.ok(contrast>40,id+' loses its silhouette at '+w+'px');
      reads[level].add(sample.toString('base64'));
    }
  }
  assert.deepEqual(reads.map(s=>s.size),[13,13]);
});
