import * as THREE from 'three';

const scale=.06;
// Centers in project coordinates. Angle gives the line of the row, from +x toward +z.
// The OSM points locate groups. Individual anchor locations and spacing are inferred.
export const ferryRackSites=[
  {osm:386613961,x:-1.2322,z:-11.6506,y:.045,count:2,angle:1.42,pitch:1.08},
  {osm:6530508350,x:-2.4456,z:-11.7475,y:.045,count:3,angle:1.42,pitch:1.08},
  {osm:10780426460,x:-2.5954,z:2.392,y:.096,count:6,angle:.15,pitch:.91},
] as const;

type RackMesh={positions:number[]; colors:number[]; indices:number[]};
const silver=new THREE.Color('#9da6a5'),shade=new THREE.Color('#738383');
function addHoop({positions,colors,indices}:RackMesh,x:number,y:number,z:number,angle:number,path:number[][]){
  const facets=6,radius=.0265,c=Math.cos(angle),s=Math.sin(angle),base=positions.length/3;
  for(let k=0;k<path.length;k++){
    const prev=path[Math.max(0,k-1)],next=path[Math.min(path.length-1,k+1)];
    const tangent=Math.atan2(next[1]-prev[1],next[0]-prev[0]);
    for(let j=0;j<facets;j++){
      const a=j*2*Math.PI/facets,along=scale*radius*Math.sin(a);
      const across=scale*(path[k][0]-radius*Math.cos(a)*Math.sin(tangent));
      const height=scale*(path[k][1]+radius*Math.cos(a)*Math.cos(tangent));
      positions.push(x+c*along-s*across,y+height,z+s*along+c*across);
      const paint=j<3?silver:shade;colors.push(paint.r,paint.g,paint.b);
      if(k===path.length-1)continue;
      const v=base+k*facets+j,w=base+k*facets+(j+1)%facets;
      indices.push(v,v+facets,w,w,v+facets,w+facets);
    }
  }
}
function finishRacks({positions,colors,indices}:RackMesh,name:string){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.64}));
  mesh.name=name;return mesh;
}

// Both galvanized racks belong to SFMTA group 8515 at 98 Howard. The 2021
// agency photograph locates the individual feet to approximately two metres.
// The open rings narrow near the base. Dimensions above ground are estimated.
export function createHowardBikeRacks(){
  const buffers:RackMesh={positions:[],colors:[],indices:[]};
  for(const [u,v,du,dv] of [[431.4,1633.65,1.4,5.1],[438,1673.3,1.8,6]]){
    const c=.988686,s=.150004;
    const x=-25.894+(c*(u-300)+s*(v-1400))/200;
    const z=-12.650+(-s*(u-300)+c*(v-1400))/200;
    const dx=c*du+s*dv,dz=-s*du+c*dv;
    const foot=Math.hypot(du,dv)/24;
    const left=[[-foot,-.02],[-foot,.08],[-.31,.22],[-.36,.39],[-.35,.52],
      [-.30,.64],[-.22,.73],[-.12,.79]];
    const profile=[...left,[0,.815],...left.slice().reverse().map(([across,h])=>[-across,h])];
    addHoop(buffers,x,.045,z,Math.atan2(-dx,dz),profile);
  }
  return finishRacks(buffers,'98 Howard sidewalk bicycle racks');
}

/** All eleven stands and the two parked commuters share one indexed mesh. */
export function createFerryBikeRacks(){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  const path=[[-.39,0],[-.39,.65]];
  for(const side of [-1,1]){
    for(let i=0;i<=3;i++){
      const a=(side<0?Math.PI:(Math.PI/2))-i*Math.PI/6;
      if(side<0&&i===0)continue;
      path.push([side*.25+.14*Math.cos(a),.65+.14*Math.sin(a)]);
    }
  }
  path.push([.39,0]);
  const buffers={positions,colors,indices};
  for(const site of ferryRackSites){
    for(let stand=0;stand<site.count;stand++){
      const offset=(stand-(site.count-1)/2)*scale*site.pitch;
      addHoop(buffers,site.x+Math.cos(site.angle)*offset,site.y,site.z+Math.sin(site.angle)*offset,site.angle,path);
    }
  }
  // Two illustrative parked commuters occupy the outward side of an end stand.
  // Coordinates below are physical metres: longitudinal, vertical, lateral.
  type BikePoint=[number,number,number];
  const occupants=[
    {site:ferryRackSites[0],stand:0,side:-1,heading:1,paint:'#466e6b',stepThrough:true},
    {site:ferryRackSites[2],stand:5,side:1,heading:-1,paint:'#935137',stepThrough:false},
  ];
  for(const {site,stand,side,heading,paint,stepThrough} of occupants){
    const row=new THREE.Vector3(Math.cos(site.angle),0,Math.sin(site.angle));
    const along=new THREE.Vector3(-row.z,0,row.x);
    const center=new THREE.Vector3(site.x,site.y,site.z).addScaledVector(row,(stand-(site.count-1)/2)*site.pitch*scale);
    function point([x,h,z]:BikePoint){
      return center.clone().addScaledVector(along,x*heading*scale)
        .addScaledVector(row,(side*(.147-.13*h)+heading*z)*scale)
        .addScaledVector(up,h*scale);
    }
    const up=new THREE.Vector3(0,1,0);
    const pigments=new Map<string,THREE.Color>();
    function vertex(v:THREE.Vector3,tint:string){
      let col=pigments.get(tint);
      if(!col){col=new THREE.Color(tint);pigments.set(tint,col);}
      positions.push(v.x,v.y,v.z);colors.push(col.r,col.g,col.b);
      return positions.length/3-1;
    }
    function tube(a:BikePoint,b:BikePoint,r:number,tint:string,steps=5){
      const A=point(a),B=point(b),axis=B.clone().sub(A).normalize();
      const n=new THREE.Vector3().crossVectors(axis,Math.abs(axis.y)<.9?up:along).normalize();
      const m=new THREE.Vector3().crossVectors(axis,n),base=positions.length/3;
      for(const end of [A,B])for(let j=0;j<steps;j++){
        const phi=j*2*Math.PI/steps;
        vertex(end.clone().addScaledVector(n,r*scale*Math.cos(phi)).addScaledVector(m,r*scale*Math.sin(phi)),tint);
      }
      for(let j=0;j<steps;j++){
        const v=base+j,w=base+(j+1)%steps;
        indices.push(v,w,v+steps,w,w+steps,v+steps);
      }
    }
    const radius=.345;
    for(const hub of [-.535,.535]){
      // The lowest outer tyre sample is exactly on the supporting pavement.
      const base=positions.length/3,N=20;
      for(let j=0;j<N;j++){
        const a=j*2*Math.PI/N,si=Math.sin(a),co=Math.cos(a);
        for(const [r,z] of [[radius,0],[radius-.013,.018],[radius-.040,.011],[radius-.040,-.011],[radius-.013,-.018]]){
          vertex(point([hub+r*si,radius-r*co,z]),r<radius-.03?'#9a9f99':'#383b36');
        }
      }
      for(let j=0;j<N;j++)for(let k=0;k<5;k++){
        const a=base+j*5+k,b=base+(j+1)%N*5+k,c=base+(j+1)%N*5+(k+1)%5,d=base+j*5+(k+1)%5;
        indices.push(a,d,b,b,d,c);
      }
      for(let j=0;j<4;j++){
        const a=(j+.28)*Math.PI/4,dx=(radius-.04)*Math.cos(a),dy=(radius-.04)*Math.sin(a);
        tube([hub-dx,radius-dy,0],[hub+dx,radius+dy,0],.004,'#a0a49d',3);
      }
    }
    const bb:BikePoint=[-.083,.302,0],seat:BikePoint=[-.233,.77,0],head:BikePoint=[.354,.786,0];
    tube(bb,seat,.019,paint);tube(bb,[.386,.65,0],.026,paint);tube([.386,.65,0],head,.023,paint);
    tube(stepThrough?[-.135,.47,0]:seat,head,.021,paint);
    for(const z of [-.035,.035]){
      tube([-.535,.345,z],bb,.012,paint);tube([-.535,.345,z],seat,.012,paint);
      tube([.535,.345,z],[.386,.65,z/2],.014,paint);
    }
    // A horizontal shackle loops around the head/down-tube junction and the
    // neighboring vertical rack leg at 0.63 m. The outer bar closes the loop.
    const inward=-side*heading,h=.63;
    const lock:BikePoint[]=[[.329,h,-.029*inward],[.329,h,.087*inward],[.342,h,.102*inward],
      [.422,h,.102*inward],[.441,h,.087*inward],[.441,h,-.029*inward]];
    for(let k=1;k<lock.length;k++)tube(lock[k-1],lock[k],.007,'#818680',4);
    tube([.317,h,-.03*inward],[.453,h,-.03*inward],.014,'#414b4b',5);
    tube(seat,[-.259,.88,0],.013,'#828781');
    const saddle=[[-.36,-.056],[-.315,-.074],[-.26,-.068],[-.177,-.025],[-.152,-.016],
      [-.152,.016],[-.177,.025],[-.26,.068],[-.315,.074],[-.36,.056]];
    const saddleBase=positions.length/3;
    for(const h of [.877,.91])for(const [x,z] of saddle)
      vertex(point([x,h,z]),h>.89?'#625247':'#493f37');
    for(let j=0;j<saddle.length;j++){
      const v=saddleBase+j,w=saddleBase+(j+1)%saddle.length,n=saddle.length;
      indices.push(v,w,v+n,w,w+n,v+n);
      if(j>0&&j<n-1)indices.push(saddleBase+n,v+n,w+n,saddleBase,w,v);
    }
    tube(head,[.316,.95,0],.014,'#90968e');tube([.316,.95,0],[.404,.985,0],.014,'#90968e');
    tube([.404,.985,-.23],[.404,.985,.23],.011,'#9a9f97');
    for(const z of [-1,1]){
      tube([.404,.985,z*.18],[.37,.992,z*.285],.016,'#45463d');
      tube([-.083,.302,z*.018],[-.083+z*.109,.302-z*.056,z*.046],.009,'#7e817c');
      tube([-.083+z*.109,.302-z*.056,z*.046],[-.083+z*.109,.302-z*.056,z*.11],.014,'#4c514a');
    }
  }
  return finishRacks(buffers,'Market sidewalks and ferry apron bicycle stands');
}
