import * as THREE from 'three';

/** A stitched mainsail, jib, coaming and boot stripe share one vertex-coloured mesh. */
export function createDaySailer(accent: string) {
  const vertices: number[] = [], colors: number[] = [];
  const paint = new THREE.Color();
  type Point = [number,number,number];
  function triangle(a: Point,b: Point,c: Point,color: string) {
    paint.set(color);
    vertices.push(...a,...b,...c);
    for (let i=0;i<3;i++) colors.push(paint.r,paint.g,paint.b);
  }
  function quad(a: Point,b: Point,c: Point,d: Point,color: string) {
    triangle(a,b,c,color); triangle(a,c,d,color);
  }
  const stations = [[-1.1,.22],[-.62,.35],[.12,.37],[.77,.22],[1.32,.016]];
  for(let i=1;i<stations.length;i++) {
    const [x,w]=stations[i-1], [nx,nw]=stations[i];
    for(const side of [-1,1]) {
      quad([x,.17,w*side],[nx,.17,nw*side],[nx,.10,nw*side],[x,.10,w*side],accent);
      quad([x,.10,w*side],[nx,.10,nw*side],[nx,-.15,nw*.61*side],[x,-.15,w*.61*side],'#eee6ce');
    }
    quad([x,.17,-w],[nx,.17,-nw],[nx,.17,nw],[x,.17,w],'#ae8862');
  }
  const mast=.18;
  quad([mast,.17,0],[mast+.035,.17,0],[mast+.035,2.78,0],[mast,2.78,0],'#785d43');
  for(let row=0;row<8;row++){
    const panel=(r:number):[Point,Point]=>{
      const t=r/8,y=.52+2.2*t;
      return [[mast,y,.018],[-.99+1.13*t,y+.12*(1-t),.17*(1-t)]];
    };
    const [a,b]=panel(row),[d,c]=panel(row+1);
    quad(a,b,c,d,row===5?accent:row%2===0?'#f4edd4':'#fff7de');
  }
  triangle([1.21,.31,.015],[.24,2.52,0],[.41,.49,-.17],'#ecdfbf');
  quad([-.87,.19,-.19],[-.26,.19,-.19],[-.26,.19,.19],[-.87,.19,.19],'#504d44');
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const boat=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.84}));
  boat.receiveShadow=true;
  return boat;
}
