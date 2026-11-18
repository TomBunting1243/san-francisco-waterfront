import * as THREE from 'three';
import survey from '../public/data/downtown-roofs.json' with {type:'json'};
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][];h:number;measured:boolean;glass:boolean;parent?:number;part?:boolean;minH?:number};
type MeshFactory=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type RoofStep=[number,number[][][]];
const roofs:Record<string,[number,RoofStep[]]>=survey.roofs as unknown as Record<string,[number,RoofStep[]]>;
const profiles=survey.profiles as unknown as Record<string,[number,number,string,string]>;
const noProfile:[number,number,string,string]=[0,0,'',''];

// The older backdrop used one small detached plane per selected window and
// stopped adding panes below a height/distance threshold. Each real wall now
// receives facade coordinates; a pixel covering several bays sees their mean.
export function downtownBuilding(mesh:MeshFactory,b:Building,nominal:number,hasParts:boolean,framedWall?:string){
  const [year,recordedFloors,use,cladding]=profiles[b.id]??noProfile;
  const scan=roofs[b.id],bottom=b.minH||0;
  const compatible=!framedWall&&scan&&scan[0]>bottom+.10&&(!b.measured&&!hasParts&&!b.part||
    Math.abs(scan[0]-nominal)<Math.max(.19,.19*nominal));
  const top=compatible?scan[0]:nominal;
  const height=top-bottom;
  if(height<=.025)return;
  const warehouse=use==='PDR';
  const early=year>0&&year<1946;
  const glazed=!!framedWall||b.glass||cladding==='glass'||(!early&&!warehouse&&use==='MIPS'&&top>2.6);
  const home=use==='RESIDENT'||use==='MIXRES';
  const style=warehouse?3:early?1:glazed?2:home?4:0;
  const typical=warehouse?.30:early?.208:glazed?.225:.194;
  const recordedPitch=recordedFloors?height/recordedFloors:0;
  const floors=!hasParts&&!b.part&&recordedPitch>.135&&recordedPitch<.43?recordedFloors:Math.max(1,Math.round(height/typical));
  const stone=['#c9bda6','#bbae9a','#b7ada0','#c4baac'],loft=['#ac8976','#b9927b','#af9f83','#b3a491'];
  const glass=['#7e9395','#869b9e','#809197','#8e9d9e'],stucco=['#c5bca8','#cac1ae','#b9bdaf','#b9b3a8'];
  const palette=warehouse||cladding==='brick'?loft:early?stone:glazed?glass:stucco;
  const color=framedWall??palette[Math.abs(b.id)%palette.length];
  const geo=footprintGeometry(b.p,height),positions=geo.getAttribute('position'),normals=geo.getAttribute('normal');
  const grid=new Float32Array(positions.count*4),colors=new Float32Array(positions.count*3);
  const faceColor=new THREE.Color(color),roofColor=new THREE.Color(warehouse?'#b2ac9b':early?'#aca99b':'#b1b5af');
  const bay=warehouse?.36:early?.18:glazed?.115:home?.21:.23;
  // ExtrudeGeometry emits two triangles per straight wall. Normalize each
  // edge independently so its first and last openings both have a full jamb.
  for(let i=0;i<positions.count;){
    if(Math.abs(normals.getY(i))>.5){
      roofColor.toArray(colors,i*3);grid[i*4+2]=-1;i++;continue;
    }
    const start=i,end=Math.min(i+6,positions.count),nx=normals.getX(i),nz=normals.getZ(i);
    let low=Infinity,high=-Infinity;
    for(let k=start;k<end;k++){
      const along=positions.getX(k)*nz-positions.getZ(k)*nx;
      low=Math.min(low,along);high=Math.max(high,along);
    }
    const width=high-low,count=Math.max(1,Math.round(width/bay));
    for(;i<end;i++){
      const along=positions.getX(i)*nz-positions.getZ(i)*nx,up=positions.getY(i)/height*floors;
      grid.set([(along-low)/Math.max(width,.00001)*count,up,width>.075&&height>.14?style:-1,Math.abs(b.id)%89],i*4);
      faceColor.toArray(colors,i*3);
    }
  }
  geo.setAttribute('facadeGrid',new THREE.BufferAttribute(grid,4));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.userData.paintVertices=true;
  mesh(geo,'#ffffff',0,bottom,0).name='Mapped downtown facade '+b.id;
  // No fixtures are invented for an unsampled roof. Children already supplying
  // a mapped superstructure also take precedence over the point-cloud contours.
  if(!compatible||hasParts)return;
  for(const [rise,[outer,...holes]] of scan[1]){
    const outline=new THREE.Shape(outer.map(([x,z])=>new THREE.Vector2(x,-z)));
    for(const hole of holes)outline.holes.push(new THREE.Path(hole.map(([x,z])=>new THREE.Vector2(x,-z))));
    const raised=new THREE.ExtrudeGeometry(outline,{depth:rise,bevelEnabled:false});
    raised.rotateX(-Math.PI/2);
    mesh(raised,early?'#aeab9a':'#a5ada9',0,top,0).name='LiDAR roof terrace '+b.id;
  }
}

export function applyDowntownGlazing(material:THREE.MeshStandardMaterial,night:{value:number}){
  material.onBeforeCompile=shader=>{
    shader.uniforms.roomNight=night;
    shader.vertexShader='attribute vec4 facadeGrid; varying vec4 buildingGrid;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbuildingGrid=facadeGrid;');
    shader.fragmentShader='varying vec4 buildingGrid; uniform float roomNight;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float roomLight=0.;
      if(buildingGrid.z>-.5){
        vec2 uv=buildingGrid.xy,cell=fract(uv)-.5,aa=max(fwidth(uv),vec2(.0001));
        bool early=buildingGrid.z==1.,glass=buildingGrid.z==2.,loft=buildingGrid.z==3.;
        vec2 opening=glass?vec2(.467,.369):early?vec2(.291,.338):loft?vec2(.384,.294):vec2(.289,.308);
        vec2 mask=1.-smoothstep(opening-aa*.5,opening+aa*.5,abs(cell));
        float lod=smoothstep(.27,1.,max(aa.x,aa.y));
        float pane=mix(mask.x*mask.y,4.*opening.x*opening.y,lod);
        float bar=(1.-smoothstep(.017-aa.x*.5,.017+aa.x*.5,abs(cell.x)));
        float transom=1.-smoothstep(.018-aa.y*.5,.018+aa.y*.5,abs(cell.y-.14));
        float frame=max(bar,transom*(loft||early?1.:.28))*(1.-lod);
        vec3 wall=diffuseColor.rgb;
        float id=fract(sin(dot(floor(uv)+buildingGrid.w,vec2(39.23,57.87)))*4375.15);
        float daylight=mix(.80+.28*id,.94,lod);
        vec3 glassColor=mix(vec3(.097,.165,.174),wall*.59,glass?.61:.27)*daylight;
        float reveal=(1.-smoothstep(0.,.073+aa.y,opening.y-cell.y))*(1.-lod);
        glassColor*=1.-.20*reveal;
        diffuseColor.rgb=mix(wall,mix(glassColor,wall*.77,frame),pane);
        roomLight=roomNight*pane*(1.-frame)*mix(smoothstep(.70,.88,id),.20,lod);
      }`).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.22,.145,.068)*roomLight;');
  };
  material.customProgramCacheKey=()=> 'measured-downtown-facades-v1';
}
