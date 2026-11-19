/** Keep Three's shadow sampling, normal handling and local light hooks. Only the
 * surface response changes. Painted architecture has two soft transitions
 * between shade, half-light and full sun, and no specular lobe. */
export function paintedLight(fragment:string){
  return fragment.replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
    void RE_Direct_Gouache(const in IncidentLight lamp,const in vec3 p,const in vec3 n,
      const in vec3 viewDir,const in vec3 coatNormal,const in PhysicalMaterial paint,inout ReflectedLight light){
      float angle=dot(n,lamp.direction);
      float value=.58*smoothstep(0.,.10,angle)+.42*smoothstep(.52,.66,angle);
      light.directDiffuse+=lamp.color*value*BRDF_Lambert(paint.diffuseColor);
    }
    void RE_IndirectDiffuse_Gouache(const in vec3 irradiance,const in vec3 p,const in vec3 n,
      const in vec3 viewDir,const in vec3 coatNormal,const in PhysicalMaterial paint,inout ReflectedLight light){
      light.indirectDiffuse+=irradiance*BRDF_Lambert(paint.diffuseColor);
    }
    #undef RE_Direct
    #define RE_Direct RE_Direct_Gouache
    #undef RE_IndirectDiffuse
    #define RE_IndirectDiffuse RE_IndirectDiffuse_Gouache
  `);
}
