import * as THREE from 'three';

type Point = [x: number, y: number, z: number];
const paint = ['#a96451', '#c3a35b', '#548086', '#777886', '#84947d', '#c0b8a4'];
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

// The street group applies .5 at runtime. This puts vehicles at the scale of the
// surrounding figures and benches, with contact points at the top of the road.
const metresToModel = .24;
const roadOffset = .055;

class VehiclePaint {
  private readonly vertices: number[] = [];
  private readonly colors: number[] = [];

  private vertex([x,y,z]: Point, color: THREE.Color) {
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

  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(this.vertices,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    geometry.scale(metresToModel,metresToModel,metresToModel);
    geometry.translate(0,roadOffset,0);
    geometry.computeVertexNormals();
    return geometry;
  }
}

export function streetVehicleMaterial() {
  return new THREE.MeshStandardMaterial({roughness:.86,vertexColors:true});
}

export function createStreetVehicle(index: number, material: THREE.MeshStandardMaterial, distant = false) {
  const p = profiles[index%profiles.length];
  const base = new THREE.Color(paint[index%paint.length]), lacquer = base.clone().lerp(new THREE.Color('#eedfc2'),.12);
  const skirt = base.clone().multiplyScalar(.70), edge = base.clone().multiplyScalar(.90);
  const glass = new THREE.Color('#536e75'), windshield = new THREE.Color('#69828a');
  const rubber = new THREE.Color('#3f4847'), rim = new THREE.Color('#a6a79a'), lamp = new THREE.Color('#ecdfae');
  const tail = new THREE.Color('#9c5044'), plate = new THREE.Color('#d1c4aa');
  const form = new VehiclePaint(), half = p.length/2, wide = p.width/2;
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
  }

  const box=(w:number,h:number,d:number,c:THREE.Color,x:number,y:number,z:number)=>
    form.component(new THREE.BoxGeometry(w,h,d),c,x,y,z);
  for(const axle of axles){
    for(const side of [-1,1]){
      const z=side*(wide-.095);
      form.component(new THREE.CylinderGeometry(p.tyre,p.tyre,.19,distant?8:12).rotateX(Math.PI/2),rubber,axle,p.tyre,z);
      if(!distant)form.component(new THREE.CylinderGeometry(p.tyre*.58,p.tyre*.58,.018,10).rotateX(Math.PI/2),rim,axle,p.tyre,side*(Math.abs(z)+.101));
    }
  }
  for(const side of [-1,1]){
    box(.052,.094,.25,lamp,half-.016,bonnet-.17,wide*side*.67);
    box(.046,.12,.19,tail,-half+.01,p.waist-.245,wide*side*.74);
    if(!distant) box(.14,.075,.12,edge,p.frontBelt-.22,p.waist+.14,wide*side*.95);
  }
  box(.064,.093,wide*.69,rubber,half-.018,bonnet-.275,0);
  if(!distant)box(.05,.071,.23,plate,-half+.014,.48,0);

  const vehicle = new THREE.Group();
  vehicle.name = p.name;
  const mesh = new THREE.Mesh(form.geometry(),material);
  mesh.receiveShadow = true;
  vehicle.add(mesh);
  return vehicle;
}
