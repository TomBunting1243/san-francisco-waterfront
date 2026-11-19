import * as THREE from 'three';
import {FacadePanels,type FacadePoint} from './facade-panels.ts';

type Plan=[number,number];
type UV=[number,number];
const grade=.054,metre=.06;
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.67});
const lerp=THREE.MathUtils.lerp;
const mix=(a:Plan,b:Plan,t:number):Plan=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t)];
const world=(p:Plan,h:number):FacadePoint=>[p[0],grade+h*metre,p[1]];
const bare=[0,0,-1,0];

// A300, clockwise viewed in plan from above. Start at the Transbay/Beale
// end, pass the Fremont/Transbay mast corner, then the recessed southeast bay.
const cornerIndices=[0,4,6,7,8,9];
const roofInsets:Plan[]=[[-.08,-.49],[-.095,.104],[.13,.125],[.13,-.035],[-.06,.13],[-.04,-.42]];
const crest=[216,227,216.5,218,219,222];
const upperSteel='#9ba7a7',steel='#a5afae',steelEdge='#738184';

export function build181Fremont(ring:number[][]){
  const panels=new FacadePanels(),grid:number[]=[];
  const ground=cornerIndices.map(i=>ring[i] as Plan);
  const roof=ground.map(([x,z],i):Plan=>[x+roofInsets[i][0],z+roofInsets[i][1]]);
  // The four large corner columns taper linearly. On each face the
  // curtain wall folds back from the straight brace into triangular planes.
  const at=(i:number,h:number)=>mix(ground[i],roof[i],Math.min(1,h/210));
  function plate(vertices:FacadePoint[],color:string,uv?:number[][]){
    if(vertices.length===4)panels.quad(vertices[0],vertices[1],vertices[2],vertices[3],color);
    else panels.triangle(vertices[0],vertices[1],vertices[2],color);
    for(let i=0;i<vertices.length;i++)grid.push(...(uv?.[i]??bare));
  }
  function tube(a:FacadePoint,b:FacadePoint,half:number,endHalf:number,color:string){
    const source=new THREE.Vector3(...a),target=new THREE.Vector3(...b);
    const axis=target.clone().sub(source).normalize();
    const across=new THREE.Vector3().crossVectors(axis,new THREE.Vector3(0,0,1)).normalize();
    const side=new THREE.Vector3().crossVectors(axis,across);
    const corners=(p:THREE.Vector3,r:number)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>
      p.clone().addScaledVector(across,r*u).addScaledVector(side,r*v).toArray() as FacadePoint);
    const lo=corners(source,half),hi=corners(target,endHalf);
    for(let i=0;i<4;i++){const j=(i+1)%4;plate([lo[i],lo[j],hi[j],hi[i]],color);}
    plate(hi,color);
  }
  // Fraction along each mapped side, left to right when seen from outside.
  // The two short notch returns have glazing but no independent megabraces.
  const nodes=[
    [.03,.97,.05,.96], [.97,.03,.96,.04], [.03,.96,.06,.96],
    null,null,[.95,.04,.91,.04],
  ];
  const levels=[0,8.5,79,142,149,210],courses=[0,1,19,36,38,55];
  for(let i=0;i<ground.length;i++){
    const j=(i+1)%ground.length;
    const dx=ground[j][0]-ground[i][0],dz=ground[j][1]-ground[i][1],len=Math.hypot(dx,dz);
    const nx=-dz/len,nz=dx/len;
    const point=(u:number,h:number,d:number):FacadePoint=>{
      const p=mix(at(i,h),at(j,h),u);
      return world([p[0]+nx*d,p[1]+nz*d],h);
    };
    const bays=Math.max(3,Math.round(len/.104)),node=nodes[i];
    const anchors=node?[node[0],node[0],node[1],node[2],node[2],node[3]]:[.5,.5,.5,.5,.5,.5];
    for(let s=0;s<levels.length-1;s++){
      const bottom=levels[s],top=levels[s+1],office=s<4;
      const ridge=(v:number)=>lerp(anchors[s],anchors[s+1],v);
      const start=point(anchors[s],bottom,0),end=point(anchors[s+1],top,0);
      const surface=(u:number,v:number,d=0):FacadePoint=>{
        const h=lerp(bottom,top,v),r=ridge(v);
        const crest=point(r,h,0),p=point(u,h,d);
        const weight=Math.min(u/r,(1-u)/(1-r));
        // The ridge interpolates between two physical steel connections.
        // Use it as a seam so the broader triangular glass planes reach
        // the straight steel at intermediate storeys as well as at each node.
        p[0]+=weight*(lerp(start[0],end[0],v)-crest[0]);
        p[2]+=weight*(lerp(start[2],end[2],v)-crest[2]);
        return p;
      };
      const belt=s===3;
      const fullHeight=s!==0&&!belt;
      // Each sawtooth is clipped along the structural fold. Both setbacks
      // therefore meet the same diagonal and each side gets its own normal.
      for(let k=0;k<bays;k++){
        const a=k/bays,b=(k+1)/bays,solar=(i===1||i===2);
        const rib=b-(solar?.18:.1)/bays;
        for(const [left,right,front,back] of [[a,rib,0,.008],[rib,b,.008,0]]){
          const outline:UV[]=[[left,0],[right,0],[right,1],[left,1]];
          for(const sign of [-1,1]){
            const clipped:UV[]=[];
            outline.forEach((v,n)=>{
              const w=outline[(n+1)%4],da=sign*(v[0]-ridge(v[1])),db=sign*(w[0]-ridge(w[1]));
              if(da>=0)clipped.push(v);
              if(da*db<0)clipped.push(mix(v,w,da/(da-db)));
            });
            const col=left===rib?'#849395':belt?'#708487':s===0?'#6c8286':sign<0?'#849b9e':'#778f95';
            const glass=left!==rib&&!belt;
            function polygon(vertices:UV[]){
              plate(vertices.map(([u,v])=>surface(u,v,lerp(front,back,(u-left)/(right-left)))),col,
                glass?vertices.map(([u,v])=>[u*bays,lerp(courses[s],courses[s+1],v),2,(office?256:128)+11+i]):undefined);
            }
            if(clipped.length===3||clipped.length===4)polygon(clipped);
            else for(let k=1;k<clipped.length-1;k++)polygon([clipped[0],clipped[k],clipped[k+1]]);
          }
        }
      }
      if(node&&fullHeight){
        const lower=surface(anchors[s],0,.017),upper=surface(anchors[s+1],1,.017);
        tube(lower,upper,office?.023:.014,office?.023:.014,office?steel:upperSteel);
      }
      if(node&&belt){
        const mid=surface(.5,1,.015);
        tube(surface(.02,0,.012),mid,.012,.012,upperSteel);
        tube(mid,surface(.98,0,.012),.012,.012,upperSteel);
      }
    }
    // The exposed corner columns continue past each office transfer node.
    if(i!==4)tube(world(ground[i],0),world(roof[i],210),.024,.012,steelEdge);
    const edge0=world(roof[i],crest[i]),edge1=world(roof[j],crest[j]);
    const base=213.36;
    const along=(t:number,h:number)=>world(mix(roof[i],roof[j],t),h);
    const outer=(a:number,b:number,bottom:number,ha:number,hb:number,color:string)=>{
      const face=[along(a,bottom),along(b,bottom),along(b,hb),along(a,ha)];
      plate(face,color);plate(face.slice().reverse(),color);
    };
    outer(0,1,210,base,base,'#677b82');
    const screenBays=Math.max(3,Math.round(len/.18)),height=(t:number)=>lerp(crest[i],crest[j],t);
    // H.T. Harvey's crown study (p.12): the outer glass fills 70% of
    // each module; the inner screen behind the framing fills half.
    for(let k=0;k<screenBays;k++){
      const a=k/screenBays,b=(k+.70)/screenBays;
      outer(a+.025/screenBays,b,base,height(a+.025/screenBays),height(b),k%3===0?'#9eafb0':'#b0bbbb');
      outer(a,a+.025/screenBays,base,height(a),height(a+.025/screenBays),'#778689');
    }
    tube(edge0,edge1,.023,.023,'#aab4b5');
    if(i===0||i===1)tube(i===0?along(0,210):along(1,210),world(roof[1],227),.026,.026,upperSteel);
  }
  const tris=THREE.ShapeUtils.triangulateShape(roof.map(([x,z])=>new THREE.Vector2(x,-z)),[]);
  for(const tri of tris)plate(tri.map(i=>world(roof[i],210)),'#7e8180');
  // The 2024 SF 8 cm aerial resolves the two SE fan cells, central
  // housings and northern plant. Normalize its roof axes to the model's
  // terrace: east from Fremont and south from Transbay. The southeast
  // reentrant bay limits the plant aisle at the south end.
  const plant=(e:number,s:number,h:number)=>world(mix(mix(roof[1],roof[0],e),mix(roof[2],roof[3],e),s),h);
  function housing(l:number,r:number,n:number,s:number,base:number,top:number){
    const ring=[[l,n],[l,s],[r,s],[r,n]];
    for(let i=0;i<4;i++){
      const [x,z]=ring[i],[u,v]=ring[(i+1)%4];
      plate([plant(x,z,base),plant(u,v,base),plant(u,v,top),plant(x,z,top)],'#788182');
    }
    plate([plant(l,n,top),plant(l,s,top),plant(r,s,top),plant(r,n,top)],'#b7bab3');
  }
  housing(.22,.56,.36,.59,210,216.2);
  housing(.24,.42,.61,.85,210,214.6);
  housing(.25,.83,.13,.28,210,215.8);
  housing(.42,.79,.26,.34,210,214.1);
  housing(.78,.90,.41,.64,210,215.4);
  housing(.52,.915,.68,.92,210,213.8);
  for(const e of [.619,.81]){
    const p=plant(e,.80,213.8),radius=.112;
    const circle=(t:number,r:number,up:number):FacadePoint=>[p[0]+r*Math.cos(t),p[1]+up,p[2]+r*Math.sin(t)];
    for(let k=0;k<14;k++){
      const a=k*Math.PI/7,b=(k+1)*Math.PI/7;
      plate([circle(a,radius,.009),circle(a,radius*.88,.009),circle(b,radius*.88,.009),circle(b,radius,.009)],'#a9aaa2');
      plate([circle(0,0,.005),circle(b,radius*.88,.005),circle(a,radius*.88,.005)],'#546064');
    }
    for(let k=0;k<7;k++){
      const a=k*Math.PI*2/7;
      plate([circle(a,.012,.012),circle(a+.58,radius*.83,.012),circle(a+.26,radius*.81,.012)],'#959d99');
    }
  }
  // Two shorter banks behind the big frame complete the opposing corners.
  for(const [ea,sa,eb,sb,ha,hb] of [[.09,.92,.10,.13,222.6,215.2],[.10,.13,.89,.11,215.2,222.1],
    [.89,.11,.88,.81,222.1,215.2],[.88,.81,.09,.92,215.2,222.6]]){
    const inner=(t:number,h:number)=>plant(lerp(ea,eb,t),lerp(sa,sb,t),h);
    for(let k=0;k<9;k++){
      const a=k/9,b=(k+.5)/9;
      const face=[inner(a,213.5),inner(b,213.5),inner(b,lerp(ha,hb,b)),inner(a,lerp(ha,hb,a))];
      plate(face,'#aeb9b7');plate(face.slice().reverse(),'#a3aead');
    }
    tube(inner(0,ha),inner(1,hb),.009,.009,upperSteel);
  }
  // The owner photograph shows a continuous, folded aluminium-clad corner
  // column from the belt of glass through the roof rake to a tapered blade.
  tube(world(roof[1],210),world(roof[1],227),.054,.054,'#b0b9b8');
  tube(world(roof[1],227),world(roof[1],244.05),.054,.006,'#bdc6c4');
  tube(world(roof[1],244.05),world(roof[1],244.5),.005,.002,'#798589');
  const mesh=panels.mesh(material);
  mesh.geometry.setAttribute('facadeGrid',new THREE.Float32BufferAttribute(grid,4));
  mesh.geometry.userData.paintVertices=true;
  mesh.name='181 Fremont • office megaframe, residential glass and corner spire';
  mesh.castShadow=mesh.receiveShadow=true;
  return mesh;
}
