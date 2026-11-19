"""Build Folsom Portal from the cached OSM map and 2024 City aerial.
Usage: python scripts/import-folsom-portal.py path/to/reference-survey (Shapely 2).
"""
import json, math, sys
from pathlib import Path
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union

data = Path(__file__).resolve().parents[1] / 'public/data'
cache = Path(sys.argv[1])
load = lambda p: json.loads(p.read_text())
def project(lon, lat):
    e = (lon + 122.39348) * (111320 * math.cos(math.radians(37.79554)))
    n = (lat - 37.79554) * 111320
    return [-.03552029735*e+.04836012986*n, .04836012986*e+.03552029735*n]

def rings(shape):
    if shape.geom_type != 'Polygon':
        return [p for part in getattr(shape, 'geoms', []) for p in rings(part)]
    if shape.area < .000001:
        return []
    return [[[[round(x,5),round(z,5)] for x,z in ring.coords[:-1]]
             for ring in (shape.exterior,*shape.interiors)]]

elements = load(cache/'embarcadero-rail-map.json')['elements']
nodes = {n['id']:project(n['lon'],n['lat']) for n in elements if n['type']=='node'}
ways = {w['id']:w['nodes'] for w in elements if w['type']=='way'}
def coords(i):
    return [nodes[n] for n in ways[i]]

# Each track has a mapped surface approach, open cutting and tunnel. Sample
# opposing ways at matching normalized distances; preserve every curve node.
sections=[]
for ids in [(667569474,667569473),(160312617,240059480),(160333986,551273341)]:
    pair=[LineString(sorted(coords(i),key=lambda p:p[0])) for i in ids]
    if ids[0]==160333986:
        # Only the first 5.3 m of the covered throat are visible from outside.
        pair=[LineString([line.coords[0],line.interpolate(.32).coords[0]]) for line in pair]
    fractions=sorted(set(round(line.project(Point(p),normalized=True),6)
                         for line in pair for p in line.coords))
    sections.append([[[round(v,5) for v in line.interpolate(f,normalized=True).coords[0]]
                     for line in pair] for f in fractions])

def sides(st):
    a,b=st; dx,dz=a[0]-b[0],a[1]-b[1]; l=math.hypot(dx,dz)
    return [[a[0]+.184*dx/l,a[1]+.184*dz/l],[b[0]-.184*dx/l,b[1]-.184*dz/l]]
# The parallel retaining faces and transverse mouth are visible on p2024_rgb8cm.
edges=[sides(s) for s in sections[1]+sections[2][1:]]
void=Polygon([e[0] for e in edges]+[e[1] for e in reversed(edges)])
overrides=load(data/'curb-survey.json')['overrides']
pavement={}
for kind,plans in load(data/'survey-blocks.json')['streets'].items():
    for i,plan in enumerate(plans):
        pieces=overrides.get(kind,{}).get(str(i),[plan])
        shapes=[Polygon(p[0],p[1:]).buffer(0) for p in pieces]
        if any(p.intersection(void).area>1e-6 for p in shapes):
            pavement.setdefault(kind,{})[i]=[r for p in shapes for r in rings(p.difference(void))]
grid=next(g for g in load(data/'bay-relief.json')['grids'] if g['name']=='city')
old={i:[a,b] for i,a,b in load(data/'survey-shore.json')['coastalCells']['city']}
cells=[];step=grid['step'];cols=grid['cols']
for row in range(grid['rows']-1):
    lat=grid['south']+row*step
    if abs(lat-37.791)>.004:continue
    for col in range(cols-1):
        lon=grid['west']+col*step
        if abs(lon+122.390)>.005:continue
        a,b,c,d=[project(x,y) for x,y in [(lon,lat),(lon+step,lat),(lon,lat+step),(lon+step,lat+step)]]
        if not void.intersects(Polygon([a,b,d,c])):continue
        index=row*cols+col
        halves=[Polygon([a,b,c]),Polygon([b,d,c])]
        if index in old:halves=[unary_union([Polygon(p[0],p[1:]) for p in part]) for part in old[index]]
        cells.append([index,*[rings(h.difference(void)) for h in halves]])
# The curb survey predates the modelled trench. Keep the portions outside the
# perimeter, carrying interpolated normals and curb-ramp fractions to cut ends.
curbs={}
for idx,(src,median,path) in enumerate(load(data/'curb-survey.json')['lines']):
    line=LineString([p[:2] for p in path])
    clip=void.buffer(.04)
    if not line.intersects(clip):continue
    pieces=[]
    for a,b in zip(path,path[1:]):
        seg=LineString([a[:2],b[:2]])
        if seg.length<1e-7:continue
        parts=seg.difference(clip)
        for part in getattr(parts,'geoms',[parts]):
            if part.is_empty or part.geom_type!='LineString':continue
            pair=[]
            for v in part.coords:
                f=seg.project(Point(v),normalized=True)
                pair.append([round(s+(t-s)*f,6) for s,t in zip(a,b)])
            if pieces and pieces[-1][-1]==pair[0]:pieces[-1].extend(pair[1:])
            else:pieces.append(pair)
    curbs[str(src)+':'+str(path[0][0])+','+str(path[0][1])]=pieces
out=dict(sections=sections,pavement=pavement,cells=cells,curbs=curbs)
(data/'folsom-portal.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print('pavement',[(k,list(v)) for k,v in pavement.items()],'terrain cells',len(cells))
