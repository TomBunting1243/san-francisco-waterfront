import * as THREE from 'three';

export type FacadePoint=[number,number,number];

// Flat-shaded indexed panels share one GPU material; each face keeps its own pigment.
export class FacadePanels {
  positions:number[]=[];colors:number[]=[];indices:number[]=[];
  palette=new Map<string,THREE.Color>();
  private vertices(points:FacadePoint[],tint:string){
    let color=this.palette.get(tint);
    if(!color){color=new THREE.Color(tint);this.palette.set(tint,color);}
    const n=this.positions.length/3;
    for(const p of points){this.positions.push(...p);this.colors.push(color.r,color.g,color.b);}
    return n;
  }
  quad(a:FacadePoint,b:FacadePoint,c:FacadePoint,d:FacadePoint,tint:string){
    const n=this.vertices([a,b,c,d],tint);this.indices.push(n,n+1,n+2,n,n+2,n+3);
  }
  triangle(a:FacadePoint,b:FacadePoint,c:FacadePoint,tint:string){
    const n=this.vertices([a,b,c],tint);this.indices.push(n,n+1,n+2);
  }
  mesh(material:THREE.MeshStandardMaterial){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    g.setIndex(this.indices);g.computeVertexNormals();
    return new THREE.Mesh(g,material);
  }
}
