"""Extend the two streets seen from the Ferry Building with cached survey records.

Use the same reference-survey directory and Shapely 2 interpreter as
import-survey-blocks.py. Market uses the downtown datum. The north quay follows the regional
relief at road cross sections taken every two model units.
"""
import json
import math
import sys
from pathlib import Path

from shapely import set_precision
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import polygonize, substring, unary_union

project = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
output = project/'public/data/sightline-streets.json'
lng0, lat0 = -122.39348, 37.79554
east = 111320 * math.cos(math.radians(lat0))
a, b, c, d = -.03552029735*east, .04836012986*111320, .04836012986*east, .03552029735*111320
affine = [a,b,c,d,-lng0*a-lat0*b,-lng0*c-lat0*d]

def xy(lon, lat):
    return a*(float(lon)-lng0)+b*(float(lat)-lat0), c*(float(lon)-lng0)+d*(float(lat)-lat0)

def read(name):
    return json.loads((source/name).read_text())

def parts(geom, kind):
    if geom.is_empty:
        return []
    if geom.geom_type == kind:
        return [geom]
    return [p for g in getattr(geom,'geoms',[]) for p in parts(g,kind)]

def coordinates(line):
    return [[round(x,3),round(z,3)] for x,z in line.coords]

# Preserve intersecting corners and crossings on both sides of the main street.
market = LineString([(-9.50,-62),(-14.76,-96.5)]).buffer(2.22,cap_style='square').intersection(box(-19,-96.5,-6,-62))
waterfront=json.loads((project/'public/data/sf-waterfront.json').read_text())
carriageways=unary_union([LineString(r['p']) for r in waterfront['roads'] if r.get('name')=='The Embarcadero'])
stations=list(range(64,97,2))
def center(x):
    section=carriageways.intersection(LineString([(x,-25),(x,5)]))
    zz=[p.y for p in parts(section,'Point')]
    return round((min(zz)+max(zz))*.5,3)
axis=[[x,center(x)] for x in stations]
quay=box(35,-4.96,66,-.72).union(LineString(axis).buffer(2.12).intersection(box(66,-25,96,5)))
area = market.union(quay)
context = area.buffer(22)
def records(name):
    for f in read(name)['features']:
        geom=affine_transform(shape(f['geometry']),affine)
        if context.intersects(geom):
            yield f['properties'],geom if geom.is_valid else geom.buffer(0)

rows=unary_union([g for p,g in records('row.geojson') if p['LAYER'].strip() in ('STREETS','Streets_Pedestri','PRIVATE','') and p['ST_TYPE'].strip() not in ('PLZ','TUNL')])
curbs=[]; islands=[]; port_curb=None
for p,g in records('curbs.geojson'):
    if p['INT_Z']==0 and p['STATUS']=='Active':
        edge=set_precision(g,.001)
        curbs.append(edge)
        if p['OBJECTID']==3851628:port_curb=edge
        if p['CBB_TYPE']=='ISL':
            islands.append(edge)
kerb=unary_union(curbs)
blocks=[p for p in polygonize(kerb) if p.area>.014 and p.intersection(rows).area<.66*p.area]
walk=unary_union(blocks+list(polygonize(unary_union(islands))))
paved=rows.intersection(area)
street=paved.difference(walk)
sidewalk=paved.intersection(walk)
# The 2024 aerial resolves a broad concrete promenade between this long
# unclosed block face and the two Pier 29–31 bulkhead survey parts. It crosses
# the edge of the ROW polygons, so use the building foot as its inner limit.
bay_edge=port_curb.buffer(.012,quad_segs=1).intersection(box(80.97,-6,91.94,-1))
sections={80.97,83.62,91.94,*[x for x in stations if 80.97<x<91.94]}
for poly in parts(bay_edge,'Polygon'):
    sections.update(round(x,3) for x,_ in poly.exterior.coords)
pier_edge=[]; pier_road_edge=[]
for x in sorted(sections):
    section=bay_edge.intersection(LineString([(x,-6),(x,-1)]))
    if section.is_empty:continue
    pier_edge.append([x,round(section.bounds[3],3)])
    pier_road_edge.append([x,round(section.bounds[1],3)])
pier_wall=[[80.97,-2.19],[83.62,-2.666],[83.62,-2.77],[91.94,-4.36]]
pier_walk=Polygon([*pier_edge,*reversed(pier_wall)])
street=street.difference(pier_walk)
sidewalk=sidewalk.difference(pier_walk)
def polygons(geom):
    out=[]
    pieces=[]
    for polygon in parts(geom,'Polygon'):
        lo,_,hi,_=polygon.bounds
        boundaries=[lo,*[x for x in [35,36,*stations] if lo<x<hi],hi]
        for left,right in zip(boundaries,boundaries[1:]):
            pieces.extend(parts(polygon.intersection(box(left,-200,right,200)),'Polygon'))
    for p in pieces:
        if p.area<.00008: continue
        for simple in parts(set_precision(p.simplify(.007),.001),'Polygon'):
            out.append([coordinates(r)[:-1] for r in [simple.exterior,*simple.interiors]])
    return out

osm=read('embarcadero-rail-map.json')['elements']
nodes={e['id']:xy(e['lon'],e['lat']) for e in osm if e['type']=='node'}
crossings=[]; rails=[]
original_tracks=json.loads((project/'public/data/embarcadero-tracks.json').read_text())
outer_tracks=[[],[]]
for index,way_id in enumerate([122595702,706534251]):
    way=next(e for e in osm if e['type']=='way' and e['id']==way_id)
    full=LineString([nodes[n] for n in way['nodes'] if n in nodes])
    end=original_tracks['tracks'][index][-1]
    station=full.project(Point(end))
    beyond=substring(full,station,full.length if full.coords[-1][0]>full.coords[0][0] else 0)
    retained=parts(beyond.intersection(box(end[0]-.001,-25,96,5)),'LineString')
    if retained:
        outer_tracks[index]=[p for p in coordinates(retained[0]) if p[0]>end[0]+.001]
core_market=json.loads((project/'public/data/market-street.json').read_text())
existing_crossings={i for i,_ in core_market['crossings']}
existing_rails={i:LineString(line) for i,cable,line in core_market['tracks'] if not cable}
for e in osm:
    if e['type']!='way': continue
    t=e.get('tags',{})
    rail=t.get('railway')=='tram' and t.get('name')=='Muni F'
    crossing=t.get('footway')=='crossing' and t.get('crossing:markings') in ('zebra','ladder','ladder:skewed')
    if not rail and (not crossing or e['id'] in existing_crossings): continue
    points=[nodes[n] for n in e['nodes'] if n in nodes]
    if len(points)<2: continue
    # The northern waterfront rails already exist. Retain only the missing
    # Market running rails, and restrict paint to the measured vehicle surface.
    clipped=LineString(points).intersection(market if rail else street)
    if rail and e['id'] in existing_rails:
        # Join the already-built end station exactly at the cropped diagonal boundary.
        path=LineString(points)
        existing=existing_rails[e['id']]
        end=min(existing.coords,key=lambda p:p[1]); station=path.project(Point(end))
        outer=substring(path,station,path.length) if points[0][1]>points[-1][1] else substring(path,0,station)
        clipped=outer.intersection(market.buffer(.04).intersection(box(-19,-96.5,-6,-61.95)))
    target=rails if rail else crossings
    for segment in parts(clipped,'LineString'):
        if segment.length>(.02 if rail else .12):
            target.append([e['id'],coordinates(segment.simplify(.003))])

# Mapways locate crossing extents. Their dash rhythm is generalized for distance.
bars=[]
for _,path in crossings:
    line=LineString(path)
    count=max(2,round(line.length/.095))
    for j in range(count):
        station=(j+.5)*line.length/count
        u=line.interpolate(station-.015);v=line.interpolate(station+.015)
        bars.extend(polygons(LineString([u,v]).buffer(.087,cap_style='flat').intersection(street)))

trees=[]
for record in read('market-tree-survey.json'):
    if record.get('planttype')!='Tree' or record.get('onstreet','').lower()!='market st' or 'stump' in record.get('species','').lower():continue
    x,z=xy(record['longitude'],record['latitude'])
    if market.contains(Point(x,z)) and sidewalk.covers(Point(x,z)):
        trees.append([int(record['treeid']),round(x,3),round(z,3),int(float(record.get('mapdbh') or 0))])
# The old centerline strips terminate where the new surface takes ownership.
# Only affected paths are overridden, in original survey order.
fallback=json.loads((project/'public/data/survey-blocks.json').read_text())['outsideRoads']
remaining={}
for i,road in enumerate(fallback):
    line=LineString(road['p'])
    if line.intersection(area).length>.0001:
        remaining[str(i)]=[coordinates(l) for l in parts(line.difference(area),'LineString') if l.length>.01]
out=dict(sources=['SFMTA right-of-way streetblocks 6 and curbs 1','SF Public Works tkzw-k3nq','OpenStreetMap contributors, ODbL'],street=polygons(street),sidewalk=polygons(sidewalk),
    curb=polygons(kerb.buffer(.012,quad_segs=1).intersection(paved)),bars=bars,rails=rails,trees=trees,remaining=remaining,gradeAxis=axis,outerTracks=outer_tracks,pierWalkEdge=pier_edge,pierRoadEdge=pier_road_edge,pierWalk=polygons(pier_walk))
output.write_text(json.dumps(out,separators=(',',':'))+'\n')
print({k:len(v) for k,v in out.items()})
