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
  let first=0,count=index.count;
  function select(cam:THREE.Camera){
    clip.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse).multiply(mesh.matrixWorld);
    if(!prev.equals(clip)){
      prev.copy(clip);f.setFromProjectionMatrix(clip,cam.coordinateSystem,cam.reversedDepth);
      first=edge(root,false);count=first<0?0:edge(root,true)-first;
    }
    g.setDrawRange(Math.max(0,first),count);
  }
  const reset=()=>g.setDrawRange(0,Infinity);
  mesh.onBeforeRender=(_r,_s,cam)=>select(cam);mesh.onAfterRender=reset;
  mesh.onBeforeShadow=(_r,_s,_cam,light)=>select(light);mesh.onAfterShadow=reset;
  return {select,leaves:leaves.length};
}
