"""Clip Sue Bierman land cover to the 2023 USGS bare-earth survey.
Requires laspy[lazrs], numpy, scipy, and Shapely 2.1 or later.
Uses the city's existing OSM park, playground, street and planting records.
The city transform and LiDAR tile scheme match import-plaza-survey.py.
"""
from pathlib import Path
import argparse,json,math
import numpy as np,laspy
from scipy.spatial import cKDTree
from shapely import Polygon,LineString,box,union_all,constrained_delaunay_triangles,get_parts
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('cache',type=Path,help='Directory containing ept.json and cached ept-data_*.laz')
args=parser.parse_args()
base=Path(__file__).resolve().parents[1]
cache=args.cache
bounds=json.loads((cache/'ept.json').read_text())['bounds'];a,b=-.03552029735,.04836012986;east=111320*math.cos(math.radians(37.79554))
def merc(x,z):
 lon=-122.39348+(a*x+b*z)/(.0036*east);lat=37.79554+(b*x-a*z)/(.0036*111320)
 return [6378137*math.radians(lon),6378137*math.asinh(math.tan(math.radians(lat)))]
corners=np.array([merc(x,z) for x in (6,18) for z in (-20,-5)]);lo=corners.min(0);hi=corners.max(0);pts=[]
for path in cache.glob('ept-data_*.laz'):
 d,ix,iy,_=map(int,path.stem.split('_')[1].split('-'));size=(bounds[3]-bounds[0])/2**d
 ox,oy=bounds[0]+ix*size,bounds[1]+iy*size
 if ox>hi[0] or ox+size<lo[0] or oy>hi[1] or oy+size<lo[1]:continue
 cloud=laspy.read(path);keep=np.asarray(cloud.classification)==2
 e=(np.rad2deg(np.asarray(cloud.x)[keep]/6378137)+122.39348)*east
 n=(np.rad2deg(np.arctan(np.sinh(np.asarray(cloud.y)[keep]/6378137)))-37.79554)*111320
 x=a*e+b*n;z=b*e-a*n;v=(x>=5.9)&(x<18.1)&(z>=-20.1)&(z< -4.9)
 pts.append(np.column_stack([x[v],z[v],np.asarray(cloud.z)[keep][v]]))
pts=np.vstack(pts);tree=cKDTree(pts[:,:2]);step=.25;x0=6;z0=-20;w=49;h=61
coords=[(x0+i*step,z0+j*step) for j in range(h) for i in range(w)]
dist,index=tree.query(coords,k=12);ground=np.round(np.median(pts[index,2],axis=1)*100).astype(int);print(len(pts),min(ground),max(ground),'p95 radius',np.quantile(dist[:,-1],.95),flush=True)
l=json.loads((base/'public/data/waterfront-landscape.json').read_text())
areas=l['areas'];geom={a['id']:Polygon(a['p']).buffer(0) for a in areas}
park=union_all([geom[175516006],geom[585983823]]).difference(geom[941854099]); paths=union_all([LineString(p['p']).buffer(min(.25,max(.08,float(p.get('width') or 2.4)*.06))/2) for p in l['paths'] if p.get('bridge')!='yes' and float(p.get('layer') or 0)==0])
remaining=park;layers=[]
# Clip a shared ground surface into adjoining material patches. No stacked turf or path meshes.
for name,mask in [('play',geom[225380578]),('walk',paths),('bush',union_all([geom[a['id']] for a in areas if a['kind']=='scrub'])),('turf',union_all([geom[a['id']] for a in areas if a['kind']=='grass']))]:
 piece=remaining.intersection(mask);remaining=remaining.difference(mask);layers.append(piece)
layers.append(remaining)
verts=[];lookup={};indices=[[] for _ in layers]
for j in range(h-1):
 for i in range(w-1):
  xx,zz=x0+i*step,z0+j*step
  # Split on the two measured grid planes, shared by all abutting pigments.
  for coords in [[(xx,zz),(xx+step,zz),(xx,zz+step)],[(xx+step,zz),(xx+step,zz+step),(xx,zz+step)]]:
   face=Polygon(coords)
   for n,layer in enumerate(layers):
    if not layer.intersects(face):continue
    for tri in get_parts(constrained_delaunay_triangles(layer.intersection(face))):
     if tri.area<1e-9:continue
     v=list(tri.exterior.coords)[:3]
     if (v[1][0]-v[0][0])*(v[2][1]-v[0][1])-(v[1][1]-v[0][1])*(v[2][0]-v[0][0])>0:v.reverse()
     for x,z in v:
      key=(round(x*10000),round(z*10000))
      if key not in lookup:lookup[key]=len(verts)//2;verts.extend(key)
      indices[n].append(lookup[key])
print('verts',len(verts)//2,'tris',sum(map(len,indices))//3)
out=dict(x0=x0,z0=z0,step=step,w=w,h=h,cm=ground.tolist(),xz=verts,indices=indices)
(base/'public/data/bierman-ground.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
