import * as THREE from 'three';

type Node={bounds:THREE.Box3;start:number;end:number;left?:Node;right?:Node};
/** Keep the original triangle order. Trim only whole, guaranteed offscreen
 * index ranges before a camera or light draw; restore the full raycast range. */
export function installOrderedArchitecture(mesh:THREE.Mesh,minimum=40000,facesPerLeaf=64){
  const g=mesh.geometry,index=g.index,position=g.getAttribute('position');
  if(!index||g.groups.length||index.count/3<minimum||g.drawRange.start!==0||g.drawRange.count!==Infinity)return;
  const defaults=THREE.Object3D.prototype;
  if(mesh.onBeforeRender!==defaults.onBeforeRender||mesh.onAfterRender!==defaults.onAfterRender||mesh.onBeforeShadow!==defaults.onBeforeShadow||mesh.onAfterShadow!==defaults.onAfterShadow)return;
  const leaves:Node[]=[],p=new THREE.Vector3();
  for(let first=0;first<index.count;first+=3*facesPerLeaf){
    const end=Math.min(index.count,first+3*facesPerLeaf),bounds=new THREE.Box3();
    for(let j=first;j<end;j++)bounds.expandByPoint(p.fromBufferAttribute(position,index.getX(j)));
    if(g.userData.tideBoundsMargin){bounds.min.y-=g.userData.tideBoundsMargin;bounds.max.y+=g.userData.tideBoundsMargin;}
    leaves.push({bounds,start:first,end});
  }
  function join(lo:number,hi:number):Node{
    if(hi===lo+1)return leaves[lo];
    const mid=(hi+lo)>>1,left=join(lo,mid),right=join(mid,hi);
    return {bounds:left.bounds.clone().union(right.bounds),start:left.start,end:right.end,left,right};
  }
  const root=join(0,leaves.length),clip=new THREE.Matrix4(),prev=new THREE.Matrix4(),f=new THREE.Frustum();
  function edge(n:Node,back:boolean):number{
    if(!f.intersectsBox(n.bounds))return -1;
    if(!n.left||!n.right)return back?n.end:n.start;
    const a=edge(back?n.right:n.left,back);
    return a>=0?a:edge(back?n.left:n.right,back);
  }
  // Each extra opaque draw must eliminate at least 8,192 triangles. At
  // most three additional draws are worthwhile even in the largest district.
  const gapMinimum=8192*3,maxGaps=3;
  const breaks:{start:number;end:number}[]=Array.from({length:maxGaps},()=>({start:0,end:0}));
  let gapCount=0,first=0,end=index.count,lastSplit=false,canSplit=false,prepared=false;
  function admit(start:number,stop:number){
    if(first<0)first=start;
    else if(start-end>=gapMinimum){
      // Keep the largest gaps. Ordered insertion avoids allocating or sorting
      // a list of every visible leaf when several thousand face the camera.
      let slot=gapCount;
      if(slot===maxGaps){
        slot=0;
        for(let i=1;i<maxGaps;i++)if(breaks[i].end-breaks[i].start<breaks[slot].end-breaks[slot].start)slot=i;
        if(start-end<=breaks[slot].end-breaks[slot].start){end=stop;return;}
      }else gapCount++;
      const gap=breaks[slot];
      for(let i=slot+1;i<gapCount;i++)breaks[i-1]=breaks[i];
      gap.start=end;gap.end=start;breaks[gapCount-1]=gap;
    }
    end=stop;
  }
  function visit(n:Node,mask:number){
    const {min,max}=n.bounds;
    for(let i=0;i<6;i++)if(mask&(1<<i)){
      const {normal:{x,y,z},constant}=f.planes[i];
      if(x*(x>=0?max.x:min.x)+y*(y>=0?max.y:min.y)+z*(z>=0?max.z:min.z)+constant<0)return;
      if(x*(x>=0?min.x:max.x)+y*(y>=0?min.y:max.y)+z*(z>=0?min.z:max.z)+constant>=0)mask&=~(1<<i);
    }
    if(mask&&n.left&&n.right){visit(n.left,mask);visit(n.right,mask);}
    else admit(n.start,n.end);
  }
  function select(cam:THREE.Camera,split=false){
    clip.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).multiply(mesh.matrixWorld);
    if(!prepared||!prev.equals(clip)||lastSplit!==split){
      prepared=true;
      prev.copy(clip);lastSplit=split;f.setFromProjectionMatrix(clip,cam.coordinateSystem,cam.reversedDepth);
      gapCount=0;
      if(split){first=-1;end=0;visit(root,63);}
      else{first=edge(root,false);end=first<0?first:edge(root,true);}
    }
    g.setDrawRange(Math.max(0,first),first<0?0:(gapCount?breaks[0].start:end)-first);
  }
  const wholeGeometry={start:0,count:index.count,materialIndex:0};
  const reset=()=>g.setDrawRange(0,Infinity);
  mesh.onBeforeRender=(r,scene,cam,_geometry,material,group)=>{
    canSplit=index.count>=gapMinimum*8&&!!r?.renderBufferDirect&&!group&&!scene?.overrideMaterial&&
      material===mesh.material&&!material.transparent&&material.colorWrite&&material.depthWrite;
    select(cam,canSplit);
  };
  mesh.onAfterRender=(r,scene,cam,geometry,material)=>{
    try{
      // renderBufferDirect submits the same mesh/material without re-entering
      // Object3D render callbacks. Opaque triangle order and depth ties survive.
      if(canSplit)for(let i=0;i<gapCount;i++){
        const start=breaks[i].end,stop=i+1<gapCount?breaks[i+1].start:end;
        g.setDrawRange(start,stop-start);
        r.renderBufferDirect(cam,scene,geometry,material,mesh,wholeGeometry);
      }
    }finally{canSplit=false;reset();}
  };
  mesh.onBeforeShadow=(_r,_s,_cam,light)=>select(light);mesh.onAfterShadow=reset;
  return {select,leaves:leaves.length};
}
