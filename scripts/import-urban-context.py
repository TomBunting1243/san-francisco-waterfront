#!/usr/bin/env python3
"""Bake SFGIS measured roofs, SF Public Works active streets and newer Mission Bay OSM.
Run using Shapely 2: python scripts/import-urban-context.py <reference-survey directory>.
Inputs use DataSF datasets ynuv-fyni and 3psu-pn9h, bounding box 37.744,-122.452..37.815,-122.371.
"""
import base64
import json
import math
import re
import struct
import sys
from collections import defaultdict
from pathlib import Path

from shapely import STRtree
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import substring, unary_union

data = Path(__file__).resolve().parents[1] / 'public/data'
source = Path(sys.argv[1])
read = lambda path: json.loads(path.read_text())
base, south, approach, survey, relief = [read(data/(s+'.json')) for s in
    ('sf-waterfront','south-beach','approach-soma','survey-blocks','bay-relief')]
lat, lon = base['origin']
east = 111320*math.cos(math.radians(lat))
a,b,c,d = -.03552029735*east,.04836012986*111320,.04836012986*east,.03552029735*111320
matrix = [a,b,c,d,-lon*a-lat*b,-lon*c-lat*d]
def project(g):
    return affine_transform(g,matrix)
def pieces(g,kind):
    if g.geom_type==kind and not g.is_empty:
        yield g
    else:
        for v in getattr(g,'geoms',[]): yield from pieces(v,kind)
def solid(coords):
    return Polygon(coords).buffer(0)
def overlaps(poly,tree,pieces):
    return any(poly.intersection(pieces[i]).area>min(poly.area*.22,pieces[i].area*.40)
        for i in tree.query(poly,predicate='intersects'))

existing = [box(*survey['window'])]
# The core already contains hand-built terminals, wharves, piers and moored vessels.
existing.append(box(-110, 0, 72, 40))
for v in base['buildings']:
    p=solid(v['p'])
    x,z = [sum(q[i] for q in v['p'])/len(v['p']) for i in (0,1)]
    if -95<x<72 and -112<z<26 and p.area>(.08 if v.get('part') else 1.2):existing.append(p)
existing.extend(solid(v['p']) for v in south['buildings'])
existing.extend(solid(v['points']) for v in approach['buildings'])
existing.extend(Polygon(r[0],r[1:]).buffer(0) for h,r in survey['buildings'])
existing.extend(project(solid(v[1])) for v in relief['buildings'] if v[1][0][0]<-122.38)
existing.extend(solid(south['features'][k]) for k in ('stadium','park','chinaBasin','plaza'))
existing.extend(solid(v['p']) for v in base['parks'] if len(v['p'])>3)
existing_tree=STRtree(existing)

osm=read(source/'urban-mission-bay.json')['elements']
nodes={v['id']:(v['lon'],v['lat']) for v in osm if v['type']=='node'}
ways={v['id']:v for v in osm if v['type']=='way'}
def osmring(w):
    return project(solid([nodes[i] for i in w['nodes']]))
def metres(tag):
    if not tag:return 0.
    match=re.fullmatch(r'([\d.]+)\s*(m|ft|\x27)?',str(tag).strip())
    return float(match[1])*(.3048 if match[2] in ("ft","'") else 1) if match else 0.

tiles=defaultdict(lambda:[bytearray(),bytearray()])
counts=defaultdict(int)
names={}
bounds={}
colors=[]
def color_index(tag):
    if not tag:return 0
    css=tag.lower().replace('_','')
    if css not in colors:colors.append(css)
    return colors.index(css)+1
def expand(origin,g):
    x,z,xx,zz=g.bounds
    v=bounds.setdefault(origin,[x,z,xx,zz])
    v[:]=min(v[0],x),min(v[1],z),max(v[2],xx),max(v[3],zz)
def tile(poly):
    x,z=poly.centroid.coords[0]
    return math.floor(x/36)*36,math.floor(z/36)*36
def packpath(path,origin):
    ints=[round((v-origin[i])*100) for pt in path for i,v in enumerate(pt[:2])]
    return struct.pack('<H'+'h'*len(ints),len(path),*ints)
def building(p,h,material=0,name=None,bottom=0,wall=0,roof=0,levels=0):
    if not .7<h<350 or p.area<.033: return
    for part in pieces(p.simplify(.035,preserve_topology=True),'Polygon'):
        part=orient(part)
        o=tile(part)
        expand(o,part)
        rings=[list(r.coords)[:-1] for r in (part.exterior,*part.interiors)]
        buf=tiles[o][0]
        if name:names[name]=[round(part.centroid.x,2),round(part.centroid.y,2),round(h,2)]
        buf.extend(struct.pack('<HHBBBBB',round(h*100),round(bottom*100),material,wall,roof,levels,len(rings)))
        for ring in rings:buf.extend(packpath(ring,o))
        counts['buildings']+=1

modern=[]
parts=[]
bases=[]
parkland=[]
palette={'glass':1,'brick':2,'concrete':3,'metal':4,'wood':5}
def add_modern(w,p):
    t=w.get('tags',{})
    if p.is_empty or not p.is_valid:return
    if t.get('leisure') in ('park','pitch','playground') or t.get('natural')=='water':
        parkland.append(p)
    if not (t.get('building') or t.get('building:part')) or overlaps(p,existing_tree,existing):return
    h=metres(t.get('height')) or metres(t.get('building:levels'))*3.1
    if h<=0:return
    color=t.get('building:colour','').lower()
    material=palette.get(t.get('building:material'),{'red':2,'brown':2,'white':3,'grey':4,'tan':5}.get(color,0))
    bottom=metres(t.get('min_height')) or metres(t.get('building:min_level'))*3.1
    if bottom>=h:return
    detail=(color_index(t.get('building:colour')),color_index(t.get('roof:colour')),min(255,round(metres(t.get('building:levels')))))
    if t.get('building:part'):parts.append((p,h,material,t.get('name'),bottom,*detail))
    else:bases.append((p,h,material,t.get('name'),*detail))
# Multipolygons frequently have actual open courtyards. Resolve closed building relations first.
relation_ways=set()
for v in osm:
    if v['type']!='relation' or not v.get('tags',{}).get('building'):continue
    members=[m for m in v['members'] if m['type']=='way' and m['ref'] in ways]
    if not members or not all(ways[m['ref']]['nodes'][0]==ways[m['ref']]['nodes'][-1] for m in members):continue
    outer=unary_union([osmring(ways[m['ref']]) for m in members if m['role']=='outer'])
    inner=unary_union([osmring(ways[m['ref']]) for m in members if m['role']=='inner'])
    for p in pieces(outer.difference(inner),'Polygon'):add_modern(v,p)
    relation_ways.update(m['ref'] for m in members)
for key,w in ways.items():
    if key in relation_ways or w['nodes'][0]!=w['nodes'][-1] or len(w['nodes'])<4:continue
    add_modern(w,osmring(w))
# Preserve setback terraces and open courtyards where GIS outlines share OSM roof parts.
part_shapes=[v[0] for v in parts]
part_tree=STRtree(part_shapes)
for p,h,m,n,bottom,*detail in parts:
    modern.append(p)
    building(p,h,m,n,bottom,*detail)
for p,h,m,n,*detail in bases:
    modern.append(p)
    if n:names[n]=[round(p.centroid.x,2),round(p.centroid.y,2),round(h,2)]
    covered_parts=[part_shapes[i] for i in part_tree.query(p) if p.covers(part_shapes[i].representative_point())]
    # Keep underlying walls below overhanging strata and recess the parent roof to the lowest terrace.
    residual=p.difference(unary_union(covered_parts))
    for shell in pieces(residual,'Polygon'):building(shell,h,m,None,0,*detail)
counts['osm']=counts['buildings']
counts['osmParts']=len(parts)
mask=modern+parkland
mask_tree=STRtree(mask)
for f in read(source/'urban-buildings.geojson')['features']:
    h=float(f['properties'].get('hgt_median_m') or 0)
    if h<=.7:continue
    for p in pieces(project(shape(f['geometry'])).buffer(0),'Polygon'):
        if not overlaps(p,existing_tree,existing) and not overlaps(p,mask_tree,mask):
            building(p,h)
            counts['survey']=counts['buildings']-counts['osm']

# Drop centerlines already represented by authored pavement. Only clip the streets,
# never the municipal roofs. Both authored freeway termini get exact shared coordinates.
covered=box(*survey['window'])
roads=[LineString(v['points']).buffer(v['width']*.55) for v in approach['roads']]
roads+= [LineString(v['p']).buffer(.48) for v in south['roads'] if len(v['p'])>1]
roads+= [LineString(v['p']).buffer(.52) for v in base['roads'] if len(v['p'])>1
         and v.get('kind') in ('residential','primary','secondary','tertiary','service','unclassified','living_street')
         and covered.buffer(17).contains(LineString(v['p']).centroid)]
streetmask=unary_union([covered,*roads])
freewaymask=unary_union([LineString([v[:2] for v in r['points']]).buffer(1.1) for r in (approach['east'],approach['west'],*approach['ramps'])])
joins={}
def road(line,kind):
    pts=list(line.simplify(.035).coords)
    if len(pts)<2 or line.length<.23:return
    o=tile(line)
    expand(o,line)
    tiles[o][1].extend(bytes([kind])+packpath(pts,o))
    counts['roads']+=1
for f in read(source/'urban-streets.geojson')['features']:
    props=f['properties']
    layer=props.get('layer')
    if layer not in ('STREETS','PRIVATE','FREEWAYS','STREETS_PEDESTRI'):continue
    line=project(shape(f['geometry']))
    kind=int(props.get('classcode') or 5)
    if layer=='STREETS_PEDESTRI':kind=9
    elif layer=='PRIVATE':kind=10
    elif layer!='FREEWAYS' and kind not in (2,3,4,5):kind=5
    if layer=='FREEWAYS':
        for route,edge in [('I-80 WESTBOUND','west'),('I-80 EASTBOUND','east')]:
            end=Point(approach[edge]['points'][-1][:2])
            if props.get('streetname')!=route or end.distance(line)>1.1:continue
            near=line.project(end)
            left=substring(line,0,near);right=substring(line,near,line.length)
            inland=min((left,right),key=lambda x:x.centroid.y)
            pts=list(inland.coords)
            if Point(pts[-1]).distance(end)<Point(pts[0]).distance(end):pts.reverse()
            pts[0]=end.coords[0]
            road(LineString(pts),7 if edge=='west' else 8)
            joins[edge]=pts
            break
        else:
            for part in pieces(line.difference(freewaymask),'LineString'):road(part,6 if kind==6 else 1)
    else:
        for part in pieces(line.difference(streetmask),'LineString'):road(part,kind)
assert set(joins)=={'east','west'}, joins
output={'sources':['https://data.sf.gov/d/ynuv-fyni','https://data.sf.gov/d/3psu-pn9h','https://www.openstreetmap.org/copyright'],
        'counts':dict(counts),'colors':colors,'landmarks':names,'joins':joins,
        'tiles':[[x,z,*[base64.b64encode(v).decode() for v in buffers],[round(q,2) for q in bounds[(x,z)]]] for (x,z),buffers in sorted(tiles.items())]}
(data/'urban-context.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
print(dict(counts),len(tiles),'tiles,',len(names),'named buildings')
