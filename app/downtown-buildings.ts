import * as THREE from 'three';
import observedRoofs from '../public/data/roof-finishes.json' with {type:'json'};
import survey from '../public/data/downtown-roofs.json' with {type:'json'};
import {surveyedRoofPitch,surveyedPitchGeometry} from './surveyed-roof-pitch.ts';
import {footprintGeometry} from './sf-map.ts';

type Building={id:number;p:number[][];h:number;measured:boolean;glass:boolean;parent?:number;part?:boolean;minH?:number};
type MeshFactory=(g:THREE.BufferGeometry,color:string,x:number,y:number,z:number)=>THREE.Mesh;
type RoofPlan=number[][][];
type RoofStep=[number,RoofPlan];
type Setback=[number,RoofPlan[]];
const setbacks=survey.setbacks as unknown as Record<string,Setback[]>;
const roofs:Record<string,[number,RoofStep[]]>=survey.roofs as unknown as Record<string,[number,RoofStep[]]>;
const profiles=survey.profiles as unknown as Record<string,[number,number,string,string]>;
const noProfile:[number,number,string,string]=[0,0,'',''];

function roofPrism([outer,...holes]:RoofPlan,height:number){
  const ring=(points:number[][])=>points.map(([x,z])=>new THREE.Vector2(x,-z));
  const outline=new THREE.Shape(ring(outer));
  for(const hole of holes)outline.holes.push(new THREE.Path(ring(hole)));
  return new THREE.ExtrudeGeometry(outline,{depth:height,bevelEnabled:false}).rotateX(-Math.PI/2);
}

// The older backdrop used one small detached plane per selected window and
// stopped adding panes below a height/distance threshold. Each real wall now
// receives facade coordinates; a pixel covering several bays sees their mean.
export function downtownBuilding(mesh:MeshFactory,b:Building,nominal:number,hasParts:boolean,framedWall?:string){
  const [year,recordedFloors,use,cladding]=profiles[b.id]??noProfile;
  const scan=roofs[b.id],bottom=b.minH||0;
  const compatible=!framedWall&&scan&&scan[0]>bottom+.10&&(!b.measured&&!hasParts&&!b.part||
    Math.abs(scan[0]-nominal)<Math.max(.19,.19*nominal));
  const layers=compatible&&!hasParts&&!b.part&&bottom===0?setbacks[b.id]:undefined;
  const pitch=!layers?.length&&!framedWall&&!hasParts&&!b.part?surveyedRoofPitch(b,nominal):undefined;
  const top=pitch?.eave??(compatible?scan[0]:nominal);
  const height=top-bottom;
  if(height<=.025)return;
  // Preserve the original low seven bits for both the daylight seed and old grids.
  const parcelUse=use||profiles[b.parent??b.id]?.[2];
  const occupancy=parcelUse==='RESIDENT'||parcelUse==='MIXRES'?1:parcelUse==='MIPS'?2:parcelUse==='PDR'?3:0;
  const facadeKey=occupancy*128+Math.abs(b.id)%89;
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
  const observed=compatible&&!hasParts&&!b.part?(observedRoofs.finishes as Record<string,string>)[b.id]:undefined;
  const faceColor=new THREE.Color(color),roofColor=new THREE.Color(observed??(warehouse?'#b2ac9b':early?'#aca99b':'#b1b5af'));
  const bay=warehouse?.36:early?.18:glazed?.115:home?.21:.23;
  function drawSection(geo:THREE.BufferGeometry,layerBase:number){
    const positions=geo.getAttribute('position'),normals=geo.getAttribute('normal');
    const grid=new Float32Array(positions.count*4),colors=new Float32Array(positions.count*3);
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
        const along=positions.getX(i)*nz-positions.getZ(i)*nx,up=(positions.getY(i)+layerBase-bottom)/height*floors;
        grid.set([(along-low)/Math.max(width,.00001)*count,up,width>.075&&height>.14?style:-1,facadeKey],i*4);
        faceColor.toArray(colors,i*3);
      }
    }
    geo.setAttribute('facadeGrid',new THREE.BufferAttribute(grid,4));
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.userData.paintVertices=true;
    mesh(geo,'#ffffff',0,layerBase,0).name='Mapped downtown facade '+b.id;
  }
  if(layers?.length){
    drawSection(footprintGeometry(b.p,layers[0][0]-bottom),bottom);
    for(let i=0;i<layers.length;i++){
      const [base,plans]=layers[i],upper=layers[i+1]?.[0]??top;
      for(const plan of plans)drawSection(roofPrism(plan,upper-base),base);
    }
  }else drawSection(footprintGeometry(b.p,height),bottom);
  // No fixtures are invented for an unsampled roof. Children already supplying
  // a mapped superstructure also take precedence over the point-cloud contours.
  if(pitch){
    mesh(surveyedPitchGeometry(b.p,pitch,faceColor,roofColor),'#ffffff',0,0,0).name='Surveyed pitched roof '+b.id;
    return;
  }
  // At 555 California the surveyed upper terrace is already the independently
  // mapped tower part 1243267628, including its serrated granite perimeter.
  if(!compatible||hasParts||b.id===1244283836)return;
  for(const [rise,rings] of scan[1]){
    mesh(roofPrism(rings,rise),early?'#aeab9a':'#a5ada9',0,top,0).name='LiDAR roof terrace '+b.id;
  }
}

export function createFacadeClock(){
  const night={value:0},quiet={value:0},litShare={value:0},glassSky={value:new THREE.Color(0x9fb6c9)};
  let lastMinute=-1;
  return {night,quiet,litShare,glassSky,setFacadeClock(hours:number,minutes:number,darkness:number,share=darkness*.30){
    litShare.value=share;
    night.value=darkness;
    const minute=hours*60+minutes;
    if(minute===lastMinute)return;
    lastMinute=minute;
    const h=hours+minutes/60+(hours<12?24:0);
    quiet.value=THREE.MathUtils.smoothstep(h,21,25)*(1-THREE.MathUtils.smoothstep(h,29,32));
  }};
}
type FacadeClock=ReturnType<typeof createFacadeClock>;

/** Rebind after copying the source material's complete shader chain into a vignette. */
export function bindFacadeClock(material:THREE.Material,clock:FacadeClock){
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.glassSky=clock.glassSky;
    shader.uniforms.roomShare=clock.litShare;
    shader.uniforms.roomNight=clock.night;
    shader.uniforms.roomQuiet=clock.quiet;
  };
}

export function applyDowntownGlazing(material:THREE.MeshStandardMaterial,clock:FacadeClock){
  material.userData.surveyedDowntownGlazing=true;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute vec4 facadeGrid; varying vec4 buildingGrid;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbuildingGrid=facadeGrid;');
    shader.fragmentShader=`varying vec4 buildingGrid;
      uniform vec3 glassSky; uniform float roomNight,roomQuiet,roomShare;
      float facadeHash(vec2 cell,float seed){
        vec3 p=fract(vec3(cell.x,cell.y,seed)*vec3(.1031,.1030,.0973));
        p+=dot(p,p.yzx+33.33);
        return fract((p.x+p.y)*p.z);
      }
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 roomEmission=vec3(0.);
      if(buildingGrid.z< -1.5){
        // Half-lap brick. Filter in unwrapped course coordinates so the
        // stagger itself cannot inflate derivatives at a horizontal joint.
        vec2 uv=buildingGrid.xy,aa=max(fwidth(uv),vec2(.0001));
        vec2 cell=fract(uv+vec2(.5*mod(floor(uv.y),2.),0.));
        vec2 edge=min(cell,1.-cell);
        vec2 seam=1.-smoothstep(vec2(.023,.062)-.5*aa,vec2(.023,.062)+.5*aa,edge);
        float joint=max(seam.x,seam.y);
        float detail=1.-smoothstep(.32,.90,max(aa.x,aa.y));
        diffuseColor.rgb*=1.+detail*.32*(joint-.165);
      }else if(buildingGrid.z>-.5){
        vec2 uv=buildingGrid.xy,cell=fract(uv)-.5,aa=max(fwidth(uv),vec2(.0001));
        bool early=buildingGrid.z==1.,glass=buildingGrid.z==2.,loft=buildingGrid.z==3.;
        vec2 opening=glass?vec2(.467,.369):early?vec2(.291,.338):loft?vec2(.384,.294):vec2(.289,.308);
        vec2 mask=1.-smoothstep(opening-aa*.5,opening+aa*.5,abs(cell));
        float lod=smoothstep(.27,1.,max(aa.x,aa.y));
        float pane=mix(mask.x*mask.y,4.*opening.x*opening.y,lod);
        float visibility=1.-.75*smoothstep(70.,120.,length(vViewPosition));
        pane*=visibility;
        float bar=(1.-smoothstep(.017-aa.x*.5,.017+aa.x*.5,abs(cell.x)));
        float transom=1.-smoothstep(.018-aa.y*.5,.018+aa.y*.5,abs(cell.y-.14));
        float frame=max(bar,transom*(loft||early?1.:.28))*(1.-lod);
        vec3 wall=diffuseColor.rgb;
        float kind=floor((buildingGrid.w+.25)/128.);
        float seed=buildingGrid.w-kind*128.;
        float id=fract(sin(dot(floor(uv)+seed,vec2(39.23,57.87)))*4375.15);
        float daylight=mix(.80+.28*id,.94,lod);
        vec3 glassColor=mix(glassSky,wall,glass?.07:.14)*daylight;
        float reveal=(1.-smoothstep(0.,.073+aa.y,opening.y-cell.y))*(1.-lod);
        glassColor*=1.-.20*reveal;
        diffuseColor.rgb=mix(wall,mix(glassColor,wall*.77,frame),pane);
        if(roomShare>.0001){
          bool home=kind==1.,office=kind==2.,warehouse=kind==3.;
          float bays=office?5.:home?2.:1.;
          float course=floor(uv.y);
          float suite=facadeHash(vec2(floor((uv.x+mod(seed+course,3.))/bays),course),seed+1.);
          float probability=home?mix(.44,.13,roomQuiet):office?mix(.22,.045,roomQuiet):
            warehouse?mix(.085,.025,roomQuiet):mix(.24,.085,roomQuiet);
          probability=clamp(probability*(roomShare/.30),0.,.85);
          float spread=smoothstep(.30,1.15,max(aa.x/bays,aa.y));
          float on=mix(smoothstep(1.-probability-.025,1.-probability+.025,suite),probability,spread);
          if(office){
            // Entire working floors persist farther away than individual glazed suites.
            float floorChance=mix(.28,.035,roomQuiet)*smoothstep(.24,.26,roomShare);
            float floorId=facadeHash(vec2(course,11.),seed+7.);
            float occupied=mix(smoothstep(1.-floorChance-.025,1.-floorChance+.025,floorId),
              floorChance,smoothstep(.30,1.15,aa.y));
            on=occupied+(1.-occupied)*on;
          }
          vec3 warm=vec3(1.,.552,.184),cool=vec3(.738,.815,1.);
          float tint=mix(step(.72,facadeHash(vec2(floor(uv.x/5.),floor(course/2.)),seed+17.)),.28,spread);
          float blinds=mix(.64+.36*id,.82,lod);
          vec3 source=mix(warm,cool,tint)*on*blinds;
          roomEmission=source*pane*(1.-frame);
          // The opaque jamb, sill and glazing bars share the room's actual
          // occupancy, blind and colour. The wall between bays stays dark.
          vec2 gap=max(abs(cell)-opening,vec2(0.));
          float below=1.-step(0.,cell.y);
          vec2 reach=vec2(.074,mix(.055,.13,below));
          float surround=(1.-smoothstep(0.,1.,length(gap/reach)))*(1.-pane);
          float receive=surround*mix(.12,.23,below)+pane*frame*.12;
          // Below one pixel, preserve the mean light on the two jambs, the
          // shorter head and the wider sill, using the same filtered room.
          float meanReceive=.5*(4.*opening.y*.074*.12+2.*opening.x*(.055*.12+.13*.23));
          roomEmission+=source*wall*mix(receive,meanReceive,lod)*visibility*smoothstep(0.,.22,roomNight);
        }
      }`).replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=roomEmission;');
  };
  bindFacadeClock(material,clock);
  material.customProgramCacheKey=()=> 'measured-downtown-facades-v5';
}
