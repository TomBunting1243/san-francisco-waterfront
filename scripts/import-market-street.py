"""Pack the mapped F-line, curb crossings and DPW street trees for lower Market.
Input: cached OSM map and DataSF tkzw-k3nq extracts; see the reference audit.
"""
import json
import math
import sys
from pathlib import Path
from shapely.geometry import LineString, Polygon, Point, box
from shapely.ops import unary_union

cache=Path(sys.argv[1]);dest=Path(__file__).resolve().parents[1]/'public/data'
osm=json.loads((cache/'embarcadero-rail-map.json').read_text())['elements']
def coord(lon,lat):
    e=(float(lon)+122.39348)*111320*math.cos(math.radians(37.79554));n=(float(lat)-37.79554)*111320
    return [round(-.03552029735*e+.04836012986*n,4),round(.04836012986*e+.03552029735*n,4)]
nodes={n['id']:coord(n['lon'],n['lat']) for n in osm if n['type']=='node'}
axis=LineString([(-1.65,-9.55),(-9.5,-62)])
region=axis.buffer(1.75,cap_style=2)
loop=unary_union([region,box(-9,-11,.5,-5.3)])
tracks=[];platforms=[];crossings=[];entrances=[];trees=[]
steps={}
for w in osm:
    if w.get('tags',{}).get('highway')=='steps':
        ids=w['nodes'];steps[ids[0]]=ids[-1];steps[ids[-1]]=ids[0]
for e in osm:
    t=e.get('tags',{})
    if e['type']=='node' and t.get('railway')=='subway_entrance' and region.covers(Point(nodes[e['id']])):
        end=steps.get(e['id'])
        if end in nodes: entrances.append([e['id'],nodes[e['id']],nodes[end]])
    if e['type']!='way':continue
    ps=[nodes[n] for n in e['nodes'] if n in nodes]
    if len(ps)<2:continue
    if t.get('railway')=='tram' and (t.get('name')=='Muni F' or 'cable_tram' in t):
        cable='cable_tram' in t
        geom=LineString(ps).intersection(region.buffer(.15) if cable else loop)
        parts=geom.geoms if geom.geom_type=='MultiLineString' else [geom]
        for part in parts:
            if part.length>.05:tracks.append([e['id'],int(cable),[[round(v,4) for v in p] for p in part.simplify(.006).coords]])
    if t.get('railway')=='platform' and t.get('tram')=='yes' and t.get('level','0')=='0' and ps[0]==ps[-1] and len(ps)>3 and region.covers(Polygon(ps).centroid):
        platforms.append([e['id'],t.get('shelter')=='yes',ps])
    if t.get('footway')=='crossing' and t.get('crossing:markings') in ('zebra','ladder','ladder:skewed') and len(ps)>=2 and region.covers(LineString(ps).centroid):
        crossings.append([e['id'],ps])
for row in json.loads((cache/'market-tree-survey.json').read_text()):
    if row.get('onstreet','').lower()!='market st' or 'stump' in row.get('species','').lower() or row.get('planttype')!='Tree':continue
    p=coord(row['longitude'],row['latitude'])
    if .52<axis.distance(Point(p))<1.9 and -61<p[1]<-10.3:
        trees.append([int(row['treeid']),p,row['species'].split(' ::')[0],float(row.get('mapdbh') or 0)])
out={'source':'OpenStreetMap contributors, ODbL; SF Public Works Street Tree Inventory (tkzw-k3nq)','tracks':tracks,'platforms':platforms,'crossings':crossings,'entrances':entrances,'trees':trees}
(dest/'market-street.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print({k:len(v) for k,v in out.items() if isinstance(v,list)})
