import * as THREE from 'three';
import {KernelSize, ShaderPass, TiltShiftEffect} from 'postprocessing';

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
  const uniforms={
    inputBuffer:{value:source.texture}, wash:{value:tilt.uniforms.get('map')!.value as THREE.Texture},
    paperTexel:{value:new THREE.Vector2()},focusRow:{value:.50},strength:{value:1},
    bounce:{value:new THREE.Color()},clockUV:{value:new THREE.Vector2(-2,-2)},aspect:{value:1},
  };
  const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:'varying vec2 paperUV; void main(){paperUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform sampler2D inputBuffer,wash;
      uniform vec2 paperTexel,clockUV;
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
      void main(){
        vec2 uv=paperUV;
        vec3 color=texture2D(inputBuffer,uv).rgb;
        float mask=smoothstep(.09,.42,abs(uv.y-focusRow))*strength;
        // Keep the clock legible even when it breaks the line of roofs.
        mask*=smoothstep(.032,.075,length((uv-clockUV)*vec2(aspect,1.)));
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
  const clock=new THREE.Vector3(),focus=new THREE.Vector3(),dimensions=new THREE.Vector2();
  return {
    resize(){
      renderer.getDrawingBufferSize(dimensions);
      source.samples=Math.min(renderer.capabilities.maxSamples,renderer.getPixelRatio()>=1.45?2:4);
      source.setSize(dimensions.x,dimensions.y);tilt.setSize(dimensions.x,dimensions.y);
      uniforms.paperTexel.value.set(2/dimensions.x,2/dimensions.y);
      uniforms.aspect.value=dimensions.x/dimensions.y;
    },
    render(scene:THREE.Scene,camera:THREE.PerspectiveCamera,zoom:number,riding:boolean,quality:number,
      target:THREE.Vector3,bounceColor:THREE.Color){
      focus.copy(target);focus.y=.45;focus.project(camera);
      const row=THREE.MathUtils.clamp(focus.y*.5+.5,.30,.72);
      clock.copy(clockCenter).project(camera);
      uniforms.clockUV.value.set(clock.x*.5+.5,clock.y*.5+.5);
      uniforms.focusRow.value=row;
      uniforms.strength.value=riding||quality===0?0:1-THREE.MathUtils.smoothstep(zoom,1.3,3.3);
      uniforms.bounce.value.copy(bounceColor).convertLinearToSRGB();
      renderer.setRenderTarget(source);renderer.render(scene,camera);
      if(uniforms.strength.value>.004){tilt.offset=(row-.5)*2;tilt.update(renderer,source,0);}
      grade.render(renderer,source,null);
    },
    dispose(){grade.dispose();tilt.dispose();source.dispose();},
  };
}
