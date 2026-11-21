import * as THREE from 'three';
import {KernelSize, ShaderPass, TiltShiftEffect} from 'postprocessing';

// Queue the opaque street-light programs against the actual print target. Shadow
// geometry uploads can then run while the driver links the color programs.
function queueStreetPrograms(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
  scene.updateMatrixWorld();
  const clip=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const frustum=new THREE.Frustum().setFromProjectionMatrix(clip,camera.coordinateSystem,camera.reversedDepth);

  // compile(subset, camera, scene) collects lights from both arguments. This
  // traversal view borrows the scene without reparenting meshes or allocating
  // a Three object whose random UUID would affect later seeded artwork.
  const subset:THREE.Scene=Object.create(scene);
  subset.traverseVisible=()=>{};
  subset.traverse=visit=>scene.traverseVisible(object=>{
    const mesh=object as THREE.Mesh;
    // The pane instancer patches its material during the real draw.
    if(!mesh.isMesh||mesh.type==='InstancedMesh2'||!mesh.layers.test(camera.layers))return;
    if(!mesh.geometry.drawRange.count)return;
    const material=mesh.material as THREE.MeshStandardMaterial;
    if(!material.isMeshStandardMaterial||material.transparent||!material.visible)return;
    if(!material.customProgramCacheKey().includes('street-surface'))return;
    if(mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;
    visit(mesh);
  });
  renderer.compile(subset,camera,scene);
  renderer.getContext().flush();
}

// The broad square cornices end at the second colonnade. The narrower
// lantern, mast and flying flag fit within the upper section.
export function towerPrintFocus(clockCenter:THREE.Vector3){
  const sections=[[.38,.90,3.075],[.215,3.075,235*.3048*.06+.025]];
  const corners=sections.map(([radius,low,high])=>{
    const points:THREE.Vector3[]=[];
    for(const x of [-radius,radius])for(const z of [-radius,radius])for(const y of [low,high]){
      points.push(new THREE.Vector3(clockCenter.x+x,y,clockCenter.z+z));
    }
    return points;
  });
  const bounds=sections.map(()=>new THREE.Vector4());
  const clip=new THREE.Matrix4(),point=new THREE.Vector4();
  function update(camera:THREE.PerspectiveCamera){
    clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    for(let i=0;i<corners.length;i++){
      const rect=bounds[i];
      rect.set(Infinity,Infinity,-Infinity,-Infinity);
      let inFrontOfNearPlane=false;
      for(const corner of corners[i]){
        point.set(corner.x,corner.y,corner.z,1).applyMatrix4(clip);
        if(point.w>=camera.near)inFrontOfNearPlane=true;
        const scale=.5/Math.max(camera.near,point.w);
        const u=point.x*scale+.5,v=point.y*scale+.5;
        rect.x=Math.min(rect.x,u);rect.y=Math.min(rect.y,v);
        rect.z=Math.max(rect.z,u);rect.w=Math.max(rect.w,v);
      }
      if(!inFrontOfNearPlane)rect.set(-2,-2,-2,-2);
    }
  }
  return {bounds,update};
}

// Resolve the city once into an antialiased color buffer. Both the actual
// camera image and its half-size tilt-shift wash feed the same final draw.
export function createHarborPrint(renderer:THREE.WebGLRenderer,clockCenter:THREE.Vector3){
  const source=new THREE.WebGLRenderTarget(1,1,{
    samples:Math.min(4,renderer.capabilities.maxSamples),depthBuffer:true,stencilBuffer:false,resolveDepthBuffer:false,resolveStencilBuffer:false,
    colorSpace:THREE.SRGBColorSpace,
  });
  source.texture.name='Waterfront on paper';
  const tilt=new TiltShiftEffect({resolutionScale:.5,focusArea:.32,feather:.14,kernelSize:KernelSize.SMALL});
  tilt.initialize(renderer,false,THREE.UnsignedByteType);
  const tower=towerPrintFocus(clockCenter);
  const uniforms={
    inputBuffer:{value:source.texture}, wash:{value:tilt.uniforms.get('map')!.value as THREE.Texture},
    paperTexel:{value:new THREE.Vector2()},focusRow:{value:.50},strength:{value:1},
    bounce:{value:new THREE.Color()},towerBounds:{value:tower.bounds},aspect:{value:1},
  };
  const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:'varying vec2 paperUV; void main(){paperUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform sampler2D inputBuffer,wash;
      uniform vec2 paperTexel;
      uniform vec4 towerBounds[2];
      uniform vec3 bounce;
      uniform float focusRow,strength,aspect;
      varying vec2 paperUV;
      const vec3 luma=vec3(.2126,.7152,.0722);
      // Each quadrant shares the centre sample. Keep the quadrant with the
      // least luminance variance, so paint spreads along an edge before crossing it.
      void region(vec3 a,vec3 b,vec3 c,vec3 d,inout float best,inout vec3 pigment){
        vec3 mean=(a+b+c+d)*.25;
        vec4 lights=vec4(dot(a,luma),dot(b,luma),dot(c,luma),dot(d,luma));
        float avg=dot(mean,luma), variance=dot(lights,lights)*.25-avg*avg;
        if(variance<best){best=variance;pigment=mean;}
      }
      float outsideTower(vec2 uv,vec4 rect){
        vec2 edge=max(max(rect.xy-uv,uv-rect.zw),0.);
        return length(edge*vec2(aspect,1.));
      }
      void main(){
        vec2 uv=paperUV;
        vec3 color=texture2D(inputBuffer,uv).rgb;
        float mask=smoothstep(.09,.42,abs(uv.y-focusRow))*strength;
        if(mask>.004){
          float edge=min(outsideTower(uv,towerBounds[0]),outsideTower(uv,towerBounds[1]));
          mask*=smoothstep(paperTexel.y,paperTexel.y+.012,edge);
        }
        if(mask>.004){
          vec2 d=paperTexel;
          vec3 mid=texture2D(wash,uv).rgb;
          vec3 n=texture2D(wash,uv+vec2(0.,d.y)).rgb,s=texture2D(wash,uv-vec2(0.,d.y)).rgb;
          vec3 e=texture2D(wash,uv+vec2(d.x,0.)).rgb,w=texture2D(wash,uv-vec2(d.x,0.)).rgb;
          vec3 paint=mid;float best=2.;
          region(mid,n,e,texture2D(wash,uv+d).rgb,best,paint);
          region(mid,n,w,texture2D(wash,uv+vec2(-d.x,d.y)).rgb,best,paint);
          region(mid,s,w,texture2D(wash,uv-d).rgb,best,paint);
          region(mid,s,e,texture2D(wash,uv+vec2(d.x,-d.y)).rgb,best,paint);
          color=mix(color,mix(mid,paint,.68),mask);
        }
        vec3 printColor=sRGBTransferOETF(vec4(max(color,0.),1.)).rgb;
        float y=dot(printColor,luma);
        printColor=mix(vec3(y),printColor,1.10);
        printColor=.105*bounce+.895*printColor;
        printColor+=vec3(.018,.009,0.)*smoothstep(.55,1.,y);
        float tooth=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
        printColor+=tooth*.028*(.44+.56*(1.-abs(y*2.-1.)));
        printColor*=1.-.06*smoothstep(.27,.72,length(uv-.5));
        gl_FragColor=vec4(clamp(printColor,0.,1.),1.);
      }
    `});
  const grade=new ShaderPass(material,'inputBuffer');grade.renderToScreen=true;
  const focus=new THREE.Vector3(),dimensions=new THREE.Vector2();
  let firstFrame=true;
  return {
    resize(quality=2,compact=false){
      renderer.getDrawingBufferSize(dimensions);
      const samples=Math.min(renderer.capabilities.maxSamples,compact||quality===0?2:renderer.getPixelRatio()>=1.45?2:4);
      if(source.samples!==samples){source.dispose();source.samples=samples;}
      source.setSize(dimensions.x,dimensions.y);if(quality>0)tilt.setSize(dimensions.x,dimensions.y);
      uniforms.paperTexel.value.set(2/dimensions.x,2/dimensions.y);
      uniforms.aspect.value=dimensions.x/dimensions.y;
    },
    render(scene:THREE.Scene,camera:THREE.PerspectiveCamera,zoom:number,riding:boolean,quality:number,
      target:THREE.Vector3,bounceColor:THREE.Color){
      focus.copy(target);focus.y=.45;focus.project(camera);
      const row=THREE.MathUtils.clamp(focus.y*.5+.5,.30,.72);
      uniforms.focusRow.value=row;
      uniforms.strength.value=riding||quality===0?0:1-THREE.MathUtils.smoothstep(zoom,1.3,3.3);
      if(uniforms.strength.value>.004)tower.update(camera);
      uniforms.bounce.value.copy(bounceColor).convertLinearToSRGB();
      renderer.setRenderTarget(source);
      if(firstFrame){firstFrame=false;queueStreetPrograms(renderer,scene,camera);}
      renderer.render(scene,camera);
      if(uniforms.strength.value>.004){tilt.offset=(row-.5)*2;tilt.update(renderer,source,0);}
      grade.render(renderer,source,null);
    },
    dispose(){grade.dispose();tilt.dispose();source.dispose();},
  };
}
