import * as THREE from 'three';

type Station = readonly [longitude: number, latitude: number, boomDegrees: number, series?: 'giant' | 'low-profile'];
type Wharf = { name: string; offshore: number; reach: number; hinge: number; apex: number;
  gauge: number; stations: Station[] };

// WGS84 quay-face stations, measured along the rails in USDA's 2022 California NAIP
// imagery (gis.wildlife.ca.gov/images/rest/services/Base_Remote_Sensing/NAIP_2022)
// and projected onto NOAA CUSP N35W125. Bearings point out to the fairway.
// Reaches are measured from the wharf face. The Port's 2021 facilities schedule
// and its March/October 2021 crane reports distinguish the different generations.
// Mobile crane assignments and boom angles represent a single feasible arrangement.
export const oaklandWharves: Wharf[] = [
  { name:'Ben E. Nutter', offshore:325.5, reach:60.8, hinge:52, apex:78, gauge:30.5,
    stations:[[-122.341962,37.806135,72],[-122.339447,37.807507,68],
      [-122.336880,37.808905,3],[-122.336551,37.809081,76,'giant']] },
  { name:'TraPac west', offshore:7, reach:53, hinge:49, apex:72, gauge:30.5,
    stations:[[-122.332952,37.811017,1],[-122.328848,37.810623,78],
      [-122.326898,37.810433,82],[-122.324548,37.810213,76]] },
  { name:'TraPac north', offshore:309.7, reach:58, hinge:51, apex:76, gauge:30.5,
    stations:[[-122.322220,37.810756,1],[-122.321238,37.811692,2],[-122.320449,37.812439,0]] },
  { name:'Outer Harbor', offshore:309.7, reach:45, hinge:40, apex:60, gauge:24,
    stations:[[-122.314895,37.817724,0],[-122.314551,37.818051,2],[-122.313863,37.818706,45]] },
  { name:'Oakland International', offshore:198, reach:60.8, hinge:52, apex:78, gauge:30.5,
    stations:[[-122.325043,37.798718,0],[-122.320078,37.797445,0],[-122.319275,37.797240,1],
      [-122.318925,37.797149,0],[-122.318134,37.796943,2],[-122.310700,37.795035,0,'giant'],
      [-122.308844,37.794559,0,'giant'],[-122.308493,37.794469,0,'giant'],[-122.307239,37.794148,0],
      [-122.306486,37.793955,0]] },
  { name:'Matson', offshore:182.6, reach:46.3, hinge:41, apex:63, gauge:25,
    stations:[[-122.298851,37.793479,78],[-122.298501,37.793466,80],
      [-122.296701,37.793403,0],[-122.296251,37.793387,0]] },
  // The City's Howard Terminal architectural resources memorandum records three
  // articulated booms and the older PACECO X-422 with a landward retracting truss.
  { name:'Howard', offshore:183, reach:39, hinge:38, apex:57, gauge:30.48,
    stations:[[-122.287810,37.794944,0,'low-profile'],[-122.287540,37.794928,60],
      [-122.287222,37.794915,58],[-122.286702,37.794895,62]] },
];

// Coordinates below are meters relative to the quay edge: alongshore, elevation,
// then seaward. A front rail set 5 m inside the edge leaves the bogies on land.
type Project = (lng: number, lat: number) => [number, number];
type Ground = (x:number,z:number) => number;
const bone = new THREE.Color('#d5d6cf'), green = new THREE.Color('#488f75');
const machine = new THREE.Color('#c5cac5'), bogie = new THREE.Color('#626860');
const safety = new THREE.Color('#bb8954'), cable = new THREE.Color('#919b98');

export function oaklandContainerCranes(project:Project, ground:Ground, material:THREE.Material) {
  const placements: THREE.Matrix4[] = [], paints: THREE.Color[] = [];
  for (const wharf of oaklandWharves) for (const [lon,lat,angle,series] of wharf.stations) {
    const [x,z] = project(lon,lat);
    const heading = THREE.MathUtils.degToRad(wharf.offshore);
    const [nx,nz] = project(lon + Math.sin(heading)/(111320*Math.cos(THREE.MathUtils.degToRad(lat))),
                            lat + Math.cos(heading)/111320);
    const sea = new THREE.Vector3(nx-x,0,nz-z);
    const scale = sea.length(), along = new THREE.Vector3(sea.z,0,-sea.x);
    const front = -5, back = front-wharf.gauge;
    const point = (u:number, y:number, v:number) =>
      new THREE.Vector3(x+along.x*u+sea.x*v, y*scale, z+along.z*u+sea.z*v);
    const feet = [-9,9].flatMap(u => [front,back].map(v => {
      const p = point(u,0,v);
      return {u,v,level:ground(p.x,p.z)};
    }));
    const datum = Math.max(...feet.map(foot=>foot.level));
    const paint = wharf.name === 'Ben E. Nutter' ? green : bone;
    const giant = series === 'giant';
    const largeSSA = giant && wharf.name === 'Oakland International';
    const hinge = largeSSA ? 62 : giant ? 60 : wharf.hinge;
    const apex = largeSSA ? 91.7 : giant ? 85 : wharf.apex;
    const length = (largeSSA ? 68.6 : wharf.reach)-front;
    const radians = THREE.MathUtils.degToRad(angle);
    const arm = (t:number) => front + t*length*Math.cos(radians);
    const rise = (t:number) => hinge + t*length*Math.sin(radians);
    // Keep the box's broad axis along the rail for the paired girders and machinery.
    const bar = (a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number,color=paint) => {
      const axis = b.clone().sub(a), height = axis.length();
      axis.normalize();
      const horizontal = along.clone().normalize();
      if (Math.abs(horizontal.dot(axis))>.98) horizontal.copy(sea).normalize();
      const side = horizontal.cross(axis).normalize();
      const basis = new THREE.Matrix4().makeBasis(axis.clone().cross(side),axis,side);
      basis.scale(new THREE.Vector3(width*scale,height,depth*scale));
      const center = a.add(b).multiplyScalar(.5);
      basis.setPosition(center.x,center.y+datum,center.z);
      placements.push(basis); paints.push(color);
    };
    for(const {u,v,level} of feet) {
      const y = (level-datum)/scale;
      bar(point(u-2.8,y+.8,v),point(u+2.8,y+.8,v),1.9,1.6,bogie);
      bar(point(u,y+1.4,v),point(u*.84,hinge*.51,v),2.5,2.5);
      bar(point(u*.84,hinge*.51,v),point(u*.43,hinge,v),2.3,2.4);
    }
    for (const v of [front,back]) {
      bar(point(-7.6,hinge*.51,v),point(7.6,hinge*.51,v),2.3,3);
      bar(point(-4,hinge,v),point(4,hinge,v),2.4,2.9);
    }
    if (series === 'low-profile') {
      // X-422 travels the boom horizontally beneath the headframe. Its rail
      // gauge and 30.5 m hook lift are the dimensions after its 1994 conversion.
      for (const u of [-4,4]) {
        for (const y of [hinge,hinge+5])
          bar(point(u,y,front+3),point(u,y,back-34),1.5,1.8);
        for (let i=0;i<7;i++) {
          const v = front+3-i*9.5;
          bar(point(u,hinge+i%2*5,v),point(u,hinge+(1-i%2)*5,v-9.5),.8,.8);
        }
      }
      bar(point(0,hinge+2,back-25),point(0,hinge+2,back-11),10,6,machine);
      continue;
    }
    for (const u of [-4,4]) {
      bar(point(u,hinge,back-14),point(u,hinge,front),1.7,3.3);
      bar(point(u,hinge,back),point(u,apex,front-9),1.7,1.7);
      bar(point(u,hinge,front),point(u,apex,front-9),1.7,1.7);
      bar(point(u,apex,front-9),point(u,hinge,back-14),.72,.72,cable);
      bar(point(u,apex,front-9),point(u,rise(.68),arm(.68)),.78,.78,cable);
      bar(point(u,hinge,front),point(u,rise(1),arm(1)),1.35,2.35);
    }
    bar(point(-4,apex,front-9),point(4,apex,front-9),1.6,1.6);
    for (const t of [.36,.68,1])
      bar(point(-4,rise(t),arm(t)),point(4,rise(t),arm(t)),1.25,1.35);
    bar(point(0,hinge+3,back-13),point(0,hinge+3,back+4),10,5.6,machine);
    if(angle < 8) {
      const v = arm(.58);
      bar(point(0,rise(.58)-1,v),point(0,rise(.58)-12,v),.7,.75,cable);
      bar(point(-5.6,rise(.58)-12,v),point(5.6,rise(.58)-12,v),2,1.6,safety);
    }
  }
  const box = new THREE.BoxGeometry(1,1,1);
  const white = new Float32Array(box.attributes.position.count*3).fill(1);
  box.setAttribute('color',new THREE.BufferAttribute(white,3));
  const mesh = new THREE.InstancedMesh(box,material,placements.length);
  mesh.name = 'Port of Oakland ship-to-shore cranes';
  placements.forEach((matrix,i)=>{ mesh.setMatrixAt(i,matrix); mesh.setColorAt(i,paints[i]); });
  mesh.computeBoundingSphere();
  return mesh;
}
