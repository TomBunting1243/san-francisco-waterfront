import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from './harbor-font.json' with {type:'json'};
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][]};
type Point=[number,number];
type Window={x:number;y:number;z:number;ry:number;w:number;h:number};

const epicId=188401113, waterbarId=188401115;
const angle=Math.atan2(-.153,.988),cos=Math.cos(angle),sin=Math.sin(angle);
const grade=.11,m=.06;
const font=new FontLoader().parse(fontData);
const materials=new Map<string,THREE.MeshStandardMaterial>();
const local=([x,z]:number[]):Point=>[cos*(x+40)-sin*(z+1),sin*(x+40)+cos*(z+1)];
const metal='#4e5957',glass='#588186',timber='#937862',terracotta='#a6674b';

// Both buildings were completed in 2008, with a public piazza between them.
// https://www.sfport.com/media/9230/download (Port history, H5)
// https://www.epicsteak.com/  https://www.waterbarsf.com/
// https://www.sfpdv.com/waterbar (published view looking south from EPIC)
// In this orthogonal frame u increases toward Cupid's Span, v toward the bay.
// Heights below are metres above the promenade, checked on USGS 2023 first
// returns. OSM supplies the walls; SF 2024 orthophotography locates roof plant.
export function addRinconRestaurant(b:Building,root:THREE.Group,windows:Window[]){
  if(b.id!==epicId&&b.id!==waterbarId)return false;
  const epic=b.id===epicId,outline=b.p.slice(0,-1).map(local);
  const site=new THREE.Group();site.name=epic?'EPIC Steak · Rincon Park':'Waterbar · Rincon Park';
  site.position.set(-40,0,-1);site.rotation.y=angle;root.add(site);
  const cube=new THREE.BoxGeometry();
  function part(g:THREE.BufferGeometry,color:string,parent:THREE.Object3D=site){
    let mat=materials.get(color);
    if(!mat){mat=new THREE.MeshStandardMaterial({color,roughness:.8});materials.set(color,mat);}
    const mesh=new THREE.Mesh(g,mat);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function box(w:number,h:number,d:number,x:number,y:number,z:number,c:string,parent:THREE.Object3D=site){
    const o=part(cube,c,parent);o.position.set(x,y,z);o.scale.set(w,h,d);return o;
  }
  function slab(ring:Point[],y:number,depth:number,color:string,name:string){
    const o=part(footprintGeometry(ring,depth),color);o.position.y=y;o.name=name;return o;
  }
  // Clip roof plates at real changes of level without spanning the notches in
  // either mapped facade or building a large continuous box across the piazza.
  function clip(ring:Point[],axis:0|1,cut:number,greater:boolean){
    const out:Point[]=[];
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      const keep=(p:Point)=>greater?p[axis]>=cut:p[axis]<=cut;
      if(keep(a))out.push(a);
      if(keep(a)!==keep(b)){const t=(cut-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    }
    return out;
  }
  function nameplate(label:string,width:number,y:number,out:number,g:THREE.Object3D,ink:string){
    const geo=new THREE.ShapeGeometry(font.generateShapes(label,1),4);geo.computeBoundingBox();
    const bb=geo.boundingBox!,scale=width/(bb.max.x-bb.min.x);
    geo.translate(-(bb.max.x+bb.min.x)/2,-(bb.max.y+bb.min.y)/2,0);geo.scale(scale,scale,scale);
    const letters=part(geo,ink,g);letters.position.set(0,y,out);letters.name=label+' lettering';
  }
  const signed=outline.reduce((sum,p,i)=>{const q=outline[(i+1)%outline.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  const trim=epic?'#6e746d':'#aaa68c',stone=epic?'#c9b397':terracotta;
  const floor=grade+.012;
  // Low Waterbar deck faces its sister restaurant; EPIC's bay wing has a
  // lower white membrane roof than its street-facing block.
  const topAt=(u:number,v:number)=>grade+m*(epic?(v>-.15?4.8:6.1):(u>-.445?3.6:6.0));
  function face(a:Point,b:Point){
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const nx=(signed>0?dz:-dz)/len,nz=(signed>0?-dx:dx)/len;
    const g=new THREE.Group();g.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);g.rotation.y=Math.atan2(nx,nz);site.add(g);
    return {len,nx,nz,g};
  }
  function facade(a:Point,b:Point,edge:number){
    const {len,nx,nz,g}=face(a,b),u=g.position.x,v=g.position.z;
    const roof=topAt(u-nx*.008,v-nz*.008),height=roof-floor;
    const door=epic?edge===12:edge===2,service=epic?edge===10:edge===9;
    const brickWall=!epic&&(edge===0||edge===7||edge===9);
    const podium=brickWall?height:epic?(v<-.70?.14:.055):.044;
    // On illuminated dining frontages each jamb, glazing bar and
    // soffit samples the apertures in its own wall, so a corner is an occluder.
    const bounce=!brickWall&&!service&&(nz>.3||(epic?nx<-.5:nx>.5));
    const panes:THREE.Mesh[]=[];
    const inverse=new THREE.Matrix4(),localPoint=new THREE.Vector3(),localNormal=new THREE.Vector3();
    let haveFrame=false;
    function incident(point:THREE.Vector3,normal:THREE.Vector3){
      if(!haveFrame){inverse.copy(g.matrixWorld).invert();haveFrame=true;}
      localPoint.copy(point).applyMatrix4(inverse);
      localNormal.copy(normal).transformDirection(inverse);
      let sum=0;
      for(const pane of panes){
        const level=pane.userData.signLight?.[0];
        if(!level)continue;
        const {position,scale}=pane;
        const depth=localPoint.z-(position.z+scale.z/2);
        // The opaque facade blocks rays to the rear. Its projecting receivers
        // also see the first strip of promenade lit by this same pane.
        if(localPoint.z<.014||depth>.065)continue;
        const halfW=scale.x*.46,halfH=scale.y*.46;
        const x=THREE.MathUtils.clamp(localPoint.x-position.x,-halfW,halfW);
        const y=THREE.MathUtils.clamp(localPoint.y-position.y,-halfH,halfH);
        const dx=position.x+x-localPoint.x;
        if(Math.abs(dx)>.12)continue;
        if(depth>0){
          // Average across the local part of the pane. A thin mullion can
          // receive light from the left or right even right over the glass.
          for(const shift of [-.018,.018]){
            const sx=position.x+THREE.MathUtils.clamp(x+shift,-halfW,halfW)-localPoint.x;
            const sy=position.y+THREE.MathUtils.clamp(y+shift,-halfH,halfH)-localPoint.y;
            const d2=sx*sx+sy*sy+depth*depth;
            const facing=sx*localNormal.x+sy*localNormal.y-depth*localNormal.z;
            sum+=.5*level*depth*Math.max(0,facing)/d2/(1+d2/.0016);
          }
        }
        // A short, diffuse second bounce from the paving in front of the
        // opening reaches the lower stonework and outer faces of the jambs.
        // Keep the receiver above and in front of the base of this wall.
        const down=grade-localPoint.y,out=.115-localPoint.z;
        const d2=dx*dx+down*down+out*out;
        const facing=dx*localNormal.x+down*localNormal.y+out*localNormal.z;
        const baseLight=1/(1+Math.max(0,position.y-scale.y/2-grade)*7);
        sum+=level*baseLight*Math.max(0,facing)/Math.sqrt(d2)/(1+d2/.018)*.80;
      }
      return sum*1.5;
    }
    function receiver(mesh:THREE.Mesh){
      if(bounce){mesh.userData.uplight=incident;mesh.userData.uplightTint=[.63,.29];}
    }
    box(len,height,.024,0,floor+height/2,-.009,brickWall?stone:metal,g);
    receiver(box(len,podium,.030,0,floor+podium/2,0,stone,g));
    if(!brickWall){
      const bays=Math.max(1,Math.round(len/(epic?.20:.23))),bw=len/bays;
      for(let j=0;j<bays;j++){
        const x=(j+.5)*bw-len/2,isDoor=(door||service)&&j===Math.floor(bays/2);
        const bottom=isDoor?floor:floor+podium,head=roof-.027;
        const bg=isDoor?(service?'#777d73':'#4d635f'):glass;
        const diningPane=box(bw-.014,head-bottom,.016,x,(bottom+head)/2,.011,bg,g);
        diningPane.name=isDoor?(service?'Service door':'Dining entrance glazing'):'Dining room glass';
        // Bay-facing dining windows cast warm light across the waterfront terrace.
        // https://doc.epicsteak.com/pdf/EpicRoasthouse_PrivateDining.pdf
        // https://www.waterbarsf.com/about/
        if(bounce){
          const level=(j+edge)%5===1?.46:.70;
          diningPane.userData.signLight=[level,level*(epic?.57:.63),level*.29];
          panes.push(diningPane);
          if(j%2===0)diningPane.userData.ferryWalkPool={radius:.64,strength:.52};
        }
        if(isDoor){
          box(.007,.031,.009,x+bw*.25,floor+.063,.025,'#c3b295',g);
          receiver(box(bw,.012,.062,x,floor+.146,.029,epic?'#617e7b':metal,g));
        }else if(head-bottom>.085){
          const frame=epic?metal:'#5e5547';
          receiver(box(bw,.009,.021,x,bottom+(head-bottom)*.63,.020,frame,g));
          receiver(box(.009,head-bottom,.021,x,(bottom+head)/2,.020,frame,g));
          // Opening quads on the bay and park elevations, inside each jamb.
          if((nz>.3||nx>.5)&&j%2===1){
            const x0=u+nz*(x-bw*.23)+nx*.023,z0=v-nx*(x-bw*.23)+nz*.023;
            const wx=cos*nx+sin*nz,wz=-sin*nx+cos*nz;
            windows.push({x:-40+cos*x0+sin*z0,z:-1-sin*x0+cos*z0,y:bottom+(head-bottom)*.32,
              ry:Math.atan2(wx,wz),w:bw*.38,h:(head-bottom)*.52});
          }
        }
        receiver(box(epic?.018:.038,height,.041,x-bw/2+.006,floor+height/2,.012,epic?trim:stone,g));
      }
    }
    receiver(box(len+.012,.022,.060,0,roof-.009,.006,metal,g));
    if(epic&&edge===12){
      // The street entry sits beneath the grey-clad sign block and shallow
      // projecting canopy. The facade photograph shows raised red initials.
      const w=.27;
      box(w,.15,.032,0,roof-.077,.032,'#9c9d92',g);
      nameplate('EPIC',.16,roof-.078,.050,g,'#923e3c');
      box(w+.025,.012,.11,0,floor+.15,.055,'#687e78',g);
    }
    if(!epic&&edge===0){
      nameplate('Waterbar',Math.min(.23,len*.63),floor+height*.55,.019,g,'#536eaf');
      for(let j=1;j<5;j++)box(len-.014,.003,.005,0,floor+j*height/5,.018,'#a87759',g);
    }
  }
  for(let i=0;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];
    const axis=epic?1:0,cut=epic?-.15:-.445;
    if((a[axis]-cut)*(b[axis]-cut)<0){
      const t=(cut-a[axis])/(b[axis]-a[axis]),mid:Point=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
      facade(a,mid,i);facade(mid,b,i);
    }else facade(a,b,i);
  }
  const roofAxis=epic?1:0,cut=epic?-.15:-.445;
  const high=clip(outline,roofAxis,cut,false),low=clip(outline,roofAxis,cut,true);
  const highY=grade+(epic?6.1:6.0)*m,lowY=grade+(epic?4.8:3.6)*m;
  slab(high,highY-.025,.025,epic?'#cdc9b9':'#bdb9aa','Main flat roof');
  slab(low,lowY-.020,.020,epic?'#dad6c5':'#a59077',epic?'Bay dining wing roof':'North dining deck');
  const seam=high.filter(p=>Math.abs(p[roofAxis]-cut)<.00001).sort((a,b)=>a[1-roofAxis]-b[1-roofAxis]);
  if(seam.length>=2){
    const {g,len}=face(seam[0],seam.at(-1)!);
    box(len,highY-lowY,.025,0,(highY+lowY)/2,0,epic?'#acaaa0':stone,g);
  }
  const plantU=epic?1.84:-1.36,plantV=epic?-.55:.15;
  box(epic?.71:.79,.065,.32,plantU,highY+.032,plantV,'#91928a').name='Screened roof plant';
  for(let j=0;j<4;j++){
    const u=plantU-.25+j*.16;
    box(.119,.045+(j%2)*.020,.134,u,highY+.085,plantV,'#aaa99e');
    const vent=part(new THREE.CylinderGeometry(.032,.032,.008,10),'#646e6a');
    vent.position.set(u,highY+.111+(j%2)*.02,plantV);
  }
  if(!epic){
    // Two dark square parasols and horizontal steel rails on Waterbar's raised
    // north deck are visible from the public dining piazza.
    for(const edge of [0,1]){
      const a=outline[edge],b=outline[edge+1],{g,len}=face(a,b);
      for(let k=0;k<=4;k++)box(len,.004,.006,0,lowY+.018+k*.012,.004,metal,g);
      for(const t of [-.45,0,.45])box(.008,.071,.008,t*len,lowY+.035,.004,metal,g);
    }
    for(const v of [-.47,-.25]){
      const canopy=part(new THREE.ConeGeometry(.111,.034,4),'#615f56');
      canopy.position.set(-.26,lowY+.139,v);canopy.rotation.y=Math.PI/4;
      box(.006,.134,.006,-.26,lowY+.066,v,timber);
    }
  }
  return true;
}
