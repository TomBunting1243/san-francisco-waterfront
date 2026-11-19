import * as THREE from 'three';

const pacific=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const publishedClosures=new Set(['2026-11-26','2026-12-24','2026-12-31']);
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
function progress(minute:number,open:number,close:number){
  return clamp(Math.min((minute-open+30)/30,(close+30-minute)/30));
}

// Foodwise publishes trading hours and date-specific closures. The SF Arts
// Commission describes daily artists typically set up by 9 and packing at 4.
export function ferryMarketSchedule(at:Date){
  const parts=Object.fromEntries(pacific.formatToParts(at).map(p=>[p.type,p.value]));
  const minute=+parts.hour*60 + +parts.minute + +parts.second/60;
  const saturday=parts.weekday==='Sat';
  const closure=publishedClosures.has([parts.year,parts.month,parts.day].join('-'));
  // The street-front stalls are a permanent feature of this imagined waterfront.
  return {front:1,rear:saturday&&!closure?progress(minute,480,840):0,artist:progress(minute,540,960)};
}

type Site={x:number;z:number;floor:number;section:'front'|'rear'|'artist'};
// Leave the clock-tower entrance, ferry gates, and the pedestrian spine open.
// Rear stalls occupy the fixed plaza only on Saturdays. Arts vendors occupy the measured
// edge of the brick court, along the foot of Market. Actual traders rotate.
const sites:Site[]=[
  ...[-5.35,-4.88,-4.41,-3.64,-3.17,-2.70,-2.23,1.94,2.41,2.88,3.65,4.12,4.59,5.06].map(x=>({x,z:-1.84,floor:.031,section:'front' as const})),
  ...[3.39,3.96,4.52,5.08].flatMap(z=>[-4.97,-4.48,-3.41,-2.94].map(x=>({x,z,floor:.096,section:'rear' as const}))),
  ...[[.713,-8.175],[.787,-8.450],[.900,-8.713],[1.025,-8.988],[1.175,-9.238]].map(([x,z])=>({x,z,floor:.127-.0012*(x-2)+.0008*(z+8),section:'artist' as const})),
];
const canvas=['#eee9d9','#e3dfca','#c7cbb7','#e9e3d0','#baccbf','#e5d2af'];
const produce=['#af5240','#738852','#cd9c53','#9e6658'];
const coats=['#566b77','#ae8268','#667969','#6f737f'];
const range=(v:number,start:number,end:number)=>clamp((v-start)/(end-start));

export function createFerryMarket(){
  const root=new THREE.Group();root.name='Ferry Plaza farmers market and Market Street artists';
  const paint=new THREE.MeshStandardMaterial({roughness:.92});
  const pyramid=new THREE.ConeGeometry(Math.SQRT1_2,1,4,1,false,Math.PI/4);
  function batch(name:string,geometry:THREE.BufferGeometry,capacity:number){
    const mesh=new THREE.InstancedMesh(geometry,paint,capacity);
    mesh.name=name;mesh.count=0;mesh.visible=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(mesh);return mesh;
  }
  const boxes=batch('Market furniture, frames and clothing',new THREE.BoxGeometry(),2400);
  const roofs=batch('Raised and folded market canvas',pyramid,sites.length);
  const rounds=batch('Market people, produce and trolley wheels',new THREE.IcosahedronGeometry(.5,0),1200);
  const batches=[boxes,roofs,rounds],dummy=new THREE.Object3D(),colors=new Map<string,THREE.Color>();
  let lastSample=NaN,lastState='',revision=0;
  function update(epoch:number,still=false){
    // Quiet scenes hold a tableau; periodic time checks still catch trading
    // boundaries. Stable schedules reuse the same instance buffers.
    const quantum=still?300000:1000,sample=Math.floor(epoch/quantum)*quantum;
    if(sample===lastSample)return revision;
    lastSample=sample;
    const schedule=ferryMarketSchedule(new Date(sample));
    const key=[schedule.front,schedule.rear,schedule.artist].join(',');
    if(key===lastState)return revision;
    lastState=key;revision++;
    for(const mesh of batches)mesh.count=0;
    for(const [i,site] of sites.entries()){
      const artist=site.section==='artist';
      const phase=clamp((schedule[site.section]-(i%5)*.018)/(1-(i%5)*.018));
      if(phase<=0)continue;
      function shape(mesh:THREE.InstancedMesh,x:number,y:number,z:number,w:number,h:number,d:number,color:string,rz=0){
        dummy.position.set(site.x+x,site.floor+y,site.z+z);dummy.scale.set(w,h,d);dummy.rotation.set(0,0,rz);
        dummy.updateMatrix();mesh.setMatrixAt(mesh.count,dummy.matrix);
        let tint=colors.get(color);if(!tint)colors.set(color,tint=new THREE.Color(color));
        mesh.setColorAt(mesh.count++,tint);
      }
      const steel='#68726b',wood='#a18260';
      const cartX=.28*(1-range(phase,0,.24))+.09,cartZ=.12;
      if(phase<.88){
        shape(boxes,cartX,.022,cartZ,.071,.009,.052,steel);
        shape(boxes,cartX+.031,.043,cartZ,.004,.044,.044,steel);
        if(phase<=.22)shape(boxes,cartX,.080,cartZ,.083,.010,.035,wood);
        if(phase<=.18)shape(boxes,cartX,.091,cartZ,.093,.011,.018,'#d7d6c5');
        for(const wheel of [-.025,.025])for(const axle of [-.021,.021])
          shape(rounds,cartX+wheel,.010,cartZ+axle,.017,.019,.009,'#424945');
      }
      const workerX=cartX+.066-.13*range(phase,.42,.82),workerZ=cartZ-.05*range(phase,.4,.88);
      function person(x:number,z:number,coat:string){
        for(const side of [-1,1])shape(boxes,x+side*.007,.021,z,.008,.042,.011,'#465453',side*.04);
        shape(rounds,x,.059,z,.035,.050,.025,coat);
        shape(rounds,x,.092,z,.022,.025,.022,'#b89175');
        for(const side of [-1,1])shape(boxes,x+side*.016,.058,z-.003,.008,.034,.009,coat,side*.18);
      }
      person(workerX,workerZ,coats[i%4]);
      const lift=range(phase,.23,.58),spread=range(phase,.33,.62);
      const frame=.035+.095*lift,span=.021+.169*spread;
      if(phase>.18){
        for(const dx of [-1,1])for(const dz of [-1,1])
          shape(boxes,dx*span*.47,frame/2,dz*span*.47,.003,frame,.003,steel);
        const height=.022+.032*spread,cloth=artist?'#f6f4e8':canvas[i%canvas.length];
        shape(roofs,0,frame+height/2,0,span,height,span,cloth);
        for(const dz of [-1,1])shape(boxes,0,frame-.004,dz*span*.49,span,.009,.002,cloth);
      }
      const unfold=range(phase,.36,.65),tableY=.025+.027*unfold;
      if(phase>.22){
        const tableX=.05*(1-unfold);
        shape(boxes,tableX,tableY,-.031,.128,.007,.047,wood,(1-unfold)*.29);
        for(const dx of [-.048,.048])for(const dz of [-.016,.016])
          shape(boxes,tableX+dx,tableY/2,-.031+dz,.003,tableY,.003,steel);
      }
      if(artist&&phase>.57&&i%3===1){
        for(let k=0;k<4;k++){
          const x=(k-1.5)*.029;
          shape(boxes,x,.082,-.036,.025,.047,.003,wood,-.04);
          shape(boxes,x,.082,-.039,.021,.042,.002,['#6a8d90','#c69469','#878562','#586e81'][k]);
        }
      }else if(artist&&phase>.57&&i%3===2){
        for(let k=0;k<3;k++){
          const x=(k-1)*.039;shape(boxes,x,.059,-.03,.035,.004,.029,'#595b58');
          for(const dx of [-.008,.005])shape(rounds,x+dx,.063,-.03,.005,.002,.006,'#d0ae71');
        }
      }else if(artist&&phase>.57){
        const rack=.091*range(phase,.57,.81);
        for(const z of [-.04,.04])shape(boxes,-.078,rack/2,z,.003,rack,.003,steel);
        shape(boxes,-.078,rack,0,.003,.003,.084,steel);
        for(let k=0;k<5;k++){
          const z=(k-2)*.014,cloth=['#ddd1ac','#797d95','#b56957','#7d9c99','#efe1c8'][k];
          shape(boxes,-.078,rack-.009,z,.022,.004,.002,steel);
          shape(boxes,-.078,rack-.028,z,.026,.037,.005,cloth);
          shape(boxes,-.078,rack-.016,z,.040,.012,.005,cloth);
        }
        for(const dx of [-.036,.007,.048]){
          shape(boxes,dx,.076,-.036,.032,.045,.003,wood);
          shape(boxes,dx,.076,-.038,.027,.039,.001,'#e9e0c6');
          shape(boxes,dx,.075,-.039,.018,.019,.001,coats[Math.round((dx+.04)*60)%4]);
        }
      }else if(!artist){
        for(let k=0;k<3;k++){
          const carried=range(phase,.49+k*.09,.66+k*.09);
          const x=THREE.MathUtils.lerp(cartX,(k-1)*.040,carried),z=THREE.MathUtils.lerp(cartZ,-.030,carried);
          const y=THREE.MathUtils.lerp(.034+k*.013,tableY+.011,carried)+Math.sin(carried*Math.PI)*.035;
          shape(boxes,x,y,z,.037,.013,.034,wood);
          for(let j=0;j<6;j++)shape(rounds,x+(j%3-1)*.010,y+.009,z+(j<3?-.006:.006),.011,.009,.011,produce[(i+k)%4]);
        }
      }
      if(phase>.87&&i%3===0)person(-.030,-.115,coats[(i+2)%4]);
    }
    for(const mesh of batches){
      mesh.visible=mesh.count>0;
      if(mesh.visible){
        mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor!.needsUpdate=true;mesh.computeBoundingSphere();
      }
    }
    return revision;
  }
  return {root,update};
}
