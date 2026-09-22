#!/usr/bin/env python3
"""OSM-derived data is ODbL 1.0. See references/WATERFRONT-REFERENCE-AUDIT.md."""
import argparse, datetime, json, math
from pathlib import Path
from urllib.request import urlopen

parser = argparse.ArgumentParser(description="Rebuild mapped waterfront planting and paths from public OSM data")
parser.add_argument("--input", type=Path, help="Cached OSM map.json response (otherwise fetch public API)")
parser.add_argument("--captured", default=datetime.date.today().isoformat())
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source_url = "https://api.openstreetmap.org/api/0.6/map.json?bbox=-122.402,37.79,-122.387,37.807"
raw=json.loads(args.input.read_text()) if args.input else json.load(urlopen(source_url, timeout=60))
old=json.loads((root / "public/data/sf-waterfront.json").read_text())
nodes={e['id']:e for e in raw['elements'] if e['type']=='node'}; ways={e['id']:e for e in raw['elements'] if e['type']=='way'}
def ll(n):return [(n['lon']-old['origin'][1])*111320*math.cos(math.radians(old['origin'][0])),(n['lat']-old['origin'][0])*111320,1]
pairs=[]
for b in old['buildings']:
 if b['id'] in [25489482,25478417,558731934,91913148]:
  way=ways[b['id']]
  for nid,p in zip(way['nodes'],b['p']):pairs.append((ll(nodes[nid]),p))
def fit(col):
 a=[[sum(v[i]*v[j] for v,p in pairs) for j in range(3)]+[sum(v[i]*p[col] for v,p in pairs)] for i in range(3)]
 for i in range(3):
  pivot=max(range(i,3),key=lambda r:abs(a[r][i]));a[i],a[pivot]=a[pivot],a[i]
  scale=a[i][i];a[i]=[v/scale for v in a[i]]
  for j in range(3):
   if j!=i:
    scale=a[j][i];a[j]=[v-scale*w for v,w in zip(a[j],a[i])]
 return [a[i][3] for i in range(3)]
transform=[fit(0),fit(1)]
def project(n):return [round(sum(a*b for a,b in zip(ll(n),row)),3) for row in transform]
error=max(math.dist(project(nodes[nid]),p) for b in old['buildings'] if b['id'] in [25489482,25478417,558731934,91913148] for nid,p in zip(ways[b['id']]['nodes'],b['p']))
assert error<.003,error
areas=[]; paths=[];trees=[]
def coords(w):return [project(nodes[n]) for n in w['nodes'] if n in nodes]
def within(p):return -48<p[0]<70 and -37<p[1]<2
for e in raw['elements']:
 t=e.get('tags',{})
 if e['type']=='node' and t.get('natural')=='tree':
  p=project(e)
  if within(p):trees.append({'id':e['id'],'p':p,'species':t.get('species') or t.get('genus',''),'height':t.get('height'),'diameter':t.get('diameter_crown')})
 if e['type']!='way':continue
 p=coords(e)
 if len(p)<2:continue
 c=[sum(a[j] for a in p)/len(p) for j in [0,1]]
 if not within(c):continue
 if t.get('highway') in ['footway','path','steps','pedestrian'] and t.get('footway')!='sidewalk':paths.append({'id':e['id'],'kind':t['highway'],'p':p,'layer':t.get('layer','0')})
 if t.get('leisure') in ['pitch','swimming_pool','playground'] or t.get('landuse') in ['grass','flowerbed'] or t.get('natural') in ['scrub','grassland'] or e['id'] in [175516006,585983823,941854099,32946402]:areas.append({'id':e['id'],'name':t.get('name',''),'kind':'park' if e['id'] in [175516006,585983823] else 'park-hole' if e['id']==941854099 else t.get('leisure') or t.get('landuse') or t.get('natural'),'sport':t.get('sport'),'p':p})
for path in paths:
 t=ways[path['id']].get('tags',{})
 path.update({k:t[k] for k in ['level','bridge','width','surface'] if k in t})
# Embarcadero Center's block parcels are mapped as landuse retail/commercial,
# and the existing geometry misses the pedestrian podiums entirely.
for e in raw['elements']:
 if e['type']!='way':continue
 t=e.get('tags',{});p=coords(e)
 if len(p)<4:continue
 c=[sum(a[j] for a in p)/len(p) for j in [0,1]]
 if 1<c[0]<19 and -35<c[1]<-7 and (t.get('landuse') or t.get('building')):
  if e['id'] in [32612628,32612692,32612700,32612730]:areas.append({'id':e['id'],'name':t['name'],'kind':'podium','sport':None,'p':p})
result={'source':'OpenStreetMap contributors','license':'ODbL 1.0','sourceUrl':source_url,'captured':args.captured,'projectionMaxError':round(error,6),'areas':areas,'paths':paths,'trees':trees}
(root / "public/data/waterfront-landscape.json").write_text(json.dumps(result,separators=(",",":")))
print(json.dumps({"areas":len(areas),"paths":len(paths),"trees":len(trees),"projectionMaxError":error}))
