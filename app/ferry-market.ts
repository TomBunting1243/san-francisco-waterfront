import * as THREE from 'three';
import {westMarketGround} from './curb-survey.ts';

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

type FrontStall='produce'|'flowers'|'info'|'tasting';
type Site={x:number;z:number;floor:number;section:'front'|'rear'|'artist';approach?:'prints'|'shirts';stall?:FrontStall};
// Tent colors and activities come from the operator. Pitch assignments rotate.
// https://foodwise.org/programs/seasonal-spotlight/
// https://foodwise.org/markets/group-visits/
// https://foodwise.org/articles/in-bluma-growing-organic-flowers-at-sunol-agpark/
const frontPitches:[number,FrontStall][]=[
  [-5.35,'produce'],[-4.88,'produce'],[-4.41,'flowers'],[-3.64,'produce'],[-3.17,'produce'],
  [-2.70,'tasting'],[-2.23,'produce'],[1.94,'info'],[2.41,'flowers'],[2.88,'produce'],
  [3.65,'produce'],[4.12,'flowers'],[4.59,'produce'],[5.06,'produce'],
];
// Leave the clock-tower entrance, ferry gates, and the pedestrian spine open.
// Rear stalls occupy the fixed plaza only on Saturdays. Arts vendors occupy the measured
// edge of the brick court, along the foot of Market. Actual traders rotate.
const sites:Site[]=[
  ...frontPitches.map(([x,stall])=>({x,z:-1.84,floor:.031,section:'front' as const,stall})),
  ...[3.39,3.96,4.52,5.08].flatMap(z=>[-4.97,-4.48,-3.41,-2.94].map(x=>({x,z,floor:.096,section:'rear' as const}))),
  ...[[.713,-8.175],[.787,-8.450],[.900,-8.713],[1.025,-8.988],[1.175,-9.238]].map(([x,z])=>({x,z,floor:.127-.0012*(x-2)+.0008*(z+8),section:'artist' as const})),
  // Two white display footprints beside the striped Market approach. Centers read
  // from SF's p2024_rgb8cm aerial, preserving the walking lane between its rows.
  // SFAC Art Vendor Map 30 shows the lottery pitches and open passages here.
  // https://media.api.sf.gov/documents/Revolution_by_MarcoCochrane_B180_SFAC.pdf#page=18
  ...[[-.71,-6.56],[-.72,-6.98]].map(([x,z],i)=>({x,z,floor:westMarketGround(x,z)+.00035,section:'artist' as const,approach:i===0?'prints' as const:'shirts' as const})),
];
const canvas=['#f2f1e9','#e8e7e2','#f4f0e2','#e9e5d7','#e2e4dd','#f1eae0'];
const tablecloth=['#647c73','#a35437','#63738a','#9f824b'];
const flowers=['#c46678','#dbb350','#b15c48','#a684ac'];
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
      const artist=site.section==='artist',printCounter=site.approach==='prints';
      const phase=clamp((schedule[site.section]-(i%5)*.018)/(1-(i%5)*.018));
      if(phase<=0)continue;
      function shape(mesh:THREE.InstancedMesh,x:number,y:number,z:number,w:number,h:number,d:number,color:string,rz=0,rx=0){
        dummy.position.set(site.x+x,site.floor+y,site.z+z);dummy.scale.set(w,h,d);dummy.rotation.set(rx,0,rz);
        dummy.updateMatrix();mesh.setMatrixAt(mesh.count,dummy.matrix);
        let tint=colors.get(color);if(!tint)colors.set(color,tint=new THREE.Color(color));
        mesh.setColorAt(mesh.count++,tint);
      }
      const groundOffset=(x:number,z:number)=>!site.approach?0:westMarketGround(site.x+x,site.z+z)+.00035-site.floor;
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
      function person(x:number,z:number,coat:string,reach=0){
        const ground=groundOffset(x,z);
        for(const side of [-1,1])shape(boxes,x+side*.007,ground+.021,z,.008,.042,.011,'#465453',side*.04);
        shape(rounds,x,ground+.059,z,.035,.050,.025,coat);
        shape(rounds,x,ground+.092,z,.022,.025,.022,'#b89175');
        for(const side of [-1,1]){
          if(reach&&side===reach){
            shape(boxes,x+side*.015,ground+.067,z+reach*.006,.009,.023,.010,coat,0,-reach*.52);
            shape(boxes,x+side*.015,ground+.060,z+reach*.020,.008,.022,.009,coat,0,reach*1.43);
            shape(rounds,x+side*.015,ground+.061,z+reach*.033,.010,.009,.013,'#b89175');
          }else shape(boxes,x+side*.016,ground+.058,z-.003,.008,.034,.009,coat,side*.18);
        }
      }
      const counterShift=printCounter ? .05 : 0;
      if(printCounter&&phase>.87){
        person(.030,-.003+counterShift,'#536c70',-1);
        person(0,-.104+counterShift,'#a96550',1);
      }else person(workerX,workerZ,coats[i%4]);
      const lift=range(phase,.23,.58),spread=range(phase,.33,.62);
      const frame=.035+.095*lift,span=.021+.169*spread;
      // Long farmers' tables fit beneath a rectangular fly. Keep the front-to-back
      // dimension and all four feet within the original strip of sidewalk.
      const depth=printCounter?span*.77:span;
      const width=site.stall==='produce'||site.stall==='flowers'?span*1.45:span;
      const cloth=artist?'#f6f4e8':site.stall==='info'?'#408456':site.stall==='tasting'?'#da7731':canvas[i%canvas.length];
      if(phase>.18){
        for(const dx of [-1,1])for(const dz of [-1,1]){
          const x=dx*width*.47,z=dz*depth*.47,base=groundOffset(x,z);
          shape(boxes,x,(frame+base)/2,z,.003,frame-base,.003,steel);
        }
        const height=.022+.032*spread;
        shape(roofs,0,frame+height/2,0,width,height,depth,cloth);
        for(const dz of [-1,1])shape(boxes,0,frame-.007,dz*depth*.49,width,.014,.002,cloth);
        for(const dx of [-1,1])shape(boxes,dx*width*.49,frame-.007,0,.002,.014,depth,cloth);
      }
      const unfold=range(phase,.36,.65),tableY=.025+.027*unfold;
      if(phase>.22){
        const tableX=.05*(1-unfold),topWidth=site.section==='front'?width*.87:.128;
        shape(boxes,tableX,tableY,-.031+counterShift,topWidth,.007,.047,wood,(1-unfold)*.29);
        for(const side of [-1,1])for(const dz of [-.016,.016]){
          const x=tableX+side*topWidth*.375,z=-.031+dz+counterShift,base=groundOffset(x,z);
          shape(boxes,x,(tableY+base)/2,z,.003,tableY-base,.003,steel);
        }
      }
      if(site.section==='front'){
        const cover=site.stall==='info'||site.stall==='tasting'?cloth:tablecloth[i%4];
        const tableWidth=width*.87;
        shape(boxes,0,tableY+.0045,-.031,tableWidth,.002,.056,cover);
        shape(boxes,0,tableY-.018,-.058,tableWidth,.041,.002,cover);
        for(const x of [-1,1])shape(boxes,x*tableWidth*.49,tableY-.018,-.031,.002,.041,.056,cover);
        // Laminated seller cards hang on the posts. The program desks set out
        // market maps and recipes. No lettering or photo textures are needed.
        shape(boxes,-width*.47,.091,-span*.475,.025,.032,.002,'#e7d7ad');
        shape(boxes,-width*.47,.102,-span*.485,.022,.006,.001,'#5e7258');
      }
      if(printCounter&&phase>.57){
        // Original city drawings are sold as prints as well as on shirts. A
        // shallow half-back keeps the shaded hanging work visible from the aisle.
        shape(boxes,0,frame-.036,.070,.174,.071,.003,'#e1d4b7');
        shape(boxes,0,tableY-.018,-.055+counterShift,.128,.038,.003,'#56706e');
        for(const [j,x] of [-.054,0,.054].entries()){
          shape(boxes,x,.096,.067,.048,.051,.003,'#755b45');
          shape(boxes,x,.096,.064,.043,.047,.002,'#efe3c7');
          shape(boxes,x,.097,.062,.036,.032,.001,['#889aa4','#71938e','#bb8a70'][j]);
          shape(boxes,x,.091,.061,.031,.006,.001,'#4d6768');
        }
        // A box of sleeved prints sits beside the proof held over the counter.
        shape(boxes,-.039,.063,-.030+counterShift,.041,.016,.036,wood);
        for(let j=0;j<4;j++)shape(boxes,-.039,.072,-.044+j*.007+counterShift,.036,.026,.002,'#e6d8bd',0,-.13);
        if(phase>.87){
          shape(boxes,.015,.066,-.050+counterShift,.028,.002,.042,'#f1dfbf',0,.17);
          shape(boxes,.015,.0674,-.050+counterShift,.023,.001,.028,'#5c8681',0,.17);
        }
      }else if(artist&&phase>.57&&i%3===1){
        for(let k=0;k<4;k++){
          const x=(k-1.5)*.029;
          shape(boxes,x,.082,-.036,.025,.047,.003,wood,-.04);
          shape(boxes,x,.082,-.039,.021,.042,.002,'#e8dec4');
          shape(boxes,x,.084,-.041,.017,.025,.001,['#6a8d90','#c69469','#878562','#586e81'][k]);
          shape(boxes,x,.079,-.042,.016,.006,.001,'#475c5e');
        }
      }else if(artist&&phase>.57&&i%3===2){
        for(let k=0;k<3;k++){
          const x=(k-1)*.039;shape(boxes,x,.059,-.03,.035,.004,.029,'#595b58');
          shape(rounds,x,.078,-.018,.023,.033,.012,'#474848');
          for(const side of [-1,1])shape(boxes,x+side*.004,.081,-.024,.0017,.014,.0015,'#d0ae71',-side*.34);
          shape(rounds,x,.074,-.025,.005,.006,.003,'#c4a275');
        }
      }else if(artist&&phase>.57){
        // The plaza sells original silk-screened city apparel as well as prints
        // and jewelry. Display the shirt fronts on the back rail.
        // https://www.cityartapparel.com/about
        const rack=.056+.068*range(phase,.57,.81);
        for(const x of [-.067,.067]){
          const base=groundOffset(x,.069);shape(boxes,x,(rack+base)/2,.069,.003,rack-base,.003,steel);
        }
        shape(boxes,0,rack,.069,.137,.003,.003,steel);
        for(const [x,color] of [[-.040,'#d4b584'],[0,'#7e9fa0'],[.040,'#ece2c9']] as const){
          shape(boxes,x,rack-.026,.066,.026,.039,.004,color);
          shape(boxes,x,rack-.015,.066,.038,.013,.004,color);
          shape(boxes,x,rack-.023,.062,.016,.008,.001,'#465d63');
        }
        for(const z of [-.04,.04]){
          const base=groundOffset(-.078,z);shape(boxes,-.078,(rack+base)/2,z,.003,rack-base,.003,steel);
        }
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
      }else if(site.stall==='flowers'){
        for(const [k,x] of [-.080,-.028,.028,.080].entries()){
          shape(boxes,x,.067,-.031,.032,.023,.028,'#7f8881');
          for(let j=0;j<3;j++){
            const dx=(j-1)*.010,top=.099+((j+k)%3)*.006;
            shape(boxes,x+dx/2,(.076+top)/2,-.031,.003,top-.076,.003,'#58774f',-.25*(j-1));
            shape(rounds,x+dx,top,-.031+(j%2)*.004,.019,.016,.018,flowers[(k+j)%4]);
          }
        }
      }else if(site.stall==='info'||site.stall==='tasting'){
        for(const x of [-.046,-.007,.034]){
          shape(boxes,x,.059,-.037,.030,.003,.022,'#efe5c8');
          shape(boxes,x,.061,-.035,.021,.001,.010,'#8d9a78');
        }
        // A board behind the counter and a sampling bowl are visible across
        // the plaza, without occupying the public aisle in front of the table.
        shape(boxes,-.042,.079,.041,.006,.105,.004,wood);
        shape(boxes,-.042,.094,.038,.079,.057,.003,'#e9dcbc');
        shape(boxes,-.042,.110,.035,.074,.009,.002,cloth);
        if(site.stall==='tasting'){
          shape(rounds,.054,.065,-.013,.041,.015,.034,'#d0b286');
          for(const dx of [-.011,0,.011])shape(rounds,.054+dx,.073,-.013,.012,.010,.012,'#bf754e');
        }
      }else if(!artist){
        for(let k=0;k<3;k++){
          const carried=range(phase,.49+k*.09,.66+k*.09);
          const x=THREE.MathUtils.lerp(cartX,(k-1)*(site.stall ? .071 : .040),carried),z=THREE.MathUtils.lerp(cartZ,-.030,carried);
          const y=THREE.MathUtils.lerp(.034+k*.013,tableY+.011,carried)+Math.sin(carried*Math.PI)*.035;
          const binWidth=site.stall ? .064 : .037,binDepth=site.stall ? .044 : .034;
          shape(boxes,x,y,z,binWidth,.013,binDepth,wood);
          if(site.stall){
            for(const side of [-1,1])shape(boxes,x+side*binWidth*.47,y+.008,z,.003,.010,binDepth,'#b99970');
            shape(boxes,x,y+.006,z-binDepth/2,binWidth,.006,.003,'#bd9a6a');
          }
          for(let j=0;j<6;j++)
            shape(rounds,x+(j%3-1)*binWidth*.27,y+.012,z+(j<3?-.006:.006),
              binWidth*.29,site.stall ? .016 : .009,.013,produce[(i+k)%4]);
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
