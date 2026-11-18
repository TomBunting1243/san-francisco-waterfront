import * as THREE from 'three';

type Point = [number, number];
type Building = { id: number; minH?: number };
type Window = { x: number; y: number; z: number; ry: number; w: number; h: number };
type Elevation = 'lower' | 'upper' | 'penthouse' | 'crown';
type Curve = [Point, Point, Point, Point];

const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .68 });
const panes = ['#69909f', '#7196a5', '#779caa', '#668897', '#809fa9'];
const metal = '#bcc6c5', spandrel = '#829ba4', rail = '#9aafb6', terrace = '#b3b2a9';

// Arquitectonica's Tower B plans in SF Planning packet 2012.1097C, sheets
// 2 and 17–20. Coordinates below follow the printed orientation (Folsom left,
// Beale below). Control points trace the four bowed curtains between balconies.
// The shorter wings face the upper left and lower right of the printed plan.
// https://commissions.sfplanning.org/cpcpackets/2012.1097C.pdf
// https://www.vanke.us/portfolio/san-francisco/lumina
// https://arquitectonica.com/architecture/wp-content/uploads/sites/2/2016/10/Lumina_San_Francisco_1-1920x1080.jpg
function curves(level: Elevation): Curve[] {
  const upper = level !== 'lower';
  const top = level === 'penthouse' || level === 'crown';
  if (level === 'crown') return [
    [[123,487],[177,472],[394,489],[453,302]],
    [[453,302],[489,208],[507,110],[427,89]],
    [[427,89],[387,129],[197,96],[104,278]],
    [[104,278],[64,385],[48,463],[123,487]],
  ];
  return [
    [[139,506],[89,497],[62,451],top ? [74,348] : [56,332]],
    [top ? [74,348] : [56,332], upper ? [68,279] : [54,292],upper ? [110,198] : [65,222],top ? [163,161] : upper ? [131,155] : [95,150]],
    [top ? [154,134] : upper ? [111,131] : [78,133],upper ? [160,88] : [102,92],upper ? [206,85] : [149,76],top ? [278,88] : upper ? [255,82] : [186,70]],
    [top ? [278,88] : upper ? [255,82] : [186,70],[288,68],[351,78],[409,100]],
    [[419,73],[460,84],[488,129],upper ? [489,249] : [500,229]],
    [upper ? [489,249] : [500,229],upper ? [489,308] : [501,309],upper ? [458,371] : [480,395],top ? [390,421] : upper ? [427,428] : [464,419]],
    [top ? [402,447] : upper ? [446,449] : [483,448],top ? [363,478] : [425,495],top ? [324,487] : [393,500],top ? [276,488] : upper ? [303,498] : [371,507]],
    [top ? [276,488] : upper ? [303,498] : [371,507],[282,511],[215,500],[147,481]],
  ];
}

function project([u,v]: Point): Point {
  // Fit the drawing to 1.5 m USGS 2023 first-return cells around Tower B.
  // The mapped outline sits slightly east of the measured roof returns.
  const a = (u-278)*.005045, b = (v-290)*.005272;
  return [-40.745-a*.98246-b*.18648, -21.829+a*.18648-b*.98246];
}
function bezier([a,b,c,d]: Curve, t: number): Point {
  const s = 1-t;
  return [0,1].map(i => s*s*s*a[i]+3*s*s*t*b[i]+3*s*t*t*c[i]+t*t*t*d[i]) as Point;
}
function mix(a: Point,b: Point,t: number): Point {
  return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}

export function addLuminaTower(building: Building, root: THREE.Group, windows: Window[]): boolean {
  if (building.id !== 421816060) return false;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const palette = new Map<string,THREE.Color>();
  function vertex(p: Point,y: number,tone: string) {
    let color = palette.get(tone);
    if (!color) { color = new THREE.Color(tone); palette.set(tone,color); }
    positions.push(p[0],y,p[1]); colors.push(color.r,color.g,color.b);
  }
  function wall(p: Point,q: Point,lo: number,hi: number,tone: string) {
    const i = positions.length/3;
    vertex(p,lo,tone); vertex(q,lo,tone); vertex(q,hi,tone); vertex(p,hi,tone);
    indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  function slab(points: Point[],y: number,tone: string,up = true) {
    const i = positions.length/3;
    const triangles = THREE.ShapeUtils.triangulateShape(points.map(p => new THREE.Vector2(...p)),[]);
    for (const p of points) vertex(p,y,tone);
    for (const [a,b,c] of triangles) indices.push(i+a,i+(up?c:b),i+(up?b:c));
  }
  function curtain(p: Point,q: Point,lo: number,hi: number,row: number,bay: number,frameTop=hi) {
    // Wall paths wind counterclockwise on the printed page (negative signed area).
    const dx=q[0]-p[0], dz=q[1]-p[1], width=Math.hypot(dx,dz);
    const frameEnd=mix(p,q,.055), sill=lo+(hi-lo)*.105;
    wall(frameEnd,q,lo,sill,spandrel);
    if(frameTop>lo)wall(p,frameEnd,lo,frameTop,metal);
    wall(frameEnd,q,sill,hi,panes[(bay*3+Math.floor(row/3)+Math.floor(bay/5))%panes.length]);
    if (row < 41 && (row*7+bay*3+Math.floor(bay/7))%11===0) {
      windows.push({x:(p[0]+q[0])/2-dz/width*.0025,z:(p[1]+q[1])/2+dx/width*.0025,
        y:(sill+hi)/2,ry:Math.atan2(-dz,dx),w:width*.83,h:(hi-sill)*.84});
    }
  }
  function balconies(p: Point,q: Point,lo: number,hi: number,row: number,bay: number) {
    const dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
    const out=(t: number,depth: number): Point => {
      const a=mix(p,q,t);return [a[0]-dz/len*depth,a[1]+dx/len*depth];
    };
    const rim=[p,out(.23,.042),out(.55,.060),out(.82,.041),q];
    const edge=lo+.014, guard=edge+.055;
    for(let j=0;j<rim.length-1;j++){
      wall(rim[j],rim[j+1],lo,edge,metal);
      wall(rim[j],rim[j+1],edge,guard,rail);
      wall(rim[j],rim[j+1],guard,guard+.005,'#d0d4cc');
    }
    slab(rim,edge,terrace); slab(rim,lo,metal,false);
    curtain(p,mix(p,q,.5),lo,hi,row,bay);curtain(mix(p,q,.5),q,lo,hi,row,bay+1);
  }
  function tier(level: Elevation, rows: number, bottom: number, top: number, first: number) {
    const arcs = curves(level), outline: Point[] = [];
    const projected=arcs.map(curve => {
      const count=level==='crown'?12:6;
      return Array.from({length:count+1},(_,i)=>project(bezier(curve,i/count)));
    });
    if(level!=='crown') {
      projected.reverse();
      for(const arc of projected)arc.reverse();
    }
    for(let j=0;j<projected.length;j++){
      const pts=projected[j],end=pts[pts.length-1],next=projected[(j+1)%projected.length][0];
      outline.push(...pts.slice(0,-1));
      const hasBalcony=Math.hypot(end[0]-next[0],end[1]-next[1])>.001;
      if(hasBalcony)outline.push(end);
      for(let r=0;r<rows;r++){
        const lo=bottom+(top-bottom)*r/rows,hi=bottom+(top-bottom)*(r+1)/rows;
        for(let k=0;k<pts.length-1;k++)curtain(pts[k],pts[k+1],lo,hi,first+r,j*12+k,r===0?top:lo);
        if(hasBalcony)balconies(end,next,lo,hi,first+r,j*12+7);
      }
    }
    slab(outline,top,terrace);
    return outline;
  }
  // Surveyed ledges at 81.5, 116.8 and 122–124 m, followed by a lenticular
  // roof screen. Vanke records forty floors in the taller Beale Street tower.
  const m=.06,base=building.minH??7*m;
  tier('lower',26,base,81.5*m,2);
  tier('upper',11,81.5*m,116.8*m,28);
  tier('penthouse',2,116.8*m,123*m,39);
  const rim=tier('crown',2,123*m,129.8*m,41);
  // A thin lip above an inset roof, and a separate rectangular plant housing.
  const center=project([278,290]),inner=rim.map(p=>mix(p,center,.022));
  for(let i=0;i<rim.length;i++){
    const j=(i+1)%rim.length,roof=129.8*m,lip=130.45*m;
    wall(rim[i],rim[j],roof,lip,metal);wall(inner[j],inner[i],roof,lip,spandrel);
    slab([rim[i],rim[j],inner[j],inner[i]],lip,metal);
  }
  const plant: Point[] = [[202,326],[200,358],[372,378],[374,345]];
  const housing=plant.map(project);
  for(let i=0;i<4;i++)wall(housing[i],housing[(i+1)%4],129.8*m,132.4*m,'#8c9897');
  slab(housing,132.4*m,'#aab3b1');
  const geometry=new THREE.BufferGeometry();
  geometry.setIndex(indices);geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.userData.paintVertices=true;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='LUMINA I · Tower B at Folsom and Beale';
  root.add(mesh);return true;
}
