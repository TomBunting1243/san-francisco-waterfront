"""Extract roof terraces from USGS's 2023 San Francisco EPT. Raw tiles stay in the supplied cache.
Dependencies: numpy, scipy, shapely 2, rasterio, laspy[lazrs]. One scene unit = 16.67 m.

Run python3 scripts/import-downtown-roofs.py <survey-directory>/san-francisco-2023.
The survey directory also supplies downtown-parcels.geojson (SF Planning),
downtown-assessor.json (Assessor roll), and embarcadero-rail-map.json (OSM ways).
The reference audit identifies each source. Only the processed roof data ships.
"""
import json
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

import laspy
import numpy as np
from affine import Affine
from rasterio.features import geometry_mask, shapes
from scipy.ndimage import distance_transform_edt, median_filter, label
from shapely.geometry import Polygon, shape, mapping
from shapely.geometry.polygon import orient
from shapely import STRtree
from shapely.affinity import affine_transform

DATA = Path(__file__).resolve().parents[1] / "public/data"
CACHE = Path(sys.argv[1])
CACHE.mkdir(parents=True, exist_ok=True)
SOURCE = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanFrancisco_1_B23/'
RADIUS = 6378137
LAT, LON = 37.79554, -122.39348
EAST = 111320 * math.cos(math.radians(LAT))
# Scene bounds of the central OSM buildings. Process at 1.5 m per cell.
X0, Z0, X1, Z1, CELL = -99, -118, 78, 30, .09
NX, NZ = math.ceil((X1-X0)/CELL), math.ceil((Z1-Z0)/CELL)

def fetch(path):
    output = CACHE / path.replace('/', '_')
    if not output.exists():
        for attempt in range(4):
            try:
                with urlopen(SOURCE + path, timeout=35) as r:
                    raw=r.read()
                temp=output.with_suffix('.part')
                temp.write_bytes(raw)
                temp.replace(output)
                break
            except OSError:
                if attempt == 3: raise
                time.sleep(2**attempt)
    return output

def web(x,z):
    lon=LON+(-.03552029735*x+.04836012986*z)/(.0036*EAST)
    lat=LAT+(.04836012986*x+.03552029735*z)/(.0036*111320)
    return RADIUS*math.radians(lon), RADIUS*math.asinh(math.tan(math.radians(lat)))

def read_cloud():
    desc=json.loads(fetch('ept.json').read_text())
    xmin,ymin,_,xmax,ymax,_=desc['bounds']
    corners=[web(x,z) for x in (X0,X1) for z in (Z0,Z1)]
    west,south=map(min,zip(*corners));east,north=map(max,zip(*corners))
    leaves=[]
    def visit(key):
        for node,count in json.loads(fetch('ept-hierarchy/'+key+'.json').read_text()).items():
            depth,x,y,_=map(int,node.split('-'));step=(xmax-xmin)/(2**depth)
            a,b=xmin+x*step,ymin+y*step
            if depth>7 or a+step<west or a>east or b+step<south or b>north:continue
            if count==-1:visit(node)
            elif count>0:leaves.append(node)
    visit('0-0-0-0')
    print('Reading',len(leaves),'USGS octree nodes',flush=True)
    dsm=np.full((NZ,NX),-np.inf,dtype=np.float32)
    ground=np.full_like(dsm,np.inf)
    def points(key):
        cloud=laspy.read(fetch('ept-data/'+key+'.laz'))
        lng=np.rad2deg(np.asarray(cloud.x)/RADIUS);lat=np.rad2deg(np.arctan(np.sinh(np.asarray(cloud.y)/RADIUS)))
        e,n=(lng-LON)*EAST,(lat-LAT)*111320
        x=np.floor((-.03552029735*e+.04836012986*n-X0)/CELL).astype(int)
        z=np.floor((.04836012986*e+.03552029735*n-Z0)/CELL).astype(int)
        keep=(x>=0)&(x<NX)&(z>=0)&(z<NZ)
        return x[keep],z[keep],np.asarray(cloud.z)[keep],np.asarray(cloud.classification)[keep]
    with ThreadPoolExecutor(max_workers=5) as pool:
        for x,z,h,kind in pool.map(points,leaves):
            top=np.isin(kind,[1,6]);bare=kind==2
            np.maximum.at(dsm,(z[top],x[top]),h[top])
            np.minimum.at(ground,(z[bare],x[bare]),h[bare])
    np.savez_compressed(CACHE/'downtown-grid.npz',dsm=dsm,ground=ground)

grid=CACHE/'downtown-grid.npz'
if not grid.exists():read_cloud()
arrays=np.load(grid);dsm=arrays['dsm'];ground=arrays['ground']
missing=~np.isfinite(ground)
ground=ground[tuple(distance_transform_edt(missing,return_distances=False,return_indices=True))]
sf=json.loads((DATA/'sf-waterfront.json').read_text())
def rings(poly):
    p=orient(poly,sign=1)
    return [[[round(x,3),round(z,3)] for x,z in ring.coords[:-1]] for ring in (p.exterior,*p.interiors)]

records={}
for building in sf['buildings']:
    p=Polygon(building['p']).buffer(0)
    if p.is_empty or p.geom_type!='Polygon' or p.area<.28:continue
    if not (-95<p.centroid.x<72 and -112<p.centroid.y<26):continue
    # A guard strip rejects stray returns from the neighboring facade.
    inside=p.buffer(-.065)
    if inside.is_empty:continue
    a,b,c,d=p.bounds
    i=max(0,int((a-X0)/CELL)); j=max(0,int((b-Z0)/CELL))
    k=min(NX,int((c-X0)/CELL)+2);l=min(NZ,int((d-Z0)/CELL)+2)
    if k<=i or l<=j:continue
    transform=Affine(CELL,0,X0+i*CELL,0,CELL,Z0+j*CELL)
    mask=geometry_mask([mapping(inside)],out_shape=(l-j,k-i),transform=transform,invert=True)
    raw=dsm[j:l,i:k].copy();have=mask&np.isfinite(raw)
    if have.sum()<10 or have.sum()<mask.sum()*.43:continue
    floor=np.median(ground[j:l,i:k][mask]);raw-=floor
    heights=raw[have]
    # The dominant roof plane sets the local datum. Tall equipment and crown sections
    # are retained separately. Reject points for pitched/stepped/tiny ambiguous slabs.
    histogram,bins=np.histogram(heights,bins=np.arange(-2,365,1.5))
    peak=np.argmax(histogram);main=heights[(heights>=bins[peak]-.5)&(heights<=bins[peak+1]+.5)]
    if not len(main):continue
    base=float(np.median(main))
    if base<2.5 or len(main)<.22*len(heights):continue
    filled=raw[tuple(distance_transform_edt(~have,return_distances=False,return_indices=True))]
    smooth=median_filter(filled,size=3)
    raster=(mask & (smooth>base+2.3) & (smooth<base+30)).astype(np.uint8)
    components,total=label(raster)
    tiers=[]
    for ix,slab in enumerate(shapes(components.astype(np.int32),mask=raster.astype(bool),transform=transform)):
        g,number=slab; component=components==number
        if component.sum()<6:continue
        geom=shape(g).simplify(.08,preserve_topology=True).intersection(inside)
        level=(float(np.median(smooth[component]))-base)*.06
        if geom.geom_type!='Polygon' or geom.area<.057 or geom.area>p.area*.67 or level<.14:continue
        tiers.append([round(level,3),rings(geom)])
    records[str(building['id'])]=[round(base*.06,3),sorted(tiers,key=lambda t:t[0])]
# Match the parcel by overlapping floor area. A building part inherits the same
# parcel record; floor counts are used only on complete, contiguous volumes.
directory=CACHE.parent
parcels=json.loads((directory/'downtown-parcels.geojson').read_text())['features']
assessor={row['parcel_number']:row for row in json.loads((directory/'downtown-assessor.json').read_text())}
osm={row['id']:row.get('tags',{}) for row in json.loads((directory/'embarcadero-rail-map.json').read_text())['elements'] if row['type']=='way'}
coeffs=[-.03552029735*EAST,.04836012986*111320,.04836012986*EAST,.03552029735*111320]
transform=coeffs+[-LON*coeffs[0]-LAT*coeffs[1],-LON*coeffs[2]-LAT*coeffs[3]]
shapes_by_parcel=[affine_transform(shape(f['geometry']),transform).buffer(0) for f in parcels];index=STRtree(shapes_by_parcel)
profiles={}
def integer(value):
    try:return max(0,int(float(value)))
    except (TypeError,ValueError):return 0
for building in sf['buildings']:
    p=Polygon(building['p']).buffer(0)
    if p.is_empty:continue
    tags=osm.get(building['id'],{});hits=index.query(p,predicate='intersects')
    if not len(hits):continue
    share,rank=max((p.intersection(shapes_by_parcel[k]).area/p.area,int(k)) for k in hits)
    if share<.55:continue
    props=parcels[rank]['properties'];record=assessor.get(props.get('mapblklot'),{})
    year=integer(record.get('year_property_built')) or integer(tags.get('start_date','')[:4])
    floors=integer(tags.get('building:levels')) or integer(record.get('number_of_stories'))
    profiles[str(building['id'])]=[year if 1800<year<=2025 else 0,floors if floors<100 else 0,props.get('landuse',''),tags.get('building:material','')]
out={'source':SOURCE+'ept.json','survey':'USGS 2023 San Francisco 3DEP','cellMeters':CELL/.06,'roofs':records,'profiles':profiles}
(DATA/'downtown-roofs.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print(len(records),'resolved roof planes;',sum(len(x[1]) for x in records.values()),'raised outlines;',len(profiles),'parcel matches')
