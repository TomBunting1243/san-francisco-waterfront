import * as THREE from 'three';
import {center,footprintGeometry} from './sf-map.ts';
import {insideBuilding} from './building-character.ts';

type Building={id:number;name:string;p:number[][];h:number;minH?:number;part?:boolean;parent?:number;material?:string};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number};
type Opening={x:number;bottom:number;w:number;h:number;rise?:number;door?:boolean};

export const hillsParts=new Set([-157,1487160484,944986473]);
const streetProfiles=new Map([
  [191861045,{name:'318 Spear Street',floors:8,wall:'#a3a79d',glazing:'#5e8081'}],
  [421816058,{name:'333 Main Street',floors:9,wall:'#b0b4a9',glazing:'#627d7b'}],
]);
export function hasShorelineFacade(b:Building){
  return hillsParts.has(b.id)||(!b.name&&!b.part&&!b.parent&&streetProfiles.has(b.id));
}

function contour(path:THREE.Path,opening:Opening){
  const {x,bottom,w,h,rise=0}=opening,left=x-w/2,right=x+w/2,top=bottom+h;
  path.moveTo(left,bottom);path.lineTo(right,bottom);path.lineTo(right,top-rise);
  if(rise)path.absellipse(x,top-rise,w/2,rise,0,Math.PI,false,0);
  else path.lineTo(left,top);
  path.closePath();
}

export function shorelineFacade(b:Building,neighbors:Building[],color:string){
  const root=new THREE.Group(),windows:Pane[]=[],mats=new Map<string,THREE.MeshStandardMaterial>();
  const hills=hillsParts.has(b.id),plant=b.id===-157,profile=streetProfiles.get(b.id);
  root.name=hills?(plant?'Hills Bros. Coffee Plant':'Hills Bros. Coffee tower'):profile?.name??'Mapped shoreline frontage';
  const courses=hills?'#b39279':'#b8ac97',frame=hills?'#495859':'#65716a',glass=hills?'#506a72':profile?.glazing??'#637c7c';
  const wall=hills?'#a7806a':profile?.wall??color;
  const coping=hills?'#b69578':'#b7b6a6';
  const depth=hills?.073:.041,base=b.minH||0,h=b.h;
  function mesh(geo:THREE.BufferGeometry,c:string,x:number,y:number,z:number,g:THREE.Group){
    let mat=mats.get(c);
    if(!mat){mat=new THREE.MeshStandardMaterial({color:c,roughness:.88});mats.set(c,mat);}
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;
  }
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,c:string,g:THREE.Group)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z,g);
  const extrusion=(shape:THREE.Shape,d:number)=>new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,curveSegments:12});
  const closed=b.p[0][0]===b.p.at(-1)![0]&&b.p[0][1]===b.p.at(-1)![1];
  const ring=closed?b.p.slice(0,-1):b.p;
  const area=ring.reduce((sum,[x,z],i)=>{const [a,q]=ring[(i+1)%ring.length];return sum+x*q-z*a;},0);
  const [cx,cz]=center(ring);
  const near=neighbors.filter(peer=>peer.id!==b.id&&peer.p.some(([x,z])=>Math.abs(x-cx)<11&&Math.abs(z-cz)<11));
  const slab=mesh(footprintGeometry(b.p,.064),hills?'#8d8376':'#a5a28f',0,h-.052,0,root);
  slab.name=hills?'Gravel roof behind the brick parapet':'Roof deck';

  function openings(g:THREE.Group,w:number,a:number,y:number,entries:Opening[],through=false){
    const panel=new THREE.Shape();
    panel.moveTo(-w/2,a);panel.lineTo(w/2,a);panel.lineTo(w/2,y);panel.lineTo(-w/2,y);panel.closePath();
    for(const op of entries){const hole=new THREE.Path();contour(hole,op);panel.holes.push(hole);}
    mesh(extrusion(panel,depth),wall,0,0,-depth,g).name=through?'Open arcade brickwork':'Punched masonry facade';
    for(const op of entries){
      const {x,bottom,w,h,rise=0,door}=op,spring=h-rise;
      if(!through){
        const pane=new THREE.Shape();contour(pane,op);
        mesh(extrusion(pane,.006),door?'#526361':glass,0,0,-depth-.017,g).name='Recessed sash glazing';
        const transom=bottom+spring*(door?.74:.45);
        box(w,.012,.018,x,transom,-depth-.007,frame,g);
        for(const split of door?[-.33,0,.33]:[-.25,0,.25]){
          const cap=rise*Math.sqrt(1-(2*split)**2);
          box(.01,spring+cap,.018,x+w*split,bottom+(spring+cap)/2,-depth-.009,frame,g);
        }
        if(door){
          for(const side of [-1,1])box(.026,.008,.014,x+side*.016,bottom+.086,-depth+.004,'#b19c80',g);
        }
        g.updateWorldMatrix(true,false);
        const p=g.localToWorld(new THREE.Vector3(x,bottom+spring*.50,-depth-.010));
        windows.push({x:p.x,y:p.y,z:p.z,ry:g.rotation.y,w:w*.93,h:spring*.88});
      }
      box(w+.044,.023,.067,x,bottom-.005,.016,courses,g);
      if(rise&&hills){
        const crown=bottom+spring;
        for(let joint=0;joint<11;joint++){
          const start=joint*Math.PI/11+.016,end=(joint+1)*Math.PI/11-.016;
          const block=new THREE.Shape(),inside=w/2+.004,outside=inside+.038,outerRise=rise+.034;
          block.moveTo(x+inside*Math.cos(start),crown+rise*Math.sin(start));
          block.lineTo(x+outside*Math.cos(start),crown+outerRise*Math.sin(start));
          block.lineTo(x+outside*Math.cos(end),crown+outerRise*Math.sin(end));
          block.lineTo(x+inside*Math.cos(end),crown+rise*Math.sin(end));block.closePath();
          mesh(extrusion(block,.022),[courses,'#a8836b','#b18a70'][joint%3],0,0,.004,g);
        }
      }
    }
  }
  for(const [index,[x,z]] of ring.entries()){
    const [a,q]=ring[(index+1)%ring.length],length=Math.hypot(a-x,q-z);
    if(length<.015)continue;
    const normal=Math.sign(area),nx=normal*(q-z)/length,nz=normal*(x-a)/length;
    const g=new THREE.Group();g.position.set((x+a)/2,0,(z+q)/2);g.rotation.y=Math.atan2(nx,nz);root.add(g);
    g.updateWorldMatrix(true,false);
    function exposed(localX:number,w:number,y:number){
      return [-w/2,0,w/2].every(offset=>{
        const p=g.localToWorld(new THREE.Vector3(localX+offset,y,.026));
        return !near.some(peer=>y>=(peer.minH||0)&&y<peer.h&&insideBuilding(p.x,p.z,peer.p));
      });
    }
    const entries:Opening[]=[];
    if(hills&&plant&&length>.8){
      const bays=length>5?6:Math.max(1,Math.round(length/1.04)),spacing=length/bays;
      for(let bay=0;bay<bays;bay++){
        const pos=-length/2+(bay+.5)*spacing;
        if(exposed(pos,spacing*.65,.31))entries.push({x:pos,w:spacing*.68,bottom:.098,h:.38,rise:.114,door:bay===2||bay===4});
        for(const split of [-.23,.23])for(let floor=0;floor<4;floor++){
          const fx=pos+split*spacing,bottom=.537+floor*.202,w=spacing*.295;
          if(exposed(fx,w,bottom+.08))entries.push({x:fx,w,bottom,h:.143,rise:floor===3?.046:undefined});
        }
        box(.04,.845,.033,pos-spacing/2+.028,1.0,.018,'#a4816e',g);
      }
      for(const y of [.089,.497,1.373,h-.024])box(length+.019,.025,.052,0,y,.012,coping,g);
      for(let x=-length/2+.096;x<length/2-.045;x+=.137)box(.06,.047,.048,x,h-.074,.013,courses,g);
    }else if(hills){
      const bays=length>1.3?4:length>.61?2:0,spacing=length/Math.max(1,bays);
      for(let slot=0;slot<bays;slot++){
        const x=-length/2+(slot+.5)*spacing,w=spacing*.54,y=h-.35;
        if(exposed(x,w,y))entries.push({x,w,bottom:y,h:.241,rise:.056});
        box(.034,h-1.43,.043,x+spacing*.4,(h+1.25)/2,.016,courses,g);
      }
      box(length+.028,.047,.062,0,h-.026,.021,coping,g);
      box(length+.03,.028,.055,0,h-.081,.018,courses,g);
    }else if(length>.48&&profile){
      const floors=profile.floors,floorHeight=(h-base-.092)/floors;
      const bays=Math.max(1,Math.round(length/.43)),spacing=length/bays;
      for(let i=0;i<bays;i++){
        const fx=-length/2+(i+.5)*spacing,w=spacing*(i%3===0?.65:.77);
        for(let floor=0;floor<floors;floor++){
          const lobby=floor===0&&i===Math.floor(bays/2)&&length>1.10&&nz>.1;
          const bottom=base+floor*floorHeight+(floor===0?.095:.070);
          const tall=floorHeight*(lobby?.84:.66);
          if(!exposed(fx,w,bottom+tall/2))continue;
          entries.push({x:fx,w,bottom,h:tall,door:lobby});
          if(lobby){
            box(w+.11,.032,.20,fx,bottom+tall+.023,.073,'#aeb3a8',g);
            for(const side of [-1,1])box(.026,tall,.027,fx+side*w*.53,bottom+tall/2,.048,'#acafa3',g);
          }else if(floor>0&&(i+(b.id%2))%3===1){
            box(w+.041,.021,.12,fx,bottom-.017,.043,'#babeb2',g);
            box(w+.015,.048,.012,fx,bottom+.018,.095,'#7e9692',g);
          }
        }
        if(i%3===0&&exposed(fx+spacing*.43,.025,h*.62)){
          box(.028,h-.15,.039,fx+spacing*.42,h/2+.011,.013,coping,g);
        }
      }
      box(length+.012,.041,.057,0,h-.028,.012,coping,g);
      box(length,.018,.048,0,base+floorHeight+.061,.014,courses,g);
    }
    openings(g,length,base,h,entries);
  }
  if(plant){
    // The public arcade carries through the retaining wall to the terrace.
    const a=new THREE.Vector2(-37.85,-6.55),q=new THREE.Vector2(-35.19,-6.95);
    const length=a.distanceTo(q),g=new THREE.Group();g.name='Open Hills Plaza promenade arcade';
    g.position.set((a.x+q.x)/2,0,(a.y+q.y)/2);g.rotation.y=Math.atan2(a.y-q.y,q.x-a.x);root.add(g);
    const start=.115,top=.692,spacing=length/4;
    openings(g,length,.093,top,Array.from({length:4},(_,i)=>({x:-length/2+(i+.5)*spacing,w:spacing*.76,bottom:start,h:.496,rise:.16})),true);
    box(length+.046,.042,.19,0,top,.006,coping,g);
    box(length+.022,.026,.15,0,top-.062,.013,courses,g);
    box(length,.043,.30,0,.111,-.15,'#b2a58f',g);
    for(let i=0;i<4;i++){
      const x=-length/2+(i+.5)*spacing;
      for(let step=0;step<4;step++)box(spacing*.76,.021,.061,x,.101-step*.008,.030+step*.05,'#b6ad9b',g);
      if(i<3)box(.15,.07,.25,x+spacing/2,.121,.134,'#a3a18d',g);
    }
  }
  if(profile){
    const inset=ring.map(([x,z])=>[cx+(x-cx)*.33,cz+(z-cz)*.34]);
    mesh(footprintGeometry(inset,.103),'#9da492',0,h+.008,0,root);
  }
  return {root,windows};
}
