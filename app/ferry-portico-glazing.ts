import {openingIrradiance} from './authored-window-spill.ts';
import * as THREE from 'three';
type Pt=[number,number,number];

// West-elevation local axes: +Z faces Market Street. Pack the sash, reveals
// and shop interiors into a single opaque vertex-colour mesh per arcade.
export function ferryGlazing(parent:THREE.Group){
  const pos:number[]=[],col:number[]=[],light:number[]=[],ix:number[]=[],ink=new THREE.Color();
  const redwood='#675f50',bronze='#49514d',metal='#868e80',warm='#b6a076',glass='#536768';
  let illumination=.065;
  function quad(a:Pt,b:Pt,c:Pt,d:Pt,tint:string){
    const n=pos.length/3;ink.set(tint);
    for(const p of [a,b,c,d]){pos.push(...p);col.push(ink.r,ink.g,ink.b);light.push(Math.round(255*ink.r*illumination),Math.round(239*ink.g*illumination),Math.round(213*ink.b*illumination));}
    ix.push(n,n+1,n+2,n,n+2,n+3);
  }
  function pane(x:number,y:number,z:number,w:number,h:number,tint:string){
    quad([x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z],tint);
  }
  function beam(x0:number,y0:number,x1:number,y1:number,z:number,w:number,tint:string){
    const dx=x1-x0,dy=y1-y0,s=w/(2*Math.hypot(dx,dy));
    quad([x0+dy*s,y0-dx*s,z],[x1+dy*s,y1-dx*s,z],[x1-dy*s,y1+dx*s,z],[x0-dy*s,y0+dx*s,z],tint);
  }
  function returnWall(x:number,bottom:number,top:number,z:number,back:number,left:boolean){
    const a:Pt=[x,bottom,z],b:Pt=[x,bottom,back],c:Pt=[x,top,back],d:Pt=[x,top,z];
    if(left)quad(a,b,c,d,'#9e9987');else quad(b,a,d,c,'#888a7d');
    for(let y=bottom+.08;y<top;y+=.102){
      if(left)quad([x+.001,y,z],[x+.001,y,back],[x+.001,y+.003,back],[x+.001,y+.003,z],'#777b70');
      else quad([x-.001,y,back],[x-.001,y,z],[x-.001,y+.003,z],[x-.001,y+.003,back],'#777b70');
    }
  }
  // Page & Turnbull existing photo, exhibit 46: metal-framed half-round
  // lights, patterned upper glazing and rectangular operable lights below.
  function fanlight(x:number,w:number,bottom:number,top:number,z:number){
    const r=w/2,spring=top-r;
    const roof=(u:number)=>spring+Math.sqrt(Math.max(0,r*r-u*u));
    const tints=['#445757','#64716b','#3f5151','#596964'];
    for(let i=0;i<18;i++){
      const a=-r+i*w/18,b=-r+(i+1)*w/18;
      quad([x+a,bottom,z],[x+b,bottom,z],[x+b,roof(b),z],[x+a,roof(a),z],tints[Math.floor(i/3)%4]);
    }
    for(let i=1;i<6;i++){
      const u=(i/6-.5)*w,h=roof(u)-bottom;
      pane(x+u,bottom+h/2,z+.004,.005,h,metal);
    }
    pane(x,spring,z+.006,w,.008,metal);
    pane(x,(spring+bottom)/2,z+.005,w,.007,metal);
    // Diagonal glazing bars in the upper semicircle, clipped to the spring line.
    for(const slope of [-1,1])for(const intercept of [-.4,.06,.52,.98]){
      const d=intercept*r,root=Math.sqrt(2*r*r-d*d);
      let a=(-slope*d-root)/2,b=(-slope*d+root)/2;
      if(slope===1)a=Math.max(a,-d);else b=Math.min(b,d);
      if(b>a)beam(x+a,spring+slope*a+d,x+b,spring+slope*b+d,z+.008,.0045,metal);
    }
  }
  function doors(x:number,w:number,z:number,lo:number,h:number,open=false){
    const hi=lo+h,doorTop=lo+h*.74,leaf=w*.32;
    pane(x,hi-.005,z,w,.010,bronze);
    pane(x,doorTop,z+.002,w,.010,bronze);
    for(const dir of [-1,1]){
      const side=x+dir*(w/2-leaf)/2+dir*leaf;
      pane(side,(doorTop+lo)/2,z-.014,w*.149,doorTop-lo,'#60736e');
      for(const u of [w*.49,leaf])pane(x+dir*u,(hi+lo)/2,z+.003,.008,h,bronze);
      const hinge=x+dir*leaf,free=open?hinge-dir*.013:x+dir*.004;
      const nearZ=open?z-leaf+.003:z;
      const q=(u:number,y:number):Pt=>[hinge+(free-hinge)*u,y,z+(nearZ-z)*u];
      const face=(loY:number,hiY:number,tint:string)=>{
        if(dir===1)quad(q(1,loY),q(0,loY),q(0,hiY),q(1,hiY),tint);
        else quad(q(0,loY),q(1,loY),q(1,hiY),q(0,hiY),tint);
      };
      face(lo,lo+.029,redwood);face(doorTop-.007,doorTop,metal);
      if(!open){
        pane(free,(doorTop+lo)/2,z+.004,.005,doorTop-lo,bronze);
        pane(x+dir*.018,lo+.069,z+.008,.005,.029,warm);
      }
    }
  }
  function shop(x:number,w:number,z:number,seed:number,dining=false,serviceCounter=false){
    const lo=.106,hi=.324,back=z-.093;
    // Mullions are forward of a deep interior. Display counters, shelving and
    // warm panels sit on separate depth planes behind the shop windows.
    illumination=dining?1.32:seed%5===0?.27:seed%3===0?.68:1.02;
    pane(x,(lo+hi)/2,back,w,hi-lo,seed%2?'#525f58':'#635e51');
    if(!serviceCounter){
      pane(x-w*.23,lo+.112,back+.004,w*.38,.125,seed%3?'#9b927a':'#828c7a');
      for(let j=0;j<2;j++)pane(x-w*.23,lo+.094+j*.038,back+.007,w*.38,.007,redwood);
      pane(x+w*.20,lo+.031,back+.034,w*.43,.058,'#857861');
      pane(x+w*.20,lo+.062,back+.036,w*.47,.008,warm);
    }
    const roomLevel=illumination,firstTrim=pos.length;
    illumination=.065;
    const entrance=seed%4===0;
    if(entrance)doors(x,w,z,lo,hi-lo);
    else{
      for(const dir of [-1,0,1])pane(x+dir*w*.485,(hi+lo)/2,z,.007,hi-lo,bronze);
      pane(x,hi-.045,z+.002,w,.009,metal);
      pane(x,lo+.018,z+.001,w,.034,redwood);
    }
    // Glazed transom captures a strip of reflected sky.
    pane(x+w*.24,hi-.021,z-.002,w*.42,.035,glass);
    // The opaque interiors and their trim occupy different depth planes in
    // this prepacked mesh. Only the trim of this particular room receives it.
    const a=new THREE.Vector3(),b=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let j=firstTrim;j<pos.length;j+=12){
      a.fromArray(pos,j);b.fromArray(pos,j+3).sub(a);
      normal.fromArray(pos,j+6).sub(a).crossVectors(b,normal).normalize();
      for(let k=j;k<j+12;k+=3){
        const strength=roomLevel*.44*openingIrradiance(x,(lo+hi)/2,back+.038,w,hi-lo,
          pos[k],pos[k+1],pos[k+2],normal.x,normal.y,normal.z);
        light[k]=Math.min(255,light[k]+Math.round(255*col[k]*strength));
        light[k+1]=Math.min(255,light[k+1]+Math.round(166*col[k+1]*strength));
        light[k+2]=Math.min(255,light[k+2]+Math.round(92*col[k+2]*strength));
      }
    }
  }
  function finish(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('signLight',new THREE.Uint8BufferAttribute(light,3,true));
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(ix);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82}));
    mesh.name='Recessed west glazing and shop interiors';mesh.castShadow=mesh.receiveShadow=true;
    parent.add(mesh);
  }
  return {pane,returnWall,fanlight,doors,shop,finish};
}
