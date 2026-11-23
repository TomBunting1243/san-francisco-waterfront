import {hillsArcade,hillsCourt,hillsAtrium,hillsPalomino,terraceDoors} from './hills-plaza.ts';
import * as THREE from 'three';
import {staticBoxes} from './static-boxes.ts';
import {center,footprintGeometry} from './sf-map.ts';
import {insideBuilding} from './building-character.ts';

type Building={id:number;name:string;p:number[][];h:number;minH?:number;part?:boolean;parent?:number;material?:string};
type Pane={x:number;y:number;z:number;ry:number;w:number;h:number;nightMinimum?:number};
type Opening={x:number;bottom:number;w:number;h:number;rise?:number;door?:boolean;nightMinimum?:number};

export const hillsParts=new Set([-157,944986473]);
const streetProfiles=new Map([
  ...([-158,-345,-346,-347,-348,-349,1487160484] as const).map(id=>[id,{
    name:id===-158?'2 Harrison rooftop penthouse':'345 Spear Street',
    floors:id===1487160484?9:id===-345?8:id===-349?3:id===-347?3:id===-348?2:1,wall:'#a88470',glazing:'#536c71'}] as const),
  [191861045,{name:'318 Spear Street',floors:8,wall:'#a3a79d',glazing:'#5e8081'}],
  [421816058,{name:'333 Main Street',floors:9,wall:'#b0b4a9',glazing:'#627d7b'}],
]);
export function hasShorelineFacade(b:Building){
  return hillsParts.has(b.id)||(b.id===1487160484||b.id<0)&&streetProfiles.has(b.id)||(!b.name&&!b.part&&!b.parent&&streetProfiles.has(b.id));
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
  const box=staticBoxes(mesh,root);
  const extrusion=(shape:THREE.Shape,d:number)=>new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false,curveSegments:12});
  const closed=b.p[0][0]===b.p.at(-1)![0]&&b.p[0][1]===b.p.at(-1)![1];
  const ring=closed?b.p.slice(0,-1):b.p;
  const area=ring.reduce((sum,[x,z],i)=>{const [a,q]=ring[(i+1)%ring.length];return sum+x*q-z*a;},0);
  const [cx,cz]=center(ring);
  const near=neighbors.filter(peer=>peer.id!==b.id&&peer.p.some(([x,z])=>Math.abs(x-cx)<11&&Math.abs(z-cz)<11));
  // SF Planning 2011.0417A, deck section: 42 inches below the brick parapet.
  // The horizontal gravel surface terminates inside the masonry; a full-depth
  // extrusion here used to put a second vertical face on the exterior brick.
  const flat=hills||b.id<0;
  const plan=new THREE.Shape(ring.map(([x,z])=>new THREE.Vector2(x,-z)));
  if(b.id===-345)plan.holes.push(new THREE.Path(hillsAtrium.map(([x,z])=>new THREE.Vector2(x,-z))));
  const roof=flat?new THREE.ShapeGeometry(plan).rotateX(-Math.PI/2):footprintGeometry(b.p,.064);
  const slab=mesh(roof,hills?'#8d8376':'#a5a28f',0,h-(flat?.064:.052),0,root);
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
        const sash=mesh(extrusion(pane,.006),door?'#526361':glass,0,0,-depth-.017,g);
        sash.name='Recessed sash glazing';
        // The curved portion above the instanced rectangular light is real sash.
        if(!plant&&op.nightMinimum)sash.userData.signLight=[.50,.39,.21];
        const transom=bottom+spring*(door?.74:.45);
        box(w-.003,.012,.014,x,transom,-depth+.001,frame,g);
        for(const split of door?[-.33,0,.33]:[-.25,0,.25]){
          const cap=rise*Math.sqrt(1-(2*split)**2);
          box(.01,spring+cap-.003,.012,x+w*split,bottom+(spring+cap)/2,-depth+.002,frame,g);
        }
        if(door){
          for(const side of [-1,1])box(.026,.008,.014,x+side*.016,bottom+.086,-depth+.004,'#b19c80',g);
        }
        g.updateWorldMatrix(true,false);
        const p=g.localToWorld(new THREE.Vector3(x,bottom+spring*.50,-depth-.010));
        windows.push({x:p.x,y:p.y,z:p.z,ry:g.rotation.y,w:w*.93,h:spring*.88,...(op.nightMinimum?{nightMinimum:op.nightMinimum}:{})});
      }
      if(!through&&!(door&&g.name==='Palomino terrace doorway'))box(w+.044,.023,.067,x,bottom-.005,.016,courses,g);
      if(rise&&hills){
        const crown=bottom+spring;
        for(let joint=0;joint<11;joint++){
          const start=joint*Math.PI/11+.016,end=(joint+1)*Math.PI/11-.016;
          const block=new THREE.Shape(),inside=w/2+.004,outside=inside+.038,outerRise=rise+.034;
          block.moveTo(x+inside*Math.cos(start),crown+rise*Math.sin(start));
          block.lineTo(x+outside*Math.cos(start),crown+outerRise*Math.sin(start));
          block.lineTo(x+outside*Math.cos(end),crown+outerRise*Math.sin(end));
          block.lineTo(x+inside*Math.cos(end),crown+rise*Math.sin(end));block.closePath();
          const stone=mesh(extrusion(block,.022),[courses,'#a8836b','#b18a70'][joint%3],0,0,.004,g);
          if(!plant&&op.nightMinimum)stone.userData.signLight=[.21,.17,.09];
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
      const bays=Math.max(1,Math.round(length/.49)),spacing=length/bays;
      for(let bay=0;bay<bays;bay++){
        const pos=-length/2+(bay+.5)*spacing;
        if(exposed(pos,spacing*.65,.31))entries.push({x:pos,w:spacing*.68,bottom:.098,h:.38,rise:.114,door:bay===2||bay===4});
        for(const split of [-.23,.23])for(let floor=0;floor<5;floor++){
          const fx=pos+split*spacing,bottom=.528+floor*.166,w=spacing*.295;
          // Angritt's night photograph and Jim Nix's blue-hour view show paired
          // occupied rooms under the sign, with gaps between their groups.
          const litPair=index===0&&(floor===2&&(bay===0||bay===1||bay===4)||floor===3&&(bay===1||bay===3));
          if(exposed(fx,w,bottom+.08))entries.push({x:fx,w,bottom,h:.127,rise:floor===4?.039:undefined,nightMinimum:litPair?.73:undefined});
        }
        box(.04,.845,.033,pos-spacing/2+.028,1.0,.018,'#a4816e',g);
      }
      for(const y of [.089,.497,1.373,h-.024])box(length+.019,.025,.052,0,y,.012,coping,g);
      for(let x=-length/2+.096;x<length/2-.045;x+=.137)box(.06,.047,.048,x,h-.074,.013,courses,g);
    }else if(hills){
      const bays=length>1.3?4:length>.61?2:0,spacing=length/Math.max(1,bays);
      for(let slot=0;slot<bays;slot++){
        const x=-length/2+(slot+.5)*spacing,w=spacing*.54,y=h-.35;
        if(exposed(x,w,y))entries.push({x,w,bottom:y,h:.241,rise:.056,nightMinimum:plant?undefined:.92});
        const spring=Math.max(base,1.43);
        box(.034,h-spring,.043,x+spacing*.4,(h+spring)/2,.016,courses,g);
      }
      box(length+.028,.047,.062,0,h-.026,.021,coping,g);
      box(length+.03,.028,.055,0,h-.081,.018,courses,g);
    }else if(length>.48&&profile){
      const patioDoor=b.id===-345&&terraceDoors.find(([dx,dz])=>Math.hypot(dx-g.position.x,dz-g.position.z)<.065);
      const floors=profile.floors,floorHeight=(h-base-.092)/floors;
      const bays=Math.max(1,Math.round(length/.43)),spacing=length/bays;
      for(let i=0;i<bays;i++){
        const fx=-length/2+(i+.5)*spacing,w=spacing*(i%3===0?.65:.77);
        for(let floor=patioDoor?2:0;floor<floors;floor++){
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
          const lower=patioDoor ? .336 : .086,upper=h-.064;
          box(.028,upper-lower,.039,fx+spacing*.42,(upper+lower)/2,.013,coping,g);
        }
      }
      box(length+.012,.041,.057,0,h-.028,.012,coping,g);
      const belt=patioDoor ? .336 : base+floorHeight+.061;
      box(length,.018,.048,0,belt,.014,courses,g);
      if(patioDoor){
        const localDoor=g.worldToLocal(new THREE.Vector3(patioDoor[0],0,patioDoor[1])).x;
        g.name='Palomino terrace doorway';
        entries.push({x:localDoor,bottom:hillsPalomino.y+.003,w:.112,h:.143,door:true});
        for(const side of [-1,1]){
          entries.push({x:localDoor+side*.164,bottom:hillsPalomino.y+.025,w:.156,h:.121});
        }
      }
    }
    openings(g,length,base,h,entries);
  }
  if(plant){
    // The public arcade carries through the retaining wall to the terrace.
    const [a,q]=hillsArcade.map(([x,z])=>new THREE.Vector2(x,z));
    const length=a.distanceTo(q),g=new THREE.Group();g.name='Open Hills Plaza promenade arcade';
    g.position.set((a.x+q.x)/2,0,(a.y+q.y)/2);g.rotation.y=Math.atan2(a.y-q.y,q.x-a.x);root.add(g);
    const bays=6,spacing=length/bays,start=hillsPalomino.y,top=.518;
    openings(g,length,.044,top,Array.from({length:bays},(_,i)=>({x:-length/2+(i+.5)*spacing,w:spacing*.77,bottom:start,h:.319,rise:.14})),true);
    box(length+.024,.023,.30,0,top+.0115,-.145,coping,g);
    box(length,.016,.025,0,top-.028,.010,courses,g);
    const circle=[-43.338,-5.431],radius=.526;
    const pavement=new THREE.Shape(hillsCourt.map(([x,z])=>new THREE.Vector2(x,-z)));
    const inset=new THREE.Path();inset.absarc(circle[0],-circle[1],radius,0,Math.PI*2,false);pavement.holes.push(inset);
    const court=mesh(extrusion(pavement,start-.044).rotateX(-Math.PI/2),'#b6a18c',0,.044,0,root);
    court.name='Hills Plaza public passage';
    // Inset, adjoining bands use the same angular samples as the cut in the paving.
    for(const [inner,outer,tint] of [[0,.215,'#a89583'],[.215,.229,'#d2c5ae'],[.229,.448,'#bdaa98'],[.448,.465,'#d2c5ae'],[.465,radius,'#b9ab98']] as const){
      mesh(new THREE.RingGeometry(inner,outer,24).rotateX(-Math.PI/2),tint,circle[0],start,circle[1],root);
    }
    box(length,start-.044,.30,0,(start+.044)/2,-.15,'#b2a58f',g);
    for(let i=0;i<bays;i++){
      const x=-length/2+(i+.5)*spacing;
      for(let step=0;step<8;step++){
        const height=(start-.045)*(8-step)/8;
        box(spacing*.77,height,.021,x,.045+height/2,.0105+step*.021,'#b7ae9f',g);
      }
      if(i===bays-1)continue;
      const edge=x+spacing/2;
      box(spacing*.23,.095,.178,edge,.0925,.079,'#a69e90',g);
      const leaves=mesh(new THREE.IcosahedronGeometry(1,1),'#6d7953',edge,.149,.075,g);
      leaves.scale.set(spacing*.106,.027,.085);
    }
  }
  if(b.id===-345){
    const atriumBase=.44;
    mesh(footprintGeometry(hillsAtrium,.023),'#83989a',0,atriumBase,0,root).name='Sheltered 345 Spear atrium';
    for(let i=1;i<hillsAtrium.length;i++){
      const [x,z]=hillsAtrium[i-1],[a,b]=hillsAtrium[i];
      const m=box(Math.hypot(a-x,b-z),h-.064-atriumBase,.016,(x+a)/2,(h-.064+atriumBase)/2,(z+b)/2,'#a18d7f',root);
      m.rotation.y=-Math.atan2(b-z,a-x);
    }
  }
  if(profile&&b.id>0&&b.id!==1487160484){
    const inset=ring.map(([x,z])=>[cx+(x-cx)*.33,cz+(z-cz)*.34]);
    mesh(footprintGeometry(inset,.103),'#9da492',0,h+.008,0,root);
  }
  return {root,windows};
}
