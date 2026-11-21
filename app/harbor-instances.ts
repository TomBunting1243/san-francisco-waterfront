import * as THREE from 'three';
import {createInstancedMesh2From} from '@three.ez/instanced-mesh';

type Cell={ids:number[];bounds:THREE.Box3};

// Bound the full night aperture for rooms that can emit. Its bottom and top
// extend by different amounts; permanently dark rooms retain their unit quad.
function paneCells(windows:THREE.InstancedMesh){
  const data=windows.instanceMatrix.array,cells=new Map<string,Cell>();
  const owners:Cell[]=[];
  const glow=windows.geometry.getAttribute('windowGlow');
  function enclose(cell:Cell,id:number){
    const i=id*16,lit=glow.getX(id)>0;
    for(let axis=0;axis<3;axis++){
      const center=data[i+12+axis]-(lit?.016:0)*data[i+4+axis];
      const half=(lit?.533:.5)*Math.abs(data[i+axis])+(lit?.538:.5)*Math.abs(data[i+4+axis]);
      cell.bounds.min.setComponent(axis,Math.min(cell.bounds.min.getComponent(axis),center-half));
      cell.bounds.max.setComponent(axis,Math.max(cell.bounds.max.getComponent(axis),center+half));
    }
  }
  for(let id=0;id<windows.count;id++){
    const i=id*16,key=Math.floor(data[i+12]/5)+','+Math.floor(data[i+13]/4)+','+Math.floor(data[i+14]/5);
    let cell=cells.get(key);
    if(!cell){cell={ids:[],bounds:new THREE.Box3()};cells.set(key,cell);}
    cell.ids.push(id);owners[id]=cell;enclose(cell,id);
  }
  const matrix=new THREE.Matrix4(),previous=new THREE.Matrix4(),frustum=new THREE.Frustum();
  let dirty=true;
  function select(camera:THREE.Camera,world:THREE.Matrix4,ids:THREE.TypedArray){
    matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(world);
    if(!dirty&&previous.equals(matrix))return;
    previous.copy(matrix);dirty=false;
    frustum.setFromProjectionMatrix(matrix,camera.coordinateSystem,camera.reversedDepth);
    let count=0;
    for(const {ids:rooms,bounds:{min,max}} of cells.values()){
      let mask=0,outside=false;
      for(let j=0;j<6;j++){
        const {normal:{x,y,z},constant}=frustum.planes[j];
        if(x*(x>=0?max.x:min.x)+y*(y>=0?max.y:min.y)+z*(z>=0?max.z:min.z)+constant<0){outside=true;break;}
        if(x*(x>=0?min.x:max.x)+y*(y>=0?min.y:max.y)+z*(z>=0?min.z:max.z)+constant<0)mask|=1<<j;
      }
      if(outside)continue;
      if(!mask){ids.set(rooms,count);count+=rooms.length;continue;}
      for(const id of rooms){
        const i=id*16,lit=glow.getX(id)>0;
        let visible=true;
        for(let j=0;j<6;j++)if(mask&(1<<j)){
          const {normal:{x,y,z},constant}=frustum.planes[j];
          const distance=x*data[i+12]+y*data[i+13]+z*data[i+14]+constant;
          const vertical=x*data[i+4]+y*data[i+5]+z*data[i+6];
          const extent=(lit?.533:.5)*Math.abs(x*data[i]+y*data[i+1]+z*data[i+2])+(lit?.538:.5)*Math.abs(vertical)-(lit?.016:0)*vertical;
          if(distance+extent<0){visible=false;break;}
        }
        if(visible)ids[count++]=id;
      }
    }
    return count;
  }
  return {select,move(id:number){enclose(owners[id],id);dirty=true;}};
}

export function cullHarborInstances(renderer:THREE.WebGLRenderer,root:THREE.Group,windows:THREE.InstancedMesh){
  // Supply the library's bulk copier with the original arrays. Its native
  // geometry clone should only contain vertex attributes; room occupancy is
  // addressed by stable source ID in the per-instance texture below.
  const attributes=new THREE.BufferGeometry();
  attributes.index=windows.geometry.index;
  for(const [name,attribute] of Object.entries(windows.geometry.attributes)){
    if(name!=='windowGlow')attributes.setAttribute(name,attribute);
  }
  const source=new THREE.InstancedMesh(attributes,windows.material,0);
  source.count=windows.count;source.instanceMatrix=windows.instanceMatrix;source.instanceColor=windows.instanceColor;
  const panes=createInstancedMesh2From(source,{capacity:windows.count,renderer});
  panes.name='Visible waterfront windows';
  panes.initUniformsPerInstance({vertex:{windowGlow:'float'}});
  panes.uniformsTexture.image.data!.set(windows.geometry.getAttribute('windowGlow').array);
  const cells=paneCells(windows);
  panes.frustumCulled=false;
  panes.performFrustumCulling=camera=>{
    const attribute=panes.instanceIndex;
    const count=cells.select(camera,panes.matrixWorld,attribute.array);
    if(count===undefined)return;
    panes.count=count;
    if(count){
      // InstancedMesh2's public GL buffer is read on this same draw. The
      // ordinary Three attribute upload has already happened by onBeforeRender.
      const gl=renderer.getContext();
      gl.bindBuffer(gl.ARRAY_BUFFER,attribute.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER,0,attribute.array,0,count);
    }
  };
  const sourceVisible=windows.visible;
  panes.position.copy(windows.position);panes.quaternion.copy(windows.quaternion);panes.scale.copy(windows.scale);
  panes.matrix.copy(windows.matrix);panes.matrixAutoUpdate=windows.matrixAutoUpdate;
  windows.visible=false;(windows.parent??root).add(panes);
  const cranes=root.getObjectByName('Port of Oakland ship-to-shore cranes');
  let port:ReturnType<typeof createInstancedMesh2From>|undefined;
  const craneVisible=cranes?.visible;
  if(cranes instanceof THREE.InstancedMesh&&cranes.parent){
    port=createInstancedMesh2From(cranes,{renderer,capacity:cranes.count});
    port.name='Visible port crane steelwork';port.computeBVH();
    cranes.parent.add(port);cranes.visible=false;
  }
  const matrix=new THREE.Matrix4();
  return {
    updateTidalPane(i:number){windows.getMatrixAt(i,matrix);panes.setMatrixAt(i,matrix);cells.move(i);},
    dispose(){
      panes.removeFromParent();panes.dispose();panes.geometry.dispose();windows.visible=sourceVisible;
      if(port){port.removeFromParent();port.dispose();port.geometry.dispose();}
      if(cranes&&craneVisible!==undefined)cranes.visible=craneVisible;
    },
  };
}
