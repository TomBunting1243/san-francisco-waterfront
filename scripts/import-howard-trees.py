"""Rebuild Main–Spear–Steuart curb planting from SF Public Works tkzw-k3nq.
Arguments: cached municipal JSON, USGS CA_SanFrancisco_1_B23 EPT folder.
Needs shapely, laspy/lazrs and numpy. Positions are in scene units (0.06/m).
"""
import json, math, re, sys
from pathlib import Path
import laspy
import numpy as np
from shapely.geometry import Polygon, Point
from shapely.ops import nearest_points, unary_union

data=Path(__file__).resolve().parents[1]/'public/data'
rows=json.loads(Path(sys.argv[1]).read_text())
cache=Path(sys.argv[2])
read=lambda name: json.loads((data/(name+'.json')).read_text())
C,S=.988686,.150004
scale=111320*math.cos(math.radians(37.79554))
def xz(u,v):
    return [round(-25.894+C*u+S*v,6),round(-12.650-S*u+C*v,6)]
def uv(x,z):
    return C*(x+25.894)-S*(z+12.650), S*(x+25.894)+C*(z+12.650)
def geo(lon,lat):
    e,n=(lon+122.39348)*scale,(lat-37.79554)*111320
    return -.03552029735*e+.04836012986*n,.04836012986*e+.03552029735*n
def parts(shape):
    return [shape] if shape.geom_type=='Polygon' else [p for p in shape.geoms if p.geom_type=='Polygon']
def rings(shape):
    return [[[round(x,6),round(z,6)] for x,z in list(r.coords)[:-1]] for r in [shape.exterior,*shape.interiors]]
def outline(u1,u2,v1,v2):
    return Polygon([xz(u1,v1),xz(u2,v1),xz(u2,v2),xz(u1,v2)])

# The 2024 aerial and 2023 ground returns agree at the two streetward gutter
# drops (u=-.425). Keep the surveyed end ramps, and the bayward garage apron.
curbs=read('curb-survey')
runs={};walks=[];cut=[]
for source,lo,a,b,hi,rear in [(3801021,-5.76,-5.49,-.86,-.70,-.665),
                               (3792668,.81,1.00,2.43,2.58,-.695)]:
    inp=next(p for i,_,p in curbs['lines'] if i==source)
    old=sorted([(uv(x,z)[1],uv(x,z)[0],q,nx,nz) for x,z,nx,nz,q in inp])
    vs,us,qs,_,_=np.array(old).T
    stations=sorted(set([*vs,a,b]+([hi] if hi<vs[-1]-.01 else [])))
    path=[]
    for v in stations:
        u=float(np.interp(v,vs,us));n=float(np.clip(min((v-lo)/(a-lo),(hi-v)/(hi-b)),0,1))
        if v==vs[0] or v==vs[-1]:n=0
        p=xz(u+(-.425-u)*n,v);q=float(np.interp(v,vs,qs))
        path.append([*p,0,0,round(q,5)])
    for i,p in enumerate(path):
        if i in (0,len(path)-1):
            p[:]=inp[-1 if i==0 else 0];continue
        start,end=path[i-1],path[i+1];dx,dz=end[0]-start[0],end[1]-start[1];length=math.hypot(dx,dz)
        p[2:4]=[round(dz/length,6),round(-dx/length,6)]
    runs[source]=path[::-1]
    for start,end in zip(path,path[1:]):
        vs0,vs1=uv(*start[:2])[1],uv(*end[:2])[1]
        if vs0>=hi+.0001 or vs1<=lo-.0001:continue
        back=.157 if min(start[4],end[4])<1 else .031
        offset=lambda p,d:[p[0]+p[2]*d,p[1]+p[3]*d]
        # Existing ROW ends at the old virtual walls; the private frontage is
        # also paved. 103 Howard's upper wall is inset again behind its arcade.
        backU=rear if source!=3801021 or vs0>=-3.35 else -.621
        land=[xz(backU,vs0),xz(backU,vs1)]
        walks.append(Polygon([*land,offset(end,-back),offset(start,-back)]).buffer(0))
        cut.append(Polygon([*land,offset(end,.037),offset(start,.037)]).buffer(0))
walk=unary_union(walks);replacement=unary_union(cut)
paving={};survey=read('survey-blocks')['streets'];oldWalk=[]
for kind in ['sidewalk','street','curb']:
    found={}
    for i,original in enumerate(survey[kind]):
        plans=curbs['overrides'].get(kind,{}).get(str(i),[original])
        geoms=[Polygon(p[0],p[1:]).buffer(0) for p in plans if p]
        if kind=='sidewalk':
            oldWalk.extend(g for g in geoms if g.intersects(outline(-2,2,-7,7)))
        if not any(g.intersection(replacement).area>1e-8 for g in geoms):continue
        found[i]=[rings(p) for g in geoms for p in parts(g.difference(replacement)) if p.area>1e-8]
    paving[kind]=found
floor=unary_union([unary_union(oldWalk).difference(replacement),walk])
# Get only the project-cached EPT nodes overlapping the two blocks, through level 7.
R=6378137
def merc(x,z):
    lon=-122.39348+(-.03552029735*x+.04836012986*z)/(.0036*scale)
    lat=37.79554+(.04836012986*x+.03552029735*z)/(.0036*111320)
    return R*math.radians(lon),R*math.asinh(math.tan(math.radians(lat)))
bounds=json.loads((cache/'ept.json').read_text())['bounds']
corner=np.array([merc(x,z) for x in [-28,-23] for z in [-20,-5]])
west,south=corner.min(axis=0);east,north=corner.max(axis=0)
points=[]
for filename in sorted(cache.glob('ept-data_*.laz')):
    level,i,j,_=map(int,filename.stem.split('_')[-1].split('-'))
    step=(bounds[3]-bounds[0])/2**level
    xx,yy=bounds[0]+i*step,bounds[1]+j*step
    if level>7 or xx+step<west or yy+step<south or xx>east or yy>north:continue
    cloud=laspy.read(filename)
    x,z=geo(np.rad2deg(np.asarray(cloud.x)/R),np.rad2deg(np.arctan(np.sinh(np.asarray(cloud.y)/R))))
    inside=(x>-28)&(x<-23)&(z>-20)&(z<-5);u,v=uv(x[inside],z[inside])
    points.append(np.column_stack((u,v,np.asarray(cloud.z)[inside],np.asarray(cloud.classification)[inside])))
U,V,H,K=np.concatenate(points).T
trees=[];taxa=[];cornerIDs={192188,192189,190289,189948}
for row in sorted(rows,key=lambda r:int(r['treeid'])):
    tid=int(row['treeid']);street=row.get('onstreet','').lower()
    if tid not in cornerIDs and street!='howard st' or 'latitude' not in row:continue
    x,z=geo(float(row['longitude']),float(row['latitude']));u,v=uv(x,z)
    if abs(u)>1.2 or abs(v)>5.8:continue
    # Two empty sites, four colocated 75 Howard records at the tower site,
    # an unresolved fifth 75 Howard stem and one ash inside the 201 driveway.
    if tid in [255955,255956,173592,173593,173594,173595,66475,192196]:continue
    species=row['species'].split(' ::')[0];kind=row['siteinfo'].split(':')[-1].strip().lower()
    ft=float(re.findall(r'\d+',row.get('plotsize','3'))[0]);half=ft*.3048*.03
    guess=Point(x,z)
    if street=='howard st' and u<0:
        guess=Point(xz(-.489 if kind=='pot' else -.498,v))
    safe=floor.buffer(-half*1.36-.003)
    p=nearest_points(guess,safe)[1]
    if p.distance(guess)>.19:raise ValueError(f'Unsupported {tid} shifted {p.distance(guess)}')
    # Road-facing source swath excludes façades. Heights in overlapping crowns
    # characterize that tree station, not a segmented individual LiDAR crown.
    c=u if u>0 else -.50
    ground=np.median(H[(K==2)&(abs(V-v)<.27)&(abs(U-c)<.65)])
    vertical=H-ground;mask=(abs(V-v)<.14)&((U-c)*np.sign(u)<.05)&((U-c)*np.sign(u)>-.21)
    if tid in cornerIDs:
        mask=(abs(U-u)<.13)&((V-v)*np.sign(v)<-.04)&((V-v)*np.sign(v)>-.20)
    samples=vertical[mask&(K==1)&(vertical>2)&(vertical<17)]
    dbh=int(row.get('mapdbh',0))
    h=round(float(np.percentile(samples,95)),1) if len(samples)>=9 else round(3+math.sqrt(dbh or 9)*1.45,1)
    if tid==190328:h=3.6 # isolated tall return at lamp; adjoining measured pot row median
    if species not in taxa:taxa.append(species)
    trees.append([tid,round(p.x,5),round(p.y,5),taxa.index(species),dbh,h,ft,kind=='pot'])
out={'taxa':taxa,'trees':trees,'curbs':runs,'walk':[rings(p) for p in parts(walk) if p.area>1e-8],'paving':paving}
(data/'howard-trees.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
