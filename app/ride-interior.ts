import * as THREE from 'three';

export type RideInteriorMode='sedan'|'tram';
type Point=[x:number,y:number,z:number];

// Camera-local, metres from a seated driver's eye. Forward is negative Z.
function cabGeometry(){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[];
  function panel(a:Point,b:Point,c:Point,d:Point,tint:string){
    const offset=positions.length/3,pigment=new THREE.Color(tint);
    for(const [x,y,z] of [a,b,c,d]){
      positions.push(x*.06,y*.06,z*.06);
      colors.push(pigment.r,pigment.g,pigment.b);
    }
    indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  // A slim tapered strip at the depth of the glass, measured perpendicular to its axis.
  function strip(a:Point,b:Point,startWidth:number,endWidth:number,tint:string){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    const nx=-dy/length,ny=dx/length;
    const side=(p:Point,w:number):Point=>[p[0]+nx*w,p[1]+ny*w,p[2]];
    panel(side(a,startWidth/2),side(a,-startWidth/2),side(b,-endWidth/2),side(b,endWidth/2),tint);
  }
  function finish(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
    return g;
  }
  return {panel,strip,finish};
}

function sedan(){
  const g=cabGeometry();
  // The driver sits to the left of the center ridge, so the far hood shoulder
  // runs longer across the driver's view than the near one.
  const near:Point[]=[[-.50,-.48,-.98],[-.40,-.445,-1.04],[.34,-.434,-1.08],[1.06,-.447,-1.03],[1.20,-.485,-.97]];
  const nose:Point[]=[[-.43,-.724,-1.68],[-.34,-.684,-1.80],[.34,-.664,-1.88],[1.00,-.687,-1.80],[1.12,-.73,-1.68]];
  const hood=['#9e895c','#bda36f','#b5a074','#9e8b64'];
  for(let i=0;i<4;i++)g.panel(near[i],near[i+1],nose[i+1],nose[i],hood[i]);
  const sill:Point[]=[[-.58,-.35,-.71],[-.39,-.373,-.84],[.34,-.397,-.90],[1.03,-.381,-.84],[1.27,-.35,-.70]];
  for(let i=0;i<4;i++){
    g.panel(sill[i],sill[i+1],near[i+1],near[i],'#555b55');
    const low=(p:Point):Point=>[p[0],p[1]-.24,p[2]+.28];
    g.panel(low(sill[i]),low(sill[i+1]),sill[i+1],sill[i],'#464c49');
  }
  // A-pillars sweep back toward the driver's eye at the headliner.
  for(const [bottom,top] of [
    [[-.53,-.36,-.79],[-.61,.48,-.43]],[[1.18,-.36,-.79],[1.13,.48,-.44]]
  ] as [Point,Point][]){
    g.strip(bottom,top,.070,.053,'#70726a');
    g.strip([bottom[0],bottom[1],bottom[2]+.005],[top[0],top[1],top[2]+.005],.040,.029,'#828176');
  }
  return g.finish();
}

function pcc(){
  const g=cabGeometry();
  const xs=[-.69,-.57,.30,1.22,1.54],ds=[-.77,-.89,-1.04,-.90,-.71];
  for(let i=0;i<xs.length-1;i++){
    const a=xs[i],b=xs[i+1],za=ds[i],zb=ds[i+1];
    g.panel([a,-.43,za],[b,-.43,zb],[b,-.454,zb+.023],[a,-.454,za+.023],'#a4aaa0');
    g.panel([a,-.454,za+.023],[b,-.454,zb+.023],[b,-.487,zb+.030],[a,-.487,za+.030],'#6c756c');
    g.panel([a,-.487,za+.030],[b,-.487,zb+.030],[b,-.54,zb+.19],[a,-.54,za+.19],'#7b8273');
    g.panel([a,-.54,za+.19],[b,-.54,zb+.19],[b,-.88,zb+.25],[a,-.88,za+.25],'#556155');
  }
  // The driver's eye is in the left pane. The central stile stands right of
  // the track centerline in this view, between the two separately angled panes.
  g.strip([.30,-.431,-1.039],[.30,.70,-.94],.038,.034,'#4d574f');
  g.strip([.30,-.431,-1.036],[.30,.70,-.937],.025,.023,'#d8ccae');
  g.strip([-.576,-.435,-.885],[-.655,.63,-.78],.046,.036,'#bdb69e');
  g.strip([1.22,-.435,-.898],[1.27,.63,-.79],.045,.036,'#bdb69e');
  return g.finish();
}

// The spindle passes through the sill; the arm and rubber meet at the same pin.
function mountedWiper(cab:THREE.Mesh,origin:Point,slopeX:number,slopeY:number,reach:number){
  const g=cabGeometry(),radius=.022;
  const rim=(i:number,depth:number):Point=>[radius*Math.cos(i*Math.PI/4),radius*Math.sin(i*Math.PI/4),depth];
  for(let i=0;i<8;i++){
    g.panel(rim(i,-.022),rim(i+1,-.022),rim(i+1,.018),rim(i,.018),'#555e58');
  }
  for(let i=0;i<4;i++)g.panel([0,0,.018],rim(2*i,.018),rim(2*i+1,.018),rim(2*i+2,.018),'#878c7f');
  const pin:Point=[-.53*reach,.043,.010];
  g.strip([0,0,.017],pin,.016,.011,'#555d58');
  g.strip([-.93*reach,.065,.010],pin,.016,.016,'#353e39');
  g.strip(pin,[-.17*reach,.023,.010],.016,.014,'#353e39');

  const x=new THREE.Vector3(1,0,slopeX).normalize();
  const normal=new THREE.Vector3(-slopeX,-slopeY,1).normalize();
  const y=new THREE.Vector3().crossVectors(normal,x);
  const frame=new THREE.Group();
  frame.matrixAutoUpdate=false;
  frame.matrix.makeBasis(x,y,normal).setPosition(origin[0]*.06,origin[1]*.06,origin[2]*.06);
  const wiper=new THREE.Mesh(g.finish(),cab.material);
  wiper.name='Windshield wiper';frame.add(wiper);cab.add(frame);
  return wiper;
}

export function createRideInteriors(){
  const root=new THREE.Group();root.name='Driver interiors';root.visible=false;
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.90,metalness:.035,side:THREE.DoubleSide,fog:false});
  const car=new THREE.Mesh(sedan(),material),tram=new THREE.Mesh(pcc(),material);
  car.name='Sedan windshield and hood';tram.name='1051 split windshield and sill';
  car.visible=false;tram.visible=false;root.add(car,tram);
  // PCC pane and folded sill meet here: interpolate the left pane at x=.125,
  // then move 10 mm down the folded metal lip. The sedan pivot sits on its cowl.
  const tramSillZ=-.89-(.125+.57)*(.15/.87)+.010*.023/.024;
  const tramWiper=mountedWiper(tram,[.125,-.440,tramSillZ],-.15/.87,.09,.53);
  const carWiper=mountedWiper(car,[.34,-.4155,-.99],-.08,.58,.64);
  let disposed=false,phase=0,rest=0;
  let active:THREE.Mesh|null=null;
  function show(mode:RideInteriorMode|null){
    if(disposed)return;
    const next=mode==='sedan'?carWiper:mode==='tram'?tramWiper:null;
    if(active!==next){
      if(active)active.rotation.z=0;
      phase=0;rest=0;active=next;
    }
    car.visible=mode==='sedan';tram.visible=mode==='tram';root.visible=car.visible||tram.visible;
  }
  function updateRain(rain:number,dt:number,still:boolean){
    if(!active||!root.visible||still||!(dt>0))return;
    const wet=Math.max(0,Math.min(1,rain));
    if(!wet&&phase===0){rest=0;return;}
    if(rest>0){
      rest=Math.min(rest,.16+2.3*(1-wet));
      const elapsed=Math.min(rest,dt);
      rest-=elapsed;dt-=elapsed;
      if(dt<=0)return;
    }
    phase+=dt*(.60+.20*wet);
    if(phase>=1){
      phase=0;rest=wet?.16+2.3*(1-wet):0;
    }
    const sweep=active===tramWiper?1.10:1.21;
    active.rotation.z=-sweep*.5*(1-Math.cos(phase*2*Math.PI));
  }
  function dispose(){
    if(disposed)return;
    show(null);disposed=true;root.removeFromParent();
    car.geometry.dispose();tram.geometry.dispose();carWiper.geometry.dispose();tramWiper.geometry.dispose();material.dispose();
  }
  return {root,show,updateRain,dispose};
}
