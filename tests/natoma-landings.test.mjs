import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createLandscape} from '../app/landscape.ts';
import survey from '../public/data/natoma-landings.json' with {type:'json'};

const ex=.15135,ez=Math.sqrt(1-ex*ex);
function crop(u,v,y){
  const s=(u-414)/24,d=(v+543)/24;
  return new T.Vector3(-22.938495+.06*(s*ex-d*ez),y,-32.902787+.06*(s*ez+d*ex));
}
test('both Natoma ramps have continuous single-owner paving, flush mouths and resolved warning surfaces',()=>{
  const {root}=createLandscape();root.updateMatrixWorld(true);
  const eye=new T.Vector3(-30.61555576,.1018,-31.42537578);
  const box=new T.Box3().setFromPoints([eye,...[[90,180],[625,180],[90,410],[625,410]].map(p=>crop(...p,.04))]).expandByScalar(.20);
  const meshes=[];
  root.traverse(m=>{if(m.isMesh&&new T.Box3().setFromObject(m).intersectsBox(box))meshes.push(m);});
  const down=new T.Vector3(0,-1,0),ray=new T.Raycaster(undefined,down,0,.07);
  const all=(u,v)=>{
    ray.ray.origin.copy(crop(u,v,.09));
    return ray.intersectObjects(meshes,false).filter(h=>h.face.normal.y>.6&&!h.object.name.endsWith(' paint'));
  };
  const ys=(u,v)=>all(u,v).map(h=>h.point.y);
  for(const [name,ids] of Object.entries(survey.faces)){
    if(name==='face')continue;
    for(let i=0;i<ids.length;i+=3){
      const [a,b,c]=ids.slice(i,i+3).map(id=>survey.vertices[id]);
      const p=a.map((v,j)=>v*.23+b[j]*.33+c[j]*.44);
      const hits=all(p[0],p[1]);
      assert.equal(hits.length,1,'one physical surface '+[name,...p,hits.length]);
      assert.ok(Math.abs(hits[0].point.y-p[2])<.00002);
      if(name==='warning'){
        const {geometry:g}=hits[0].object;
        assert.ok(g.attributes.walkPanel.getX(hits[0].face.a)>1024);
      }
    }
  }
  // Cross each imported section end on asphalt, cap and sidewalk. On the
  // legacy side the buried roadway may also be present under the curb asset.
  // The first visible surface must meet the rebuilt cross section.
  for(const [start,v] of [['west',278],['west',389],['east',190],['east',374]]){
    const ring=survey.vertices.filter(p=>p[1]===v&&(start==='west'?p[0]<350:p[0]>350));
    const cap=ring.filter(p=>p[2]===.049).map(p=>p[0]);
    const sign=start==='west'?1:-1;
    const mid=(Math.min(...cap)+Math.max(...cap))/2;
    const lip=sign===1?Math.max(...cap):Math.min(...cap);
    for(const shift of [-.65,.65]){
      for(const [skew,eyeHeight] of [[0,.039],[2,.041]]){
        const origin=crop(lip+28*sign,v+shift+skew,eyeHeight);
        const aim=crop(lip,v+shift,.039).sub(origin).normalize();
        const r=new T.Raycaster(origin,aim,0,.145);
        const front=r.intersectObjects(meshes,false)[0];
        assert.ok(front,'street-facing stone at '+[start,v,shift]);
        const face=front.face,g=front.object.geometry;
        assert.ok(Math.abs(face.normal.y)<.01&&face.normal.dot(aim)<-.10);
        const rgb=new T.Color().fromBufferAttribute(g.attributes.color,face.a);
        assert.equal(rgb.getHexString(),'d1cbb6');
        assert.equal(g.attributes.roadExposure.getX(face.a),1);
        assert.ok(front.point.y>.036&&front.point.y<.043);
      }
    }
    for(const x of [mid-18*sign,mid,mid+16*sign]){
      const a=ys(x,v-.018)[0],b=ys(x,v+.018)[0];
      assert.ok(Math.abs(a-b)<.00011,'continuous parcel join '+[x,v,a,b]);
    }
  }
  for(const [u,v,road] of [[211,324,1],[511,235,-1]]){
    assert.ok(Math.abs(ys(u+road*4,v)[0]-.031)<.00002);
    assert.ok(Math.abs(ys(u-road*2,v)[0]-.0312)<.00003);
    assert.ok(ys(u-road*26,v)[0]>.034);
    assert.ok(Math.abs(ys(u-road*75,v)[0]-.045)<.0001,'inner grade '+[u,v,...ys(u-road*75,v)]);
  }
  // Both visible ochre panels occupy the fitted slope, now aimed at the
  // crossing. The closer centered approach can see both; the distant
  // windshield at Howard now looks into the solid foreground curb cheek.
  for(const [u,v] of [[194,323],[538,229]]){
    const from=crop(363,730,.031+1.55*.06);
    const hit=all(u,v)[0];
    assert.ok(hit.object.geometry.attributes.walkPanel?.getX(hit.face.a)>1024);
    const direction=hit.point.clone().sub(from),distance=direction.length();
    const sight=new T.Raycaster(from,direction.normalize(),.06,distance+.0003);
    const front=sight.intersectObjects(meshes,false)[0];
    assert.ok(front?.object===hit.object,'visible panel from the centered approach');
    const farDirection=hit.point.clone().sub(eye),far=farDirection.length();
    const farRay=new T.Raycaster(eye,farDirection.normalize(),.06,far+.0003);
    const curb=farRay.intersectObjects(meshes,false)[0];
    assert.ok(curb&&curb.distance<far-.03&&Math.abs(curb.face.normal.y)<.01);
    assert.equal(new T.Color().fromBufferAttribute(curb.object.geometry.attributes.color,curb.face.a).getHexString(),'d1cbb6');
  }
});
