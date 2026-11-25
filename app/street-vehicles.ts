import * as THREE from 'three';

type Point = [x: number, y: number, z: number];
const paint = ['#b54f40','#ccab62','#507b85','#80798c','#7b9075','#c9c4b4'];
const profiles = [
  { name:'hatchback', length:4.06, width:1.78, wheelbase:2.53, tyre:.30, waist:.89, height:1.47,
    rearBelt:-1.75, frontBelt:.94, rearRoof:-1.46, frontRoof:.37, cabinWidth:.88 },
  { name:'sedan', length:4.74, width:1.85, wheelbase:2.77, tyre:.32, waist:.93, height:1.45,
    rearBelt:-1.56, frontBelt:1.12, rearRoof:-.94, frontRoof:.43, cabinWidth:.84 },
  { name:'station wagon', length:4.81, width:1.92, wheelbase:2.84, tyre:.33, waist:.99, height:1.59,
    rearBelt:-2.13, frontBelt:1.14, rearRoof:-1.82, frontRoof:.49, cabinWidth:.87 },
  { name:'delivery van', length:5.16, width:1.99, wheelbase:3.19, tyre:.34, waist:1.05, height:1.92,
    rearBelt:-2.34, frontBelt:1.54, rearRoof:-2.27, frontRoof:.91, cabinWidth:.92 },
];

// Street and bridge vehicles both apply .25, giving the map scale of .06 units/metre.
const metresToModel = .24;
const roadOffset = .055;
export const streetVehicleTreadHeight=roadOffset*.25;
// The front bumper projects 0.014 m beyond the body half length. Both traffic
// batches use quarter-scale meshes, yielding scene units here.
export const streetVehicleNose=(index:number)=>(profiles[index%profiles.length].length/2+.014)*metresToModel*.25;

class VehiclePaint {
  private readonly marks:number[]=[];
  private readonly glass:THREE.Color;
  private readonly windshield:THREE.Color;
  constructor(glass:THREE.Color,windshield:THREE.Color){this.glass=glass;this.windshield=windshield;}

  private readonly vertices: number[] = [];
  private readonly colors: number[] = [];

  private vertex([x,y,z]: Point, color: THREE.Color) {
    this.marks.push(0,0,color===this.glass||color===this.windshield?1:0);
    const wash = .95 + .045*Math.sin(x*5.4+y*7.7+z*2.3);
    this.vertices.push(x,y,z);
    this.colors.push(color.r*wash,color.g*wash,color.b*wash);
  }

  triangle(a: Point,b: Point,c: Point,color: THREE.Color) {
    this.vertex(a,color);
    this.vertex(b,color);
    this.vertex(c,color);
  }

  panel(a: Point,b: Point,c: Point,d: Point,color: THREE.Color) {
    this.triangle(a,b,c,color);
    this.triangle(a,c,d,color);
  }

  component(source: THREE.BufferGeometry, color: THREE.Color, x: number, y: number, z: number) {
    const geometry = source.index ? source.toNonIndexed() : source;
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) this.vertex([p.getX(i)+x,p.getY(i)+y,p.getZ(i)+z],color);
    if (geometry !== source) geometry.dispose();
    source.dispose();
  }

  contact(length:number,width:number,wheelbase:number){
    const halfLength=length*.47,halfWidth=width*.5+.09;
    const corners=[[-1,-1],[-1,1],[1,1],[-1,-1],[1,1],[1,-1]];
    for(const [x,z] of corners){
      this.vertices.push(x*halfLength,.012,z*halfWidth);
      // The opaque paint shader reads the wheel centers in normalized receiver coordinates.
      this.colors.push(wheelbase/(2*halfLength),(width*.5-.095)/halfWidth,0);
      this.marks.push(x,z,2);
    }
  }

  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(this.vertices,3));
    geometry.setAttribute('vehiclePaint',new THREE.Int8BufferAttribute(this.marks,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geometry.scale(metresToModel,metresToModel,metresToModel);
    geometry.translate(0,roadOffset,0);
    geometry.computeVertexNormals();
    return geometry;
  }
}

type PaintLight={glass:{value:THREE.Color};cast:{value:THREE.Vector3}};
const lights=new WeakMap<THREE.Material,PaintLight>();
function vehicleLight(){return {glass:{value:new THREE.Color('#8faabc')},cast:{value:new THREE.Vector3()}};}

export function setVehiclePaintLight(material:THREE.Material,sky:THREE.Color,sun:readonly number[],direct:number){
  let light=lights.get(material);
  if(!light){
    // Regional materials clone the full scene's complete shading chain. Rebind
    // the two uniforms to that copy, even if another scene is already drawing.
    light=vehicleLight();lights.set(material,light);
    const compile=material.onBeforeCompile,local=light;
    material.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer);
      shader.uniforms.vehicleSky=local.glass;shader.uniforms.vehicleCast=local.cast;
    };
    material.needsUpdate=true;
  }
  light.glass.value.copy(sky);
  const horizontal=Math.hypot(sun[0],sun[2]);
  light.cast.value.set(-sun[0],-sun[2],sun[1]>0&&horizontal>.0001?direct*horizontal/Math.max(.015,sun[1]):0);
}

export function streetVehicleMaterial() {
  const material=new THREE.MeshStandardMaterial({roughness:1,vertexColors:true}),light=vehicleLight();
  lights.set(material,light);
  material.onBeforeCompile=shader=>{
    shader.uniforms.vehicleSky=light.glass;shader.uniforms.vehicleCast=light.cast;
    shader.vertexShader='attribute vec3 vehiclePaint; varying vec3 vehicleMark; varying vec2 tireReceiver; uniform vec3 vehicleCast;\n'+
      shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvehicleMark=vehiclePaint;tireReceiver=vehiclePaint.xy;')
      .replace('#include <project_vertex>',`#include <project_vertex>
        if(vehiclePaint.z>1.5 && vehicleCast.z>.001){
          mat4 carFrame=modelMatrix;
          #ifdef USE_INSTANCING
            carFrame=carFrame*instanceMatrix;
          #endif
          #ifdef USE_BATCHING
            carFrame=carFrame*batchingMatrix;
          #endif
          vec2 away=normalize(vehicleCast.xy);
          vec3 carX=carFrame[0].xyz/max(.00001,length(carFrame[0].xz));
          vec3 carZ=carFrame[2].xyz/max(.00001,length(carFrame[2].xz));
          vec2 drift=vec2(dot(away,carX.xz),dot(away,carZ.xz))*min(.45,.085*vehicleCast.z);
          #ifdef USE_BATCHING
            // Keep bridge marks on the roadway at the outside rail.
            drift.y=clamp(drift.y,-.018,.018);
          #endif
          vec2 reach=max(sign(drift)*vehiclePaint.xy,0.)*drift;
          // Keep tire occlusion fixed in vehicle coordinates as the sun lengthens
          // the outer shape. The two effects share a single receiving quad.
          vec2 halfSize=abs(position.xz)*vec2(length(carFrame[0].xyz),length(carFrame[2].xyz));
          tireReceiver+=reach/max(halfSize,vec2(.0001));
          // Extend the cast shadow along the grade under both axles.
          mvPosition+=viewMatrix*vec4(carX*reach.x+carZ*reach.y,0.);
          gl_Position=projectionMatrix*mvPosition;
        }`);
    shader.fragmentShader='uniform vec3 vehicleSky; varying vec3 vehicleMark; varying vec2 tireReceiver;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        if(vehicleMark.z>.5 && vehicleMark.z<1.5)diffuseColor.rgb=mix(diffuseColor.rgb,vehicleSky,.74);`)
      .replace('#include <opaque_fragment>',`
        if(vehicleMark.z>1.5){
          // Ordered coverage lets the real painted road show through in the
          // same opaque vehicle batch, including its markings and lamp pools.
          const float stipple[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
          ivec2 texel=ivec2(gl_FragCoord.xy)%4;
          vec2 tire=(abs(tireReceiver)-vColor.rg)/vec2(.135,.20);
          float underTires=.67*(1.-smoothstep(.26,1.05,length(tire)));
          float underBody=.34*(1.-smoothstep(.53,1.,length(vehicleMark.xy)));
          float cover=max(underTires,underBody);
          if(cover<(stipple[texel.x+texel.y*4]+.5)/16.)discard;
        }
        #include <opaque_fragment>
        // Streetlamp and wet-road shaders also feed the opaque surface. Apply
        // coverage after those lighting terms so a shadow cannot become a lamp.
        if(vehicleMark.z>1.5)gl_FragColor.rgb=vec3(0.);`);
  };
  material.customProgramCacheKey=()=> 'painted-road-traffic-v2';
  return material;
}

export function createStreetVehicle(index: number, material: THREE.MeshStandardMaterial, distant = false) {
  const p = profiles[index%profiles.length];
  const base = new THREE.Color(paint[index%paint.length]), lacquer = base.clone().lerp(new THREE.Color('#eedfc2'),.12);
  const skirt = base.clone().multiplyScalar(.70), edge = base.clone().multiplyScalar(.90);
  const glass = new THREE.Color('#536e75'), windshield = new THREE.Color('#69828a');
  const rubber = new THREE.Color('#3f4847'), rim = new THREE.Color('#a6a79a'), lamp = new THREE.Color('#ecdfae');
  const tail = new THREE.Color('#9c5044'), plate = new THREE.Color('#d1c4aa');
  const form = new VehiclePaint(glass,windshield), half = p.length/2, wide = p.width/2;
  const axles = [-p.wheelbase/2,p.wheelbase/2];
  const axleCover = p.tyre+.065;
  const bonnet = p.waist - (index%4===3 ? .04 : .12);
  const sections = [[-half,p.waist-.21,.81],[-half+.18,p.waist-.09,.94],
    [p.rearBelt,p.waist,1],[p.frontBelt,p.waist,1],[half-.17,bonnet,.95],[half,bonnet-.10,.81]];
  // Sample each wheel arch along the lower silhouette. The tyre is visible through
  // the scallop, while the shoulder and roof lines carry through it.
  const archSteps = distant ? [-1,0,1] : [-1,-.75,-.40,0,.40,.75,1];
  const xs = [...new Set([...sections.map(([x])=>x),...axles.flatMap(axle=>archSteps.map(k=>axle+k*axleCover))])].sort((a,b)=>a-b);
  const rings = xs.map(x => {
    const j = Math.max(1,sections.findIndex(([edgeX])=>edgeX >= x));
    const [from,y0,w0] = sections[j-1], [to,y1,w1] = sections[j];
    const t = THREE.MathUtils.clamp((x-from)/(to-from),0,1);
    const top = THREE.MathUtils.lerp(y0,y1,t), width = wide*THREE.MathUtils.lerp(w0,w1,t);
    const wheelDistance = Math.min(...axles.map(axle=>Math.abs(axle-x)));
    const floor = wheelDistance < axleCover ? .34+Math.sqrt(axleCover**2-wheelDistance**2) : .34;
    const side = Math.min(floor,top-.16);
    const ring:Point[] = [[x,side,-width*.91],[x,side,width*.91],[x,top-.10,width],
      [x,top-.018,width*.91],[x,top,-width*.89],[x,top-.018,-width*.91],[x,top-.10,-width]];
    // The oblique hood bevel is continuous with both shoulders.
    ring.splice(4,0,[x,top,width*.89]);
    return ring;
  });
  for (let i=1;i<rings.length;i++) {
    const rear = rings[i-1], front = rings[i], surface = [skirt,base,edge,lacquer,lacquer,lacquer,edge,base];
    for(let j=0;j<rear.length;j++){
      const next=(j+1)%rear.length;
      form.panel(rear[j],front[j],front[next],rear[next],surface[j]);
    }
  }
  for (const [end,front] of [[rings[0],false],[rings.at(-1)!,true]] as const) {
    for (let i=1;i<end.length-1;i++){
      if(front) form.triangle(end[0],end[i+1],end[i],edge);
      else form.triangle(end[0],end[i],end[i+1],edge);
    }
  }

  const cabins = (u: number,v: number,side: number,offset=0):Point => [
    THREE.MathUtils.lerp(THREE.MathUtils.lerp(p.rearBelt,p.frontBelt,u),THREE.MathUtils.lerp(p.rearRoof,p.frontRoof,u),v),
    THREE.MathUtils.lerp(p.waist-.018,p.height,v),
    side*(wide*p.cabinWidth*(1-.123*v)+offset),
  ];
  form.panel(cabins(0,1,-1),cabins(0,1,1),cabins(1,1,1),cabins(1,1,-1),lacquer);
  for (const side of [-1,1]) {
    const panel = (left: number,right: number,bottom: number,top: number,color: THREE.Color,offset=0) => {
      const a=cabins(left,bottom,side,offset),b=cabins(right,bottom,side,offset);
      const c=cabins(right,top,side,offset),d=cabins(left,top,side,offset);
      if(side===1) form.panel(a,b,c,d,color);
      else form.panel(a,d,c,b,color);
    };
    panel(0,1,0,1,base);
    const sideWindows = index%4===3 ? [[.64,.93]] : index%4===2 ? [[.055,.29],[.32,.57],[.605,.94]] : [[.064,.44],[.48,.94]];
    sideWindows.forEach(([left,right], i) => panel(left,right,.16,.88,i%2 ? windshield : glass,.010));
  }
  for (const end of [0,1]) {
    const nose = end === 1;
    const panel = (lo: number,hi: number,bottom: number,top: number,color: THREE.Color,offset=0) => {
      const corner = (u: number,v: number):Point => {
        const [x,y,z] = cabins(end,v,1);
        return [x+(nose?offset:-offset),y,z*(2*u-1)];
      };
      const a=corner(lo,bottom),b=corner(hi,bottom),c=corner(hi,top),d=corner(lo,top);
      if(nose) form.panel(a,d,c,b,color);
      else form.panel(a,b,c,d,color);
    };
    panel(0,1,0,1,edge);
    if (nose || index%4!==3) panel(.085,.915,.14,.89,nose?windshield:glass,.012);
    else {
      // Opaque split cargo doors follow the rake of the rear cabin panel.
      panel(.494,.506,0,.98,skirt,.007);
      panel(.527,.624,.14,.194,rubber,.012);
      for(const u of [.035,.938])panel(u,u+.027,.66,.735,rim,.012);
    }
  }

  const box=(w:number,h:number,d:number,c:THREE.Color,x:number,y:number,z:number)=>
    form.component(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  const tyreSegments=distant?8:12,halfFacet=Math.PI/tyreSegments;
  // A loaded tire rests on a short chord. Align a tread facet with the road
  // and lower the axle to its rolling radius, keeping the rim concentric.
  const axleHeight=p.tyre*Math.cos(halfFacet);
  for(const axle of axles){
    for(const side of [-1,1]){
      const z=side*(wide-.095);
      form.component(new THREE.CylinderGeometry(p.tyre,p.tyre,.19,tyreSegments).rotateX(Math.PI/2).rotateZ(halfFacet),rubber,axle,axleHeight,z);
      if(!distant)form.component(new THREE.CylinderGeometry(p.tyre*.58,p.tyre*.58,.018,10).rotateX(Math.PI/2),rim,axle,axleHeight,side*(Math.abs(z)+.101));
    }
  }
  for(const side of [-1,1]){
    box(.052,.094,.25,lamp,half-.016,bonnet-.17,wide*side*.67);
    box(.046,.12,.19,tail,-half+.01,p.waist-.245,wide*side*.74);
    if(!distant) box(.14,.075,.12,edge,p.frontBelt-.22,p.waist+.14,wide*side*.95);
  }
  box(.064,.093,wide*.69,rubber,half-.018,bonnet-.275,0);
  if(p.name==='delivery van'){
    // Carry the door joint across the stepped sill and down to the bumper.
    const sill=[[-half-.005,.465],[-half-.005,p.waist-.207],[-half+.178,p.waist-.086],[p.rearBelt-.009,p.waist+.003]];
    for(let i=1;i<sill.length;i++){
      const [x,y]=sill[i-1],[nextX,nextY]=sill[i];
      form.panel([x,y,-.009],[x,y,.009],[nextX,nextY,.009],[nextX,nextY,-.009],skirt);
    }
    const rear=-half-.010;
    form.panel([rear,.525,.16],[rear,.525,.465],[rear,.677,.465],[rear,.677,.16],plate);
    const lip=rear-.040;
    form.panel([lip,.347,-wide*.78],[lip,.347,wide*.78],[lip,.461,wide*.78],[lip,.461,-wide*.78],rubber);
    form.panel([lip,.461,-wide*.78],[lip,.461,wide*.78],[-half,.461,wide*.78],[-half,.461,-wide*.78],edge);
  }else if(!distant)box(.05,.071,.23,plate,-half+.014,.48,0);

  form.contact(p.length,p.width,p.wheelbase);
  const vehicle = new THREE.Group();
  vehicle.name = p.name;
  const mesh = new THREE.Mesh(form.geometry(),material);
  mesh.receiveShadow = true;
  vehicle.add(mesh);
  return vehicle;
}
