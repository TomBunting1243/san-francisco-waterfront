import * as THREE from 'three';
import {bridgeLayout} from './bridge-layout.ts';

type BridgeMesh=(shape:THREE.BufferGeometry,color:string,x:number,y:number,z:number,parent:THREE.Group)=>THREE.Mesh;
type Level=[y:number,halfWidth:number,halfDepth:number,recessWidth:number,recessDepth:number];
type XY=[number,number];
type XYZ=[number,number,number];
const feet=.3048*.06;
export const bridgeAnchorageStations={land:15.64-890*feet,w1:15.64,w4:bridgeLayout.anchor} as const;

/** HAER CA-32 sheet 11 and archival views 26, 150, 170 and 203. */
export function addBridgeAnchorages(bridge:THREE.Group,mesh:BridgeMesh,lower:number,upper:number){
  const concrete='#a3a698',bearing='#7c8784',steel='#839797',darkSteel='#667c81';
  const unit=new THREE.BoxGeometry(1,1,1);
  function set(name:string,z:number){
    const g=new THREE.Group();g.name=name;g.position.z=z;bridge.add(g);return g;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,c:string,g:THREE.Group,name=''){
    const member=mesh(unit,c,x,y,z,g);member.scale.set(w,h,d);member.name=name;return member;
  }
  function link(a:XYZ,b:XYZ,r:number,c:string,g:THREE.Group,name:string){
    const from=new THREE.Vector3(...a),delta=new THREE.Vector3(...b).sub(from);
    const mid=from.addScaledVector(delta,.5);
    const pipe=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),c,mid.x,mid.y,mid.z,g);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());pipe.name=name;return pipe;
  }
  function ring([,w,d,r,recess]:Level):XY[]{
    return [[-w,-d],[-r,-d],[-r,-d+recess],[r,-d+recess],[r,-d],[w,-d],
      [w,d],[r,d],[r,d-recess],[-r,d-recess],[-r,d],[-w,d]];
  }
  function body(levels:Level[],g:THREE.Group,name:string){
    const positions:number[]=[],colors:number[]=[],rings=levels.map(ring);
    function vertex([x,y,z]:XYZ,edge:number,band:number){
      const cloud=.044*Math.sin(x*19.7+z*3.27+edge)*Math.cos(y*3.17+band*.7);
      const runs=.051*Math.sin(x*33+z*31.3+edge*.43);
      const stain=.94+cloud+runs+(edge===2||edge===8?-.085:.009);
      positions.push(x,y,z);colors.push(stain*1.014,stain*1.003,stain*.987);
    }
    function point([x,z]:XY,y:number):XYZ{return [x,y,z];}
    for(let j=1;j<rings.length;j++){
      const prev=rings[j-1],next=rings[j];
      const bottom=levels[j-1][0],top=levels[j][0];
      for(let i=0;i<prev.length;i++){
        const e=(i+1)%prev.length;
        const a=point(prev[i],bottom), b=point(next[i],top),c=point(next[e],top),d=point(prev[e],bottom);
        // Interpolated pigments run between pour lines. The panel itself stays planar.
        const columns=Math.max(1,Math.ceil(Math.hypot(d[0]-a[0],d[2]-a[2])/.23));
        for(let col=0;col<columns;col++){
          const along=(p:XYZ,q:XYZ,t:number):XYZ=>[THREE.MathUtils.lerp(p[0],q[0],t),p[1],THREE.MathUtils.lerp(p[2],q[2],t)];
          const ll=along(a,d,col/columns),lr=along(a,d,(col+1)/columns);
          const ul=along(b,c,col/columns),ur=along(b,c,(col+1)/columns);
          for(const v of [ll,ul,ur,ll,ur,lr])vertex(v,i,j);
        }
      }
    }
    const top=rings.at(-1)!,y=levels.at(-1)![0],contour=top.map(p=>new THREE.Vector2(...p));
    for(const tri of THREE.ShapeUtils.triangulateShape(contour,[])){
      const [a,b,c]=tri.map(i=>point(top[i],y));
      for(const v of [c,b,a])vertex(v,4,0);
    }
    const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    geometry.userData.paintVertices=true;
    const mass=mesh(geometry,concrete,0,0,0,g);mass.name=name;
  }

  const land=set('San Francisco gravity anchorage',bridgeAnchorageStations.land);
  // 184 ft 6 in long by 108 ft wide in sheet 11. Its shoulder rooms end below traffic.
  body([
    [-.19,54*feet,92.25*feet,.42,.092],[.34,54*feet,92.25*feet,.42,.092],
    [.36,.971,1.663,.408,.126],[.79,.962,1.632,.413,.133],[.804,.948,1.61,.413,.143],
    [1.61,.915,1.51,.395,.127],[1.625,.901,1.495,.395,.138],[2.30,.875,1.410,.382,.125],
    [2.315,.860,1.392,.374,.132],[3.03,.811,1.318,.345,.102],[3.047,.794,1.298,.342,.112],
    [lower-.136,.762,1.225,.306,.056],
  ],land,'Battered San Francisco anchorage concrete');
  box(1.52,.098,2.421,0,lower-.092,0,'#aeb0a2',land,'Lower roadway bearing shelf');
  for(const side of [-1,1]){
    for(const [y,z] of [[.71,1.624],[.73,-1.622]]){
      box(.123,.135,.026,side*.75,y,z,'#777f71',land);
      box(.081,.093,.034,side*.75,y,z+Math.sign(z)*.016,'#495957',land,'Cable chamber opening');
    }
    for(const z of [-.80,.43,.80]){
      box(.090,.112,.395,side*.71,upper+.101,z,'#9da296',land,'Roadside maintenance recess casing');
      box(.013,.065,.267,side*.754,upper+.101,z,'#657771',land);
    }
  }

  const w1=set('Pier W1 transition bent and pump station',bridgeAnchorageStations.w1);
  // The tall inset is solid at its back. It never passes through the traffic levels.
  body([
    [-.16,1.01,.574,.400,.105],[.31,1.01,.574,.400,.105],[.33,.972,.557,.391,.123],
    [.89,.942,.545,.380,.144],[.907,.928,.538,.380,.164],[1.55,.890,.522,.371,.166],
    [1.568,.877,.514,.371,.183],[2.18,.848,.500,.357,.185],[2.195,.833,.487,.353,.198],
    [2.79,.811,.478,.338,.197],[2.805,.797,.467,.337,.211],[lower-.116,.772,.451,.319,.170],
  ],w1,'Pier W1 battered concrete and recessed field');
  box(1.48,.081,.932,0,lower-.092,0,'#adb0a2',w1,'Pier W1 deck bearing');
  for(const side of [-1,1]){
    box(.101,.052,.021,side*.229,.152,-.614,'#7c8275',w1);
    box(.198,.170,.43,side*.753,lower-.096,0,bearing,w1,'Lower truss shoe');
    box(.168,.634,.31,side*.765,lower+.233,0,'#9aada9',w1,'Pier W1 cable bent post');
    box(.151,.654,.036,side*.765,lower+.243,-.161,steel,w1);
    box(.180,.084,.311,side*.762,upper+.040,0,darkSteel,w1);
    box(.148,.277,.224,side*.753,upper+.210,0,steel,w1,'Pier W1 saddle housing');
    box(.160,.103,.340,side*.75,4.805,0,bearing,w1,'Pier W1 cable saddle');
  }
  box(.752,.310,.074,0,.233,-.574,'#aeb0a2',w1,'Pump-station entrance base');
  box(.111,.156,.013,0,.172,-.616,'#686e65',w1,'Pump-station double door');
  box(.002,.139,.008,0,.170,-.625,'#9c9d8b',w1);

  const w4=set('Pier W4 central anchorage',bridgeAnchorageStations.w4);
  body([
    [-.98,1.115,1.75,.41,.041],[-.15,1.115,1.75,.41,.041],[.00,1.05,1.697,.39,.049],
  ],w4,'W4 chamfered caisson and fender seat');
  body([
    [-.017,.893,1.504,.345,.110],[.48,.886,1.487,.339,.128],[.498,.869,1.473,.334,.145],
    [1.09,.852,1.449,.323,.177],[1.110,.833,1.431,.321,.194],[1.94,.817,1.412,.314,.202],
    [1.959,.807,1.398,.310,.213],[2.67,.780,1.383,.299,.224],[2.688,.765,1.367,.295,.233],
    [lower-.116,.748,1.32,.282,.178],
  ],w4,'W4 battered concrete and end reveals');
  box(1.48,.082,2.67,0,lower-.089,0,'#acafa1',w4,'W4 lower deck bearing');
  for(const x of [-1.08,1.08])for(let z=-1.66;z<1.67;z+=.101){
    box(.046,.54,.047,x,-.426,z,'#73766a',w4);
  }
  for(const z of [-1.735,1.735])for(let x=-1.01;x<=1.02;x+=.102){
    box(.046,.54,.047,x,-.426,z,'#797a6c',w4);
  }
  // The A-frame shrouds occupy the two road shoulders. The roof of the lower road
  // is the existing upper deck and its truss, so the upper road stays open to sky.
  const sideProfile:[[number,number],...Array<[number,number]>]=[
    [-1.43,lower-.014],[-1.43,upper+.27],[-1.23,4.782],[-.80,4.924],[-.37,4.945],
    [0,4.992],[.37,4.945],[.80,4.924],[1.23,4.782],[1.43,upper+.27],[1.43,lower-.014],
  ];
  for(const side of [-1,1]){
    const shell=new THREE.Shape();
    sideProfile.forEach(([z,y],i)=>i===0?shell.moveTo(-side*z,y):shell.lineTo(-side*z,y));shell.closePath();
    const hood=mesh(new THREE.ExtrudeGeometry(shell,{depth:.218,bevelEnabled:false}),steel,side*.648,0,0,w4);
    hood.rotation.y=side*Math.PI/2;hood.name='W4 folded steel A-frame shroud';
    for(const z of [-1.17,-.84,-.51,-.18,.18,.51,.84,1.17]){
      const h=Math.abs(z)>1.04?1.07:1.23;
      box(.012,h,.015,side*.872,lower+.035+h/2,z,darkSteel,w4,'W4 casing seam');
    }
    for(const y of [lower+.052,upper-.068,upper+.172]){
      box(.019,.026,2.69,side*.869,y,0,'#91a09a',w4);
    }
  }

  // The main cables crest over W1, then descend under the land spans into the
  // gravity chamber. The 890 ft separation leaves the two pieces legible.
  for(const x of [-.75,.75]){
    const entry=land.position.z+1.64;
    link([x,.71,entry],[x,4.85,w1.position.z],.027,'#536e7b',bridge,'Continuous land cable tail');
  }
  return {land,w1,w4};
}
