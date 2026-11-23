import * as THREE from 'three';

// Each row gives longitude and the south/north latitude of each carriageway,
// eastbound first. Sections sampled from OSM bridge envelopes 1000066963 and
// 1006027483, simplified within 0.65 m of latitude. At the tunnel and after
// the deck ends, 27 m road sections follow the two mapped motorway centerlines.
// https://www.openstreetmap.org/way/1000066963
// https://www.openstreetmap.org/way/1006027483
// https://www.openstreetmap.org/way/237735191 (T1)
const outlines = [
  [-122.3650410, 37.8099533, 37.8103229, 37.8100000, 37.8103691],
  [-122.3646410, 37.8103154, 37.8106897, 37.8103612, 37.8107392],
  [-122.3645410, 37.8105441, 37.8109084, 37.8105441, 37.8109084],
  [-122.3644410, 37.8104755, 37.8110014, 37.8104755, 37.8110014],
  [-122.3643410, 37.8105495, 37.8110944, 37.8105496, 37.8110944],
  [-122.3640410, 37.8108262, 37.8113733, 37.8108267, 37.8113733],
  [-122.3639410, 37.8109185, 37.8114439, 37.8109190, 37.8114790],
  [-122.3638410, 37.8110110, 37.8115419, 37.8110114, 37.8116144],
  [-122.3637410, 37.8111501, 37.8116400, 37.8111501, 37.8117832],
  [-122.3636410, 37.8112773, 37.8117381, 37.8112773, 37.8118901],
  [-122.3635410, 37.8113712, 37.8118207, 37.8113712, 37.8118211],
  [-122.3633410, 37.8115635, 37.8119433, 37.8115727, 37.8120418],
  [-122.3632410, 37.8116581, 37.8120146, 37.8116819, 37.8121522],
  [-122.3630410, 37.8118438, 37.8121894, 37.8119101, 37.8123732],
  [-122.3627410, 37.8121101, 37.8124506, 37.8122758, 37.8127043],
  [-122.3625410, 37.8122832, 37.8126148, 37.8125105, 37.8129165],
  [-122.3624410, 37.8121516, 37.8126945, 37.8126215, 37.8130184],
  [-122.3623410, 37.8122562, 37.8127735, 37.8127281, 37.8131176],
  [-122.3622410, 37.8123592, 37.8128517, 37.8128313, 37.8133175],
  [-122.3619410, 37.8126327, 37.8130779, 37.8131203, 37.8135457],
  [-122.3616410, 37.8128785, 37.8132955, 37.8133818, 37.8137554],
  [-122.3615410, 37.8129551, 37.8133660, 37.8134230, 37.8138226],
  [-122.3614410, 37.8130307, 37.8134554, 37.8135456, 37.8138892],
  [-122.3613410, 37.8131049, 37.8135024, 37.8136255, 37.8139577],
  [-122.3611410, 37.8132485, 37.8136330, 37.8137757, 37.8140969],
  [-122.3608410, 37.8134560, 37.8138238, 37.8139841, 37.8142975],
  [-122.3605410, 37.8136533, 37.8140068, 37.8141784, 37.8144809],
  [-122.3604410, 37.8137160, 37.8140655, 37.8142395, 37.8145696],
  [-122.3603410, 37.8137772, 37.8141235, 37.8142986, 37.8146216],
  [-122.3602410, 37.8138360, 37.8141814, 37.8143489, 37.8146608],
  [-122.3601410, 37.8138899, 37.8142545, 37.8144062, 37.8147411],
  [-122.3598410, 37.8140127, 37.8144261, 37.8145777, 37.8149126],
  [-122.3597410, 37.8140869, 37.8144832, 37.8146349, 37.8149697],
  [-122.3594410, 37.8142675, 37.8146548, 37.8148064, 37.8151412],
  [-122.3558410, 37.8163245, 37.8167128, 37.8168644, 37.8171993],
  [-122.3557410, 37.8163817, 37.8167700, 37.8169216, 37.8172442],
  [-122.3553410, 37.8166103, 37.8169986, 37.8171503, 37.8174743],
  [-122.3552410, 37.8166675, 37.8170559, 37.8172071, 37.8175657],
  [-122.3551410, 37.8167246, 37.8171127, 37.8172640, 37.8176223],
  [-122.3550410, 37.8167807, 37.8171695, 37.8173207, 37.8176653],
  [-122.3548410, 37.8168710, 37.8172825, 37.8174334, 37.8177444],
  [-122.3547410, 37.8169054, 37.8173386, 37.8174881, 37.8177871],
  [-122.3546410, 37.8169620, 37.8173935, 37.8175414, 37.8178391],
  [-122.3545410, 37.8170362, 37.8174461, 37.8176018, 37.8178894],
  [-122.3543410, 37.8171901, 37.8175433, 37.8177034, 37.8179872],
  [-122.3542410, 37.8172397, 37.8175931, 37.8177521, 37.8180345],
  [-122.3541410, 37.8173022, 37.8176421, 37.8178002, 37.8180810],
  [-122.3537410, 37.8174959, 37.8178267, 37.8179828, 37.8182578],
  [-122.3533410, 37.8176717, 37.8179977, 37.8181503, 37.8184209],
  [-122.3529410, 37.8178345, 37.8181540, 37.8183038, 37.8185691],
  [-122.3522410, 37.8180821, 37.8183927, 37.8185382, 37.8187974],
  [-122.3519410, 37.8181748, 37.8184823, 37.8186267, 37.8188830],
  [-122.3518410, 37.8182042, 37.8185104, 37.8186244, 37.8189101],
  [-122.3517410, 37.8182327, 37.8185382, 37.8186818, 37.8189366],
  [-122.3516410, 37.8182512, 37.8185653, 37.8187083, 37.8189621],
  [-122.3515410, 37.8182877, 37.8185913, 37.8187337, 37.8189871],
  [-122.3511410, 37.8183881, 37.8186887, 37.8188291, 37.8190803],
  [-122.3504410, 37.8185353, 37.8188311, 37.8189696, 37.8192166],
  [-122.3502410, 37.8185711, 37.8188652, 37.8190027, 37.8192491],
  [-122.3501410, 37.8185872, 37.8188811, 37.8189991, 37.8192649],
  [-122.3500410, 37.8186029, 37.8189262, 37.8190339, 37.8192797],
  [-122.3499410, 37.8185994, 37.8189115, 37.8190487, 37.8192947],
  [-122.3498410, 37.8186330, 37.8189261, 37.8190638, 37.8193098],
  [-122.3484410, 37.8188377, 37.8191308, 37.8192689, 37.8195146],
  [-122.3483410, 37.8188524, 37.8191454, 37.8192541, 37.8195292],
  [-122.3482410, 37.8188580, 37.8191601, 37.8192981, 37.8195438],
  [-122.3481410, 37.8188816, 37.8191747, 37.8193127, 37.8195584],
  [-122.3466410, 37.8191010, 37.8193940, 37.8195321, 37.8197777],
  [-122.3465410, 37.8191156, 37.8194381, 37.8195177, 37.8197924],
  [-122.3464410, 37.8191302, 37.8194233, 37.8195613, 37.8198070],
  [-122.3459410, 37.8192033, 37.8194964, 37.8196344, 37.8198801],
  [-122.3458410, 37.8192180, 37.8195111, 37.8196150, 37.8198947],
  [-122.3457410, 37.8192326, 37.8195257, 37.8196636, 37.8199093],
  [-122.3448410, 37.8193642, 37.8196573, 37.8197952, 37.8200409],
  [-122.3447410, 37.8193788, 37.8197019, 37.8197818, 37.8200555],
  [-122.3446410, 37.8193844, 37.8196865, 37.8198244, 37.8200701],
  [-122.3445410, 37.8194080, 37.8197012, 37.8198391, 37.8200848],
  [-122.3430410, 37.8196274, 37.8199205, 37.8200584, 37.8203041],
  [-122.3429410, 37.8196420, 37.8199639, 37.8200436, 37.8203187],
  [-122.3428410, 37.8196566, 37.8199497, 37.8200877, 37.8203333],
  [-122.3412410, 37.8198906, 37.8201838, 37.8203216, 37.8205672],
  [-122.3411410, 37.8199052, 37.8202279, 37.8203072, 37.8205818],
  [-122.3410410, 37.8199109, 37.8202130, 37.8203508, 37.8205964],
  [-122.3409410, 37.8199345, 37.8202277, 37.8203655, 37.8206111],
  [-122.3394410, 37.8201539, 37.8204471, 37.8205847, 37.8208304],
  [-122.3393410, 37.8201685, 37.8204908, 37.8205993, 37.8208450],
  [-122.3392410, 37.8201831, 37.8204762, 37.8206140, 37.8208596],
  [-122.3376410, 37.8204171, 37.8207102, 37.8208478, 37.8210935],
  [-122.3375410, 37.8204228, 37.8207536, 37.8208625, 37.8211081],
  [-122.3374410, 37.8204374, 37.8207395, 37.8208771, 37.8211228],
  [-122.3373410, 37.8204611, 37.8207541, 37.8208917, 37.8211374],
  [-122.3359410, 37.8206658, 37.8209590, 37.8210964, 37.8213421],
  [-122.3358410, 37.8206805, 37.8210023, 37.8211110, 37.8213567],
  [-122.3357410, 37.8206951, 37.8209881, 37.8211256, 37.8213713],
  [-122.3344410, 37.8208852, 37.8211783, 37.8213156, 37.8215614],
  [-122.3343410, 37.8208998, 37.8212216, 37.8213012, 37.8215760],
  [-122.3342410, 37.8209145, 37.8212075, 37.8213449, 37.8215906],
  [-122.3336410, 37.8210022, 37.8212953, 37.8214325, 37.8216779],
  [-122.3335410, 37.8209978, 37.8213094, 37.8214466, 37.8216920],
  [-122.3334410, 37.8210308, 37.8213234, 37.8214607, 37.8217062],
  [-122.3331410, 37.8210729, 37.8213657, 37.8215028, 37.8217482],
  [-122.3330410, 37.8210871, 37.8214098, 37.8214867, 37.8217617],
  [-122.3329410, 37.8211013, 37.8213939, 37.8215300, 37.8217750],
  [-122.3310410, 37.8213445, 37.8216358, 37.8217643, 37.8220082],
  [-122.3305410, 37.8214017, 37.8216924, 37.8218181, 37.8220618],
  [-122.3304410, 37.8214122, 37.8217345, 37.8217953, 37.8220722],
  [-122.3303410, 37.8214228, 37.8217136, 37.8218388, 37.8220824],
  [-122.3288410, 37.8215694, 37.8218594, 37.8219802, 37.8222231],
  [-122.3287410, 37.8215783, 37.8219012, 37.8219564, 37.8222314],
  [-122.3286410, 37.8215871, 37.8218769, 37.8219968, 37.8222397],
  [-122.3277410, 37.8216621, 37.8219502, 37.8220686, 37.8223122],
  [-122.3276410, 37.8217148, 37.8219585, 37.8220760, 37.8223197],
  [-122.3255270, 37.8218676, 37.8221111, 37.8222364, 37.8224800],
] as const;

type Project = (longitude:number, latitude:number) => [number,number];
type Section = { distance:number; center:THREE.Vector3; edges:THREE.Vector3[] };
const scale = .06;
const towerSurvey = [-122.35850585,37.8152652] as const;
const steel = '#d4d9d4', pavement = '#848b89', concrete = '#b8bab3', underside = '#8f9996';

// Caltrans general and structure plans, sheets 429/1204 and 431/1204.
// https://mtc.ca.gov/sites/default/files/Seismic_Evaluation_of_SAS-7-15-13-appendices.pdf
// https://files.mtc.ca.gov/library/pub/28860.pdf (chapter 1)
// https://asbi-assoc.org/project/san-francisco-oakland-bay-bridge-new-east-span-skyway-san-francisco-and-oakland-california/
export function distantEastSpan(project:Project, surface:number, material:THREE.Material) {
  const [tx,tz] = project(...towerSurvey);
  function planPoint(lon:number,lat:number) {
    const [x,z] = project(lon,lat);
    return new THREE.Vector3((x-tx)/scale,0,(z-tz)/scale);
  }
  const sections:Section[] = [];
  for (const [lon,...latitudes] of outlines) {
    const edges = latitudes.map(lat=>planPoint(lon,lat));
    const center = planPoint(lon,(latitudes[1]+latitudes[2])/2);
    const prev = sections.at(-1);
    sections.push({edges,center,distance:prev ? prev.distance+center.distanceTo(prev.center) : 0});
  }
  let closest = Infinity, towerStation = 0;
  for (let i=1;i<sections.length;i++) {
    const prev=sections[i-1],curr=sections[i], delta=curr.center.clone().sub(prev.center);
    const t=THREE.MathUtils.clamp(-prev.center.dot(delta)/delta.lengthSq(),0,1);
    const distance=prev.center.clone().addScaledVector(delta,t).lengthSq();
    if(distance<closest){closest=distance;towerStation=THREE.MathUtils.lerp(prev.distance,curr.distance,t);}
  }
  sections.forEach(s=>{s.distance-=towerStation;});
  const start=sections[0].distance,end=sections[sections.length-1].distance;
  function section(station:number) {
    const i=sections.findIndex((s,idx)=>idx>0 && s.distance>=station);
    const b=sections[i<0?sections.length-1:i],a=sections[i<0?sections.length-2:i-1];
    const t=THREE.MathUtils.clamp((station-a.distance)/(b.distance-a.distance),0,1);
    return {center:a.center.clone().lerp(b.center,t),edges:a.edges.map((p,j)=>p.clone().lerp(b.edges[j],t))};
  }
  const along=section(10).center.sub(section(-10).center).normalize();
  const across=section(0).edges[3].sub(section(0).edges[0]);
  across.addScaledVector(along,-across.dot(along)).normalize();
  const local=(s:number,h:number,n:number)=>along.clone().multiplyScalar(s).addScaledVector(across,n).setY(h);
  const fraction=(x:number,a:number,b:number)=>THREE.MathUtils.clamp((x-a)/(b-a),0,1);
  function height(station:number,westbound:boolean) {
    // Longitudinal profile read from design elevation; elevations other than
    // the labeled T1 top are approximate. Both decks emerge stacked at YBI.
    const knots=[[start,60],[-180,54],[0,54],[385,49.4],[2450,9],[2820,5],[end,4]];
    let i=1;
    while(i<knots.length-1 && station>knots[i][0])i++;
    const [a,b]=[knots[i-1],knots[i]];
    return THREE.MathUtils.lerp(a[1],b[1],fraction(station,a[0],b[0]))+(westbound?4:-4)*(1-fraction(station,-440,-180));
  }
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],roadway:number[]=[];
  const palette=new Map<string,THREE.Color>();
  function quad(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3,paint:string) {
    const offset=vertices.length/3, shade=palette.get(paint)??new THREE.Color(paint);palette.set(paint,shade);
    for(const p of [a,b,c,d]){vertices.push(tx+p.x*scale,surface+p.y*scale,tz+p.z*scale);colors.push(shade.r,shade.g,shade.b);roadway.push(paint===pavement?1:0);}
    indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  }
  // A closed member of rectangular section, including tapered pier heads and tower shafts.
  function member(a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number,paint:string,topWidth=width,topDepth=depth) {
    const axis=b.clone().sub(a).normalize(), ref=Math.abs(axis.y)>.9?along:new THREE.Vector3(0,1,0);
    const u=ref.clone().cross(axis).normalize(),v=axis.clone().cross(u);
    const ring=(p:THREE.Vector3,w:number,d:number)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>p.clone().addScaledVector(u,x*w/2).addScaledVector(v,y*d/2));
    const lo=ring(a,width,depth),hi=ring(b,topWidth,topDepth);
    for(let j=0;j<4;j++){const k=(j+1)%4;quad(lo[j],lo[k],hi[k],hi[j],paint);}
    quad(lo[3],lo[2],lo[1],lo[0],paint);quad(hi[0],hi[1],hi[2],hi[3],paint);
  }
  const elevated=(p:THREE.Vector3,y:number)=>p.clone().setY(y);
  for(let road=0;road<2;road++) {
    const offset=road*2;
    for(let i=1;i<sections.length;i++) {
      const a=sections[i-1],b=sections[i];
      const ring=(s:Section)=>{
        const l=s.edges[offset],r=s.edges[offset+1],h=height(s.distance,road===1);
        const depth=s.distance<385?5.1:Math.min(5.3,2+(end-s.distance)*.006);
        return [elevated(l,h),elevated(r,h),elevated(r,h-depth),elevated(l,h-depth)];
      };
      const lo=ring(a),hi=ring(b);
      // Wind the upper surface toward +Y for the regional front-sided material.
      for(let j=0;j<4;j++) {const k=(j+1)%4;quad(lo[j],hi[j],hi[k],lo[k],[pavement,concrete,underside,concrete][j]);}
    }
  }
  function bent(station:number) {
    const {edges}=section(station);
    for(let road=0;road<2;road++) {
      const c=edges[road*2].clone().lerp(edges[road*2+1],.5),h=height(station,road===1)-4;
      if(h<=1.1)continue;
      member(elevated(c,-1),elevated(c,h-1),6.5,7.5,concrete,8,8);
      member(elevated(c,h-2),elevated(c,h),8,8,concrete,19,8);
    }
  }
  // Pier centers scaled from the project limits elevation (E3–E17);
  // the shorter Oakland approach spans continue to the abutment.
  for(const station of [-550,-470,-395,-320,-180,385,548,705,868,1028,1188,1348,1508,1668,1828,1988,2148,2275,2385,2488,2570,2620,2670,2720,2770,2820])bent(station);
  member(local(0,-1,0),local(0,6,0),23,27,concrete);
  for(const s of [-1,1])for(const n of [-1,1])
    member(local(s*5.5,4,n*5.5),local(s*2.25,160,n*2.25),7.5,7.5,steel,4.15,4.15);
  member(local(0,156,0),local(0,160,0),8.6,8.6,steel);
  for(const h of [48,82,108,132,154]) {
    const spread=THREE.MathUtils.lerp(5.5,2.25,(h-4)/156);
    for(const sign of [-1,1]) {
      member(local(-spread,h,sign*spread),local(spread,h,sign*spread),2,2,steel);
      member(local(sign*spread,h,-spread),local(sign*spread,h,spread),2,2,steel);
    }
  }
  for(const sign of [-1,1]) {
    // The cable leaves the centered saddle and spreads to the exterior girders.
    // End widths are measured perpendicular to the alignment at each support.
    const road=sign<0?0:1;
    for(const [span,sag] of [[-180,5.5],[385,27]]) {
      const edge=section(span).edges[sign<0?0:3], outer=edge.dot(across)-sign*2;
      const cable=(t:number)=>local(span*t,THREE.MathUtils.lerp(158,height(span,road===1)+1,t)-4*sag*t*(1-t),
        THREE.MathUtils.lerp(sign*2.3,outer,t*(2-t)));
      const count=Math.ceil(Math.abs(span)/10);
      for(let i=1;i<=count;i++) {
        const t=i/count,top=cable(t);
        member(cable((i-1)/count),top,.82,.82,steel);
        if(i<count && top.y>height(span*t,road===1)+1) {
          const anchor=local(span*t,height(span*t,road===1),section(span*t).edges[sign<0?0:3].dot(across)-sign*2);
          member(anchor,top,.18,.18,steel);
        }
      }
    }
  }
  const west=section(-180);
  const westEdge=(i:number)=>local(-180,height(-180,i===3)+1,west.edges[i].dot(across)+(i===3?-2:2));
  member(westEdge(0),westEdge(3),.82,.82,steel);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
  geometry.setAttribute('eastRoadway',new THREE.Uint8BufferAttribute(roadway,1));
  // MTC's Lighting the East Span documents a continuous white roadway wash
  // from 1,121 fixtures. Both wearing surfaces receive it before aerial haze.
  // https://mtc.ca.gov/sites/default/files/SFOBB_lighting_fact_sheet.pdf
  const previous=material.onBeforeCompile.bind(material),programKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous(shader,renderer);
    if(!shader.uniforms.reliefNight)return;
    shader.vertexShader='attribute float eastRoadway; varying float eastDeck;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\neastDeck=eastRoadway;');
    shader.fragmentShader='varying float eastDeck;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=vec3(.080,.083,.081)*eastDeck*smoothstep(.12,.91,reliefNight);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=>programKey+'|eastern-road-led-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Eastern span from Yerba Buena Island to Oakland';
  return mesh;
}
