"""Rebuild small shoreline-side walk and Howard plaza repairs. Requires Shapely.
SF 2024 RGB 8 cm ortho, rectified plate: crop origin (-31.3,0), 132 px/unit;
positive image y points inland. The strata in each section are the planted edge,
sidewalk/bikeway seam and traffic-side face of the low protective separator.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.affinity import rotate

data = Path(__file__).resolve().parents[1] / 'public/data'
def read(name):
    return json.loads((data/name).read_text())
def world(u,v):
    return [round(-31.3+u/132,5),round(-v/132,5)]
def ring(p):
    return [[round(x,5),round(z,5)] for x,z in p.coords[:-1]]
def plans(shape):
    if shape.is_empty:return []
    if shape.geom_type=='Polygon':return [[ring(shape.exterior),*[ring(h) for h in shape.interiors]]]
    return [p for g in getattr(shape,'geoms',[]) for p in plans(g)]
# Terminal sections feather into intact pavement on either side of the six pins.
sections=[(21,245,269,304),(74,230,253,289),(138,210,238,272),(204,192,218,253),
          (266,173,201,236),(330,153,182,218),(394,135,166,199),(464,115,146,178),
          (533,98,132,161),(603,83,119,148),(663,74,108,139),(724,76,102,133),
          (780,80,99,128),(813,80,96,127)]
# Existing OSM terrace overhangs the photographed walk. The soil shoulder
# grades back to the existing park datum, tapering out at its two ends.
stations=[]
retaining_return={663:47,724:49}
for i,(u,plant,walk,divider) in enumerate(sections):
    width=min(40,(u-sections[0][0])*.7,(sections[-1][0]-u)*.7)
    # At the northern end the upper promenade curves past mapped bench
    # 10968514766. Its flat apron continues through both footings; the planted
    # shoulder begins on the other side of the visible masonry return.
    back=max(plant-width,retaining_return.get(u,plant-width))
    stations.append([world(u,back),world(u,plant),world(u,walk),world(u,divider)])
cut=Polygon([s[0] for s in stations]+[world(sections[-1][0],400),world(sections[0][0],400)])
terrace=read('survey-shore.json')['rincon'][0]
original_garden=[[312,206],[310,178],[342,147],[376,129],[412,128],[495,140],[569,160],[640,183],
                 [714,201],[769,213],[760,225],[719,237],[675,237],[644,239],[602,216],[552,192],
                 [502,177],[462,166],[419,164],[378,175],[343,191]]
garden=Polygon([(-42+u/48,-5+v/48) for u,v in original_garden])
# The back of the shoulder meets the park terrace. Preserve its two terminal
# transitions and extruded edge along the actual coastline.
trimmed=plans(Polygon(terrace[0],terrace[1:]).difference(cut))[0]
# North of the return the photographed bench apron continues the upper path.
# The coarser old garden outline encroaches onto the west runner by 0.3 m.
seat_apron=Polygon([world(u,v) for u,v in [(650,18),(704,26),(704,49),(650,42)]])
garden_plan=plans(garden.difference(cut.union(seat_apron)))[0][0]
# Restrict the Howard paving to the two photographed landside curb returns.
# Preserve the circular fountain and its surrounding ring on the north side.
howard=[[(299,659),(440,615),(572,569),(682,529),(759,506),(785,514),
         (752,558),(615,614),(536,653),(469,668),(377,703),(304,704)],
        [(1025,423),(1076,414),(1138,403),(1193,394),(1197,415),(1162,420),
         (1137,430),(1122,445),(1119,465),(1121,479),(1045,485),(1022,470)]]
surfaces=read('survey-blocks.json')['streets']
# Avoid coplanar coverage of existing modeled pavement, including the final
# curb/ramp overrides. Soil wells are inferred under the registered tree row.
overrides=read('curb-survey.json')['overrides']
paved=[]
for kind in ('sidewalk','street','curb','alley','private'):
    for i,r in enumerate(surfaces.get(kind,[])):
        for p in overrides.get(kind,{}).get(str(i),[r]):
            if p and any(-30<x<-21 and -7<z<-2 for x,z in p[0]):
                paved.append(Polygon(p[0],p[1:]))
existing=unary_union(paved)
trees=[a['p'] for a in read('waterfront-landscape.json')['trees'] if 10869934291<=a['id']<=10869934298]
soil=unary_union([rotate(box(x-.045,z-.045,x+.045,z+.045),19,origin=(x,z)) for x,z in trees])
walk=unary_union([Polygon([world(u,v) for u,v in p]) for p in howard]).difference(existing)
# The photographed separator has bolted short raised sections with gaps.
# Digitised ends in pixels along the curve, excluding the zebra crossing.
separator=[[25,56],[65,107],[120,160],[171,213],[222,263],[273,315],[327,365],
           [377,417],[429,464],[478,512],[524,561],[575,608],[620,654],[667,697],
           [710,741],[754,783],[792,807]]
out=dict(stations=stations,terrace=trimmed,garden=garden_plan,
         inland=plans(walk.difference(soil)),wells=plans(walk.intersection(soil)),
         separator=[[world(u,0)[0],world(v,0)[0]] for u,v in separator])
(data/'rincon-curb-edge.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
