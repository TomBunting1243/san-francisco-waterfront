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
  function side(x:number,bottom:number,top:number,front:number,back:number,tint:string){
    panel([x,bottom,front],[x,bottom,back],[x,top,back],[x,top,front],tint);
  }
  function cross(z:number,left:number,right:number,bottom:number,top:number,tint:string){
    panel([left,bottom,z],[right,bottom,z],[right,top,z],[left,top,z],tint);
  }
  function level(y:number,left:number,right:number,front:number,back:number,tint:string){
    panel([left,y,front],[right,y,front],[right,y,back],[left,y,back],tint);
  }
  function seat(left:number,right:number,z:number,cushion:number,top:number,cloth:string){
    level(cushion,left,right,z-.41,z,cloth);
    panel([left,cushion,z],[right,cushion,z],[right,top,z+.09],[left,top,z+.09],cloth);
    cross(z-.41,left,right,cushion-.07,cushion,'#4e5550');
    const middle=(left+right)/2;
    cross(z-.21,middle-.058,middle+.058,cushion-.44,cushion,'#545c52');
    side(middle-.058,cushion-.44,cushion,z-.27,z-.15,'#62695c');
  }
  function finish(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
    return g;
  }
  return {panel,strip,side,cross,level,seat,finish};
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
  const left=-.56,right=1.22;
  for(const x of [left,right]){
    const topX=x===left?-.61:1.13;
    g.side(x,-1.08,-.31,-.73,1.70,'#555d59');
    g.side(x,-.34,-.30,-.73,1.70,'#878779');
    g.panel([x,-.30,.32],[x,-.30,.41],[topX,.48,.39],[topX,.48,.31],'#666963');
    g.panel([x,-.30,1.47],[x,-.30,1.70],[topX,.48,1.30],[topX,.48,1.15],'#88877a');
    g.panel([x,-.30,-.73],[topX,.48,-.43],[topX,.48,-.48],[x,-.30,-.78],'#73756b');
  }
  g.level(.48,-.61,1.13,-.44,1.30,'#aaa797');
  g.level(-1.08,left,right,-.50,1.69,'#454b47');
  g.cross(1.69,left,right,-1.08,-.25,'#666e63');
  g.level(-.25,left,right,1.36,1.69,'#797c70');
  g.seat(-.39,.26,.28,-.68,-.19,'#747a70');
  g.seat(.47,1.07,.28,-.68,-.19,'#818678');
  for(const x of [-.065,.77])g.cross(.38,x-.135,x+.135,-.20,-.065,'#6c736a');
  g.seat(-.45,1.12,1.34,-.66,-.25,'#737a6d');
  for(const x of [-.20,.86])g.cross(1.44,x-.14,x+.14,-.26,-.115,'#696f63');
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
  // The PCC is 48 ft 5 in long with a right-hand front and rear door.
  // Window heads, belt rail and seat backs leave clear views through the open glazing.
  const left=-.90,right=1.50,back=13.49;
  g.level(-1.19,left,right,-.68,back,'#696d5e');
  g.level(.71,left+.07,right-.07,-.70,back,'#c8c3a9');
  for(const x of [left,right]){
    g.side(x,-1.19,-.48,-.71,back,'#839079');
    g.side(x,-.51,-.46,-.71,back,'#b7ab88');
    g.side(x,.37,.41,-.71,back,'#a29e87');
    g.side(x,.61,.71,-.71,back,'#b9b7a0');
    for(let i=0;i<12;i++){
      const z=-.69+i*1.16;
      g.side(x,-.47,.62,z,z+.052,'#a9a68e');
    }
    const railX=x===left?x+.15:x-.15;
    g.side(railX,.40,.427,1.95,12.70,'#b5a983');
    for(const z of [2.2,5.67,9.15,12.62])g.cross(z,railX-.014,railX+.014,-1.19,.42,'#bcb399');
  }
  // Door leaves use narrow vertical stiles, echoed by the exterior door model.
  for(const z of [1.34,8.26])for(const offset of [-.58,-.20,.20,.58]){
    g.side(right-.012,-.46,.36,z+offset,z+offset+.032,'#757d71');
  }
  for(let i=0;i<9;i++){
    const z=2.22+i*1.16;
    g.seat(left+.08,-.13,z,-.75,-.18,'#917765');
    if(i!==5)g.seat(.65,right-.08,z,-.75,-.18,'#997f6d');
  }
  g.cross(back,left,right,-1.19,-.47,'#85917c');
  g.cross(back,left,right,.46,.71,'#b6b39a');
  g.cross(back,.27,.315,-.47,.46,'#afa98e');
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
