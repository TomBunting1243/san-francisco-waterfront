import * as THREE from 'three';

type Plan=number[][];
type Tower={p:Plan;h:number};
type Point=THREE.Vector3;
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
const up=new THREE.Vector3(0,1,0);
const ftToUnits=.3048*.06;

function outline(tower:Tower){
  const points=tower.p.slice(0,-1).map(([x,z])=>new THREE.Vector2(x,z));
  return THREE.ShapeUtils.isClockWise(points)?points:points.reverse();
}
function centroid(plan:THREE.Vector2[]){
  const center=new THREE.Vector2();
  let area=0;
  for(let i=0;i<plan.length;i++){
    const a=plan[i],b=plan[(i+1)%plan.length],cross=a.cross(b);
    area+=cross;center.addScaledVector(a,cross).addScaledVector(b,cross);
  }
  return center.multiplyScalar(1/(3*area));
}

class PaintedSurface{
  readonly positions:number[]=[];
  readonly colors:number[]=[];
  private pigments=new Map<string,THREE.Color>();
  triangle(a:Point,b:Point,c:Point,paint:string){
    let color=this.pigments.get(paint);
    if(!color){color=new THREE.Color(paint);this.pigments.set(paint,color);}
    for(const p of [a,b,c]){
      this.positions.push(p.x,p.y,p.z);
      this.colors.push(color.r,color.g,color.b);
    }
  }
  quad(a:Point,b:Point,c:Point,d:Point,paint:string){
    this.triangle(a,b,c,paint);this.triangle(a,c,d,paint);
  }
  mesh(name:string){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geometry.userData.paintVertices=true;
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.87}));
    mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;
    return mesh;
  }
}

// Pelli Clarke Pelli south/east elevations, sheets 49–50: 172-ft base, 382-ft
// straight wall, 912-ft roof, 954'-6" glass parapet and 1070-ft screen summit.
// Intermediate widths are read as fractions of the base from elevation sheet 49.
// https://sfplanning.s3.amazonaws.com/default/files/meetingarchive/planning_dept/commissions.sfplanning.org/cpcpackets/2008.0789K%20%26%202012.0257EBX.pdf#page=176
// As-built glass, sunshades and open crown: https://pcparch.com/work/salesforce-tower
const salesforceProfile=[
  [0,1],[382,1],[520,.992],[680,.966],[800,.911],[912,.824],
  [954.5,.762],[1004,.670],[1043,.568],[1070,88.5/172],
] as const;
const sfRoof=912,sfScreen=954.5;
export function salesforceScale(feet:number){
  for(let i=1;i<salesforceProfile.length;i++){
    const [y1,w1]=salesforceProfile[i-1],[y2,w2]=salesforceProfile[i];
    if(feet<=y2)return THREE.MathUtils.lerp(w1,w2,THREE.MathUtils.clamp((feet-y1)/(y2-y1),0,1));
  }
  return salesforceProfile.at(-1)![1];
}

export function createSalesforceTower(tower:Tower){
  const root=new THREE.Group();root.name='Salesforce Tower';
  const plan=outline(tower),center=centroid(plan);
  // A station retains every mapped plan corner. Regular curtain-wall joints
  // are interpolated within the surveyed outline and projected up the profile.
  const offsets=plan.map(p=>p.clone().sub(center));
  const walls=new PaintedSurface(),fins=new PaintedSurface(),screen=new PaintedSurface();
  function point(offset:THREE.Vector2,feet:number,lip=0){
    const s=salesforceScale(feet),radius=offset.length();
    return new THREE.Vector3(center.x+offset.x*(s+lip/radius),feet/1070*tower.h,center.y+offset.y*(s+lip/radius));
  }
  function bands(feet:number,thick:number,depth:number,color:string,target:PaintedSurface){
    for(let i=0;i<offsets.length;i++){
      const a=offsets[i],b=offsets[(i+1)%offsets.length];
      target.quad(point(a,feet,depth),point(b,feet,depth),point(b,feet+thick,depth),point(a,feet+thick,depth),color);
      target.quad(point(a,feet+thick,depth),point(b,feet+thick,depth),point(b,feet+thick),point(a,feet+thick),color);
    }
  }
  const colors=['#668899','#6f919f','#7696a1','#627f8d','#718e9c'];
  for(let s=1;s<salesforceProfile.length;s++){
    const low=salesforceProfile[s-1][0],high=salesforceProfile[s][0];
    if(high>sfScreen)break;
    for(let i=0;i<offsets.length;i++){
      const a=offsets[i],b=offsets[(i+1)%offsets.length];
      walls.quad(point(a,low),point(b,low),point(b,high),point(a,high),low>=sfRoof?'#83a1a7':colors[Math.floor(i/3)%colors.length]);
    }
  }
  // Lobby glazing reads taller below the first occupied band.
  for(let floor=1;floor<=61;floor++){
    const feet=22+(sfRoof-22)*floor/61;
    bands(feet,.72,feet<382?.049:.034,floor%6===0?'#b9bdaf':'#a0b2af',fins);
    bands(feet-.64,.43,.014,'#516e7b',fins);
  }
  for(let feet=sfScreen;feet<1070;feet+=7.5){
    bands(feet,1.05,.018,feet<988?'#a9b6ae':'#a0b3b4',screen);
  }
  bands(1069,1,.013,'#bec6ba',screen);
  for(let i=0;i<offsets.length;i++){
    const a=offsets[i],b=offsets[(i+1)%offsets.length],distance=a.distanceTo(b);
    const steps=Math.max(1,Math.round(distance/.129));
    for(let step=0;step<steps;step++){
      const from=a.clone().lerp(b,(step+.33)/steps);
      const to=a.clone().lerp(b,(step+.33)/steps+Math.min(.28/steps,.015/distance));
      for(let s=1;s<salesforceProfile.length;s++){
        const low=Math.max(15,salesforceProfile[s-1][0]),high=salesforceProfile[s][0];
        const depth=low<382?.044:low<sfRoof?.039:.019;
        (low>=sfScreen?screen:fins).quad(point(from,low,depth),point(to,low,depth),point(to,high,depth),point(from,high,depth),
          low>=sfScreen?'#9caeaf':step%3===0?'#a7b7b3':'#9caeb0');
      }
    }
  }
  // The screen's open top exposes its inner maintenance structure rather than
  // putting a solid dome above the curtain wall.
  const inner=new PaintedSurface();
  for(let i=0;i<offsets.length;i++){
    const a=offsets[i].clone().multiplyScalar(.64),b=offsets[(i+1)%offsets.length].clone().multiplyScalar(.64);
    inner.quad(point(a,947),point(b,947),point(b,1020),point(a,1020),'#758d93');
    inner.triangle(point(a,1020),point(b,1020),new THREE.Vector3(center.x,tower.h*1020/1070,center.y),'#8b9a95');
  }
  root.add(walls.mesh('Rounded-square glazed shaft'),fins.mesh('Floor sunshades and vertical mullions'),
    screen.mesh('Open steel screen crown'),inner.mesh('Recessed crown plant'));
  return root;
}

// USGS NSMP survey: 174-ft square base, base truss, 853-ft summit and outriggers
// beginning at floor 29. NIST Fig. 3.3.2 records the 640'-6" 48th-floor elevation.
// https://www.strongmotioncenter.org/NCESMD/photos/NSMP/bldlayouts/bld1239.pdf
// https://nehrpsearch.nist.gov/static/files/NSF/PB83204339.pdf
const pyrFloor29=384,pyrSpire=640.5,pyrSummit=853;
export function createTransamericaPyramid(tower:Tower){
  const root=new THREE.Group();root.name='Transamerica Pyramid';
  const [first,second]=tower.p,opposite=tower.p.at(-2)!;
  const center=new THREE.Vector2((second[0]+opposite[0])/2,(second[1]+opposite[1])/2);
  const angle=-Math.atan2(first[1]-second[1],first[0]-second[0]);
  const w=Math.hypot(first[0]-second[0],first[1]-second[1])/2;
  const shell=new PaintedSurface(),wings=new PaintedSurface(),glazing=new PaintedSurface(),truss=new THREE.Group();
  truss.name='Pereira plaza truss';
  const windows:Pane[]=[];
  const bodyBase=44,baseHalf=w*.85,yOf=(feet:number)=>feet*tower.h/pyrSummit;
  const half=(feet:number)=>baseHalf*(pyrSummit-feet)/(pyrSummit-bodyBase);
  const p=(x:number,feet:number,z:number,side:number)=>{
    const a=angle+side*Math.PI/2;
    return new THREE.Vector3(center.x+Math.cos(a)*x+Math.sin(a)*z,yOf(feet),center.y-Math.sin(a)*x+Math.cos(a)*z);
  };
  const beamGeometry=new THREE.BoxGeometry();
  const beamMaterial=new THREE.MeshStandardMaterial({color:'#c9c5b3',roughness:.84});
  function beam(a:Point,b:Point,width:number,deep:number){
    const segment=b.clone().sub(a),m=new THREE.Mesh(beamGeometry,beamMaterial);
    m.position.copy(a).lerp(b,.5);m.scale.set(width,segment.length(),deep);
    m.quaternion.setFromUnitVectors(up,segment.normalize());
    m.castShadow=m.receiveShadow=true;truss.add(m);
    return m;
  }
  for(let side=0;side<4;side++){
    const h=half(bodyBase),tip=p(0,pyrSummit,0,side),spireHalf=half(pyrSpire);
    shell.quad(p(-h,bodyBase,h,side),p(h,bodyBase,h,side),p(spireHalf,pyrSpire,spireHalf,side),p(-spireHalf,pyrSpire,spireHalf,side),'#d8d3bf');
    shell.triangle(p(-spireHalf,pyrSpire,spireHalf,side),p(spireHalf,pyrSpire,spireHalf,side),tip,'#e2ddc9');
    const lobby=.73*w;
    glazing.quad(p(-lobby,0,lobby,side),p(lobby,0,lobby,side),p(lobby,bodyBase,lobby,side),p(-lobby,bodyBase,lobby,side),'#586f6d');
    for(let i=0;i<6;i++){
      const left=-h+i*2*h/6,right=-h+(i+1)*2*h/6,mid=-w+(i+.5)*2*w/6;
      const a=p(mid,1,w,side);
      beam(a,p(left,bodyBase,h+.012,side),.075,.077);
      beam(a,p(right,bodyBase,h+.012,side),.075,.077);
      const post=-lobby+i*2*lobby/6;
      beam(p(post,0,lobby+.012,side),p(post,bodyBase,lobby+.012,side),.033,.034);
    }
    // Native face widths shrink floor by floor. Pale precast piers remain
    // between the dark openings and the central shafts stay blind.
    for(let floor=0;floor<44;floor++){
      const feet=53+floor*13.45;
      if(feet>pyrSpire-3.5)break;
      const h=half(feet),n=Math.max(3,Math.round(2*h/.151)),step=2*h/n;
      for(let j=0;j<n;j++){
        const x=-h+(j+.5)*step,axis=angle+side*Math.PI/2;
        if(side%2===0&&feet>=pyrFloor29&&feet<=pyrSpire&&Math.abs(x)<.23)continue;
        const position=p(x,feet,h+.017,side);
        windows.push({x:position.x,y:position.y,z:position.z,ry:axis,w:step*.64,h:.124});
      }
    }
    if(side%2===0){
      // The east and west wedge-shaped service fins rise vertically from the
      // co-planar 29th-floor base and return to the spire at the top.
      const halfShaft=19.333*ftToUnits/2,depth=half(pyrFloor29);
      const top=side===0?622:629,join=side===0?646:653;
      const baseLeft=p(-halfShaft,pyrFloor29,depth+.014,side),baseRight=p(halfShaft,pyrFloor29,depth+.014,side);
      const outerTopLeft=p(-halfShaft,top,depth+.014,side),outerTopRight=p(halfShaft,top,depth+.014,side);
      const innerTopLeft=p(-halfShaft,join,half(join)-.016,side),innerTopRight=p(halfShaft,join,half(join)-.016,side);
      wings.quad(baseLeft,baseRight,outerTopRight,outerTopLeft,'#d6d0bc');
      wings.quad(outerTopLeft,outerTopRight,innerTopRight,innerTopLeft,'#e1dac5');
      wings.triangle(baseLeft,outerTopLeft,innerTopLeft,'#cbc6b6');
      wings.triangle(baseRight,innerTopRight,outerTopRight,'#c4bfae');
      for(let f=0;f<4;f++){
        const start=top-12-f*2.45;
        wings.quad(p(-halfShaft*.70,start,depth+.017,side),p(halfShaft*.70,start,depth+.017,side),
          p(halfShaft*.70,start+.74,depth+.017,side),p(-halfShaft*.70,start+.74,depth+.017,side),'#9b9c90');
      }
    }
  }
  root.add(shell.mesh('Tapered quartz-clad frame and spire'),wings.mesh('East and west service fins'),
    glazing.mesh('Recessed lobby glazing'),truss);
  return {root,windows};
}
