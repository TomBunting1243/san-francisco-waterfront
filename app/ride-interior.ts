import * as THREE from 'three';
import {mountCabEntrance,setPccFrontDoor} from './pcc-entrance.ts';
import {pccCarCards} from './pcc-car-cards.ts';
import {addPccSaloon} from './pcc-saloon.ts';

export type RideInteriorMode='sedan'|'tram';
export type CabPoint=[x:number,y:number,z:number];

// Camera-local, metres from a seated driver's eye. Forward is negative Z.
export type CabGeometry=ReturnType<typeof cabGeometry>;
function cabGeometry(){
  const positions:number[]=[],colors:number[]=[],illumination:number[]=[],print:number[]=[],indices:number[]=[];
  function panel(a:CabPoint,b:CabPoint,c:CabPoint,d:CabPoint,tint:string,lamp=0,card?:{row:number;reverse:boolean}){
    const offset=positions.length/3,pigment=new THREE.Color(tint);
    for(const [x,y,z] of [a,b,c,d]){
      positions.push(x*.06,y*.06,z*.06);
      colors.push(pigment.r,pigment.g,pigment.b);
      illumination.push(lamp);
    }
    for(let i=0;i<4;i++){
      const right=(i===1||i===2)!==(card?.reverse??false);
      print.push(card?(right?65510:25):0,card?Math.round((1-(card.row+(i<2?.995:.005))/4)*65535):0);
    }
    indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  // A slim tapered strip at the depth of the glass, measured perpendicular to its axis.
  function strip(a:CabPoint,b:CabPoint,startWidth:number,endWidth:number,tint:string){
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    const nx=-dy/length,ny=dx/length;
    const side=(p:CabPoint,w:number):CabPoint=>[p[0]+nx*w,p[1]+ny*w,p[2]];
    panel(side(a,startWidth/2),side(a,-startWidth/2),side(b,-endWidth/2),side(b,endWidth/2),tint);
  }
  function side(x:number,bottom:number,top:number,front:number,back:number,tint:string,light=0){
    panel([x,bottom,front],[x,bottom,back],[x,top,back],[x,top,front],tint,light);
  }
  function cross(z:number,left:number,right:number,bottom:number,top:number,tint:string,light=0){
    panel([left,bottom,z],[right,bottom,z],[right,top,z],[left,top,z],tint,light);
  }
  function level(y:number,left:number,right:number,front:number,back:number,tint:string,light=0){
    panel([left,y,front],[right,y,front],[right,y,back],[left,y,back],tint,light);
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
    g.setAttribute('cabPrint',new THREE.Uint16BufferAttribute(print,2,true));
    g.setAttribute('cabLight',new THREE.Float32BufferAttribute(illumination,1));
    g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
    return g;
  }
  return {panel,strip,side,cross,level,seat,finish};
}

function sedan(){
  const g=cabGeometry();
  // The driver sits to the left of the center ridge, so the far hood shoulder
  // runs longer across the driver's view than the near one.
  const near:CabPoint[]=[[-.50,-.48,-.98],[-.40,-.445,-1.04],[.34,-.434,-1.08],[1.06,-.447,-1.03],[1.20,-.485,-.97]];
  const nose:CabPoint[]=[[-.43,-.724,-1.68],[-.34,-.684,-1.80],[.34,-.664,-1.88],[1.00,-.687,-1.80],[1.12,-.73,-1.68]];
  const hood=['#9e895c','#bda36f','#b5a074','#9e8b64'];
  for(let i=0;i<4;i++)g.panel(near[i],near[i+1],nose[i+1],nose[i],hood[i]);
  const sill:CabPoint[]=[[-.58,-.35,-.71],[-.39,-.373,-.84],[.34,-.397,-.90],[1.03,-.381,-.84],[1.27,-.35,-.70]];
  for(let i=0;i<4;i++){
    g.panel(sill[i],sill[i+1],near[i+1],near[i],'#555b55');
    const low=(p:CabPoint):CabPoint=>[p[0],p[1]-.24,p[2]+.28];
    g.panel(low(sill[i]),low(sill[i+1]),sill[i+1],sill[i],'#464c49');
  }
  // A-pillars sweep back toward the driver's eye at the headliner.
  for(const [bottom,top] of [
    [[-.53,-.36,-.79],[-.61,.48,-.43]],[[1.18,-.36,-.79],[1.13,.48,-.44]]
  ] as [CabPoint,CabPoint][]){
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
  addPccSaloon(g);
  return g.finish();
}

// The spindle passes through the sill; the arm and rubber meet at the same pin.
function mountedWiper(cab:THREE.Mesh,origin:CabPoint,slopeX:number,slopeY:number,reach:number){
  const g=cabGeometry(),radius=.022;
  const rim=(i:number,depth:number):CabPoint=>[radius*Math.cos(i*Math.PI/4),radius*Math.sin(i*Math.PI/4),depth];
  for(let i=0;i<8;i++){
    g.panel(rim(i,-.022),rim(i+1,-.022),rim(i+1,.018),rim(i,.018),'#555e58');
  }
  for(let i=0;i<4;i++)g.panel([0,0,.018],rim(2*i,.018),rim(2*i+1,.018),rim(2*i+2,.018),'#878c7f');
  const pin:CabPoint=[-.53*reach,.043,.010];
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
  const interiorNight={value:0},cards={value:null as THREE.Texture|null},printed={value:false};
  material.onBeforeCompile=shader=>{
    shader.uniforms.interiorNight=interiorNight;shader.uniforms.carCards=cards;shader.uniforms.cardsPrinted=printed;
    const varyings='varying float saloonLight; varying vec2 printUV; varying vec3 cabPoint; varying vec3 cabNormal;\n';
    shader.vertexShader=varyings+'attribute float cabLight; attribute vec2 cabPrint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n saloonLight=cabLight;printUV=cabPrint;cabPoint=position/.06;cabNormal=normal;');
    shader.fragmentShader=varyings+'uniform float interiorNight; uniform sampler2D carCards; uniform bool cardsPrinted;\n'+shader.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        if(cardsPrinted && printUV.y>0.)diffuseColor.rgb=texture2D(carCards,printUV).rgb;
        if(saloonLight>0. && abs(cabPoint.y+1.19)<.003){
          float groove=cabPoint.x*74.,fw=fwidth(groove);
          diffuseColor.rgb*=1.-.145*(.5+.5*cos(6.283185*groove))*(1.-smoothstep(.2,.85,fw));
        }`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        if(saloonLight>0.){
          float bay=clamp(floor((cabPoint.z-1.14)/1.60+.5),0.,7.);
          vec3 toBulb=vec3(cabPoint.x<.30?-.43:1.03,.86,1.14+1.60*bay)-cabPoint;
          float d2=dot(toBulb,toBulb);
          float incidence=max(0.,dot(normalize(cabNormal)*(gl_FrontFacing?1.:-1.),toBulb*inversesqrt(max(.0001,d2))));
          float bounce=.31+(1.8*incidence+.23)/(.9+d2);
          totalEmissiveRadiance+=vec3(1.,.88,.72)*(diffuseColor.rgb*min(1.,saloonLight)*(.19+interiorNight*bounce)
            +max(0.,saloonLight-1.)*(.45+interiorNight*1.15));
        }`);
  };
  function build(mode:RideInteriorMode){
    const isTram=mode==='tram';
    const cab=new THREE.Mesh(isTram?pcc():sedan(),material);
    cab.name=isTram?'1051 split windshield and sill':'Sedan windshield and hood';
    // PCC left pane at x=.125, with the spindle 10 mm down the folded sill.
    const tramSillZ=-.89-(.125+.57)*(.15/.87)+.010*.023/.024;
    const wiper=isTram?mountedWiper(cab,[.125,-.440,tramSillZ],-.15/.87,.09,.53):
      mountedWiper(cab,[.34,-.4155,-.99],-.08,.58,.64);
    const entrance=isTram?mountCabEntrance():null;
    if(entrance){
      cab.add(entrance);
      cards.value=pccCarCards();printed.value=cards.value!==null;
    }
    root.add(cab);cab.updateMatrixWorld(true);
    return {cab,wiper,entrance,sweep:isTram?1.10:1.21};
  }
  const cabs=new Map<RideInteriorMode,ReturnType<typeof build>>();
  let disposed=false,phase=0,rest=0,active:ReturnType<typeof build>|undefined;
  function show(mode:RideInteriorMode|null){
    if(disposed)return;
    let next=mode?cabs.get(mode):undefined;
    if(mode&&!next){next=build(mode);cabs.set(mode,next);}
    if(active!==next){
      if(active){active.wiper.rotation.z=0;active.cab.visible=false;}
      phase=0;rest=0;active=next;
    }
    if(next)next.cab.visible=true;
    root.visible=!!next;
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
    active.wiper.rotation.z=-active.sweep*.5*(1-Math.cos(phase*2*Math.PI));
  }
  function dispose(){
    if(disposed)return;
    show(null);disposed=true;root.removeFromParent();
    for(const {cab,wiper,entrance} of cabs.values()){
      cab.geometry.dispose();wiper.geometry.dispose();
      if(entrance){entrance.geometry.dispose();(entrance.material as THREE.Material).dispose();entrance.dispose();}
    }
    root.clear();cabs.clear();cards.value?.dispose();cards.value=null;printed.value=false;material.dispose();
  }
  return {root,show,updateRain,
    setFrontDoor:(opening:number)=>{if(active?.entrance)setPccFrontDoor(active.entrance,opening);},
    setNight:(night:number)=>{
      interiorNight.value=night;
      const entrance=cabs.get('tram')?.entrance;
      if(entrance)(entrance.material as THREE.MeshStandardMaterial).emissive.setRGB(night*.10,night*.076,night*.043);
    },dispose};
}
