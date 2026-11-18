"""Ferry/Rincon furniture and canopy survey. Pass the cached reference-survey directory.
Requires numpy, scipy, shapely 2 and laspy[lazrs]. No network or source edits.
"""
import base64
import json
import math
import sys
from pathlib import Path

import laspy
import numpy as np
from scipy.spatial import cKDTree
from scipy.ndimage import gaussian_filter, label, map_coordinates
from shapely import STRtree, Point, Polygon

DATA = Path(__file__).resolve().parents[1] / 'public/data'
cache = Path(sys.argv[1])
tiles = cache / 'san-francisco-2023'
origin_lat, origin_lon = 37.79554, -122.39348
east = 111320 * math.cos(math.radians(origin_lat))
a, b = -.03552029735, .04836012986


def project(lon, lat):
    e, n = (lon-origin_lon)*east, (lat-origin_lat)*111320
    return a*e+b*n, b*e-a*n


def load(path):
    return json.loads(path.read_text())


# Heading is a site interpretation from the grouping of adjacent seats and
# plaza edges. The opposing rows at the north end face away from each other.
def bench_row(i):
    if 9847266978 <= i <= 9847266983:
        return 'north', 0 if i % 2 == 0 else math.pi
    if 9847266984 <= i <= 9847266986:
        return 'north', 0
    if 9847266991 <= i <= 9847266994:
        return 'north', math.pi/2 if i < 9847266993 else -math.pi/2
    if 9064052243 <= i <= 9064052248:
        return 'south', math.pi/2
    if 9064052249 <= i <= 9064052252:
        return 'south', .14
    if 9064052253 <= i <= 9064052259:
        return 'south', -1.42
    if i in (5512802831,10968514758,10968514759,10968514760,10968514762,10968514766):
        return 'rincon', {10968514758:1,10968514759:1,10968514760:.79,10968514762:.16}.get(i,.12)
    return None


nodes = load(cache/'embarcadero-rail-map.json')['elements']
old = load(DATA/'waterfront-landscape.json')['trees']
old_positions = {t['id']:t['p'] for t in old}
benches, trees = [], []
for node in nodes:
    if node['type'] != 'node':
        continue
    tag, i = node.get('tags', {}), node['id']
    x,z = project(node['lon'],node['lat'])
    if tag.get('amenity') == 'bench' and (row := bench_row(i)):
        benches.append(dict(id=i, p=[round(x,4),round(z,4)], area=row[0],yaw=round(row[1],4),
                            seats=int(tag['seats']) if 'seats' in tag else None,
                            metal=tag.get('material')=='metal', arms=tag.get('armrest')=='yes'))
    if tag.get('natural') != 'tree' or not (-44<x<13 and -12<z<4):
        continue
    if i not in old_positions and any(math.dist([x,z],p)<.075 for p in old_positions.values()):
        continue
    if any(math.dist([x,z],t['p'])<.045 for t in trees):
        continue
    trees.append(dict(id=i,p=[round(x,4),round(z,4)],palm=tag.get('taxon')=='Arecaceae' or
                      'palm' in tag.get('taxon:en','').lower(), supplemental=i not in old_positions))

# Digitized tree wells on the City's 2024 8 cm orthophoto, zoom 20. In this
# local rectification the upper left is scene (10,-8). Columns run bayward,
# rows run southward, with 90 pixels per scene unit. This fills the two median
# rows missing from OSM. The third, ferry-side row already has OSM nodes.
median_pixels = [
    (353,426),(426,438),(351,466),(425,470),(353,534),(427,535),(353,569),(427,569),
    (354,608),(427,619),(354,670),(427,673),(353,715),(427,707),
    (338,1185),(425,1194),(340,1235),(426,1239),(340,1280),(425,1278),
    (342,1329),(426,1321),(341,1373),(425,1371),(343,1418),(426,1421),
]
for j,(u,v) in enumerate(median_pixels):
    p=[round(10-v/90,4),round(u/90-8,4)]
    if all(math.dist(p,t['p'])>.12 for t in trees):
        trees.append(dict(id=-870100-j,p=p,palm=False,supplemental=True))

# Fit a blurred 3D density field to the observed canopy returns. Surface nets
# emit one shared vertex per crossing cell; the largest volume retains true
# openings while isolated returns cannot become detached leaf plates.
def canopy_mesh(xyz, height, diameter):
    def encode(values):
        return base64.b64encode(values.tobytes()).decode()
    corner=np.array([[x,y,z] for x in range(2) for y in range(2) for z in range(2)])
    edges=[(i,j) for i in range(8) for j in range(i+1,8) if np.sum(abs(corner[i]-corner[j]))==1]
    cell=diameter*.065
    while True:
        origin=xyz.min(axis=0)-5*cell
        samples=(xyz-origin)/cell
        shape=np.ceil(samples.max(axis=0)).astype(int)+6
        mass=np.zeros(shape)
        lower=np.floor(samples).astype(int)
        frac=samples-lower
        for offset in corner:
            weights=np.prod(np.where(offset,frac,1-frac),axis=1)
            np.add.at(mass,tuple((lower+offset).T),weights)
        # The support radius is a physical fraction of crown diameter. A
        # coarser exported grid never changes the intended smoothing radius.
        sigma=max(.77,diameter*.055/cell)
        density=gaussian_filter(mass,sigma)
        iso=np.percentile(map_coordinates(density,samples.T,order=1),23)*.64
        occupied=density>=iso
        groups,count=label(occupied)
        if not count:return None
        population=np.bincount(groups.ravel());population[0]=0
        density[(groups!=np.argmax(population))&occupied]=iso*.6
        lower=np.minimum.reduce([density[x:x+shape[0]-1,y:y+shape[1]-1,z:z+shape[2]-1] for x,y,z in corner])
        upper=np.maximum.reduce([density[x:x+shape[0]-1,y:y+shape[1]-1,z:z+shape[2]-1] for x,y,z in corner])
        cells=np.argwhere((lower<iso)&(upper>=iso))
        if len(cells)<=390:break
        cell*=1.10
    if len(cells)<30:return None
    lookup={tuple(q):i for i,q in enumerate(cells)}
    vertices=[]
    for q in cells:
        values=density[tuple((q+corner).T)]
        crossing=[corner[a]+(corner[b]-corner[a])*(iso-values[a])/(values[b]-values[a])
                  for a,b in edges if (values[a]>=iso)!=(values[b]>=iso)]
        vertices.append(q+np.mean(crossing,axis=0))
    vertices=np.asarray(vertices)
    # The local gradient points out of the leaf mass. Broad envelope normals
    # are blended at render time, while density just inside the surface and
    # its surrounding neighborhood give a stable, precomputed shade factor.
    normals=np.stack([-map_coordinates(axis,vertices.T,order=1) for axis in np.gradient(density)],axis=1)
    normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-9)
    inner=map_coordinates(density,(vertices-normals*1.45).T,order=1)
    ambient=map_coordinates(gaussian_filter(density,1.65),vertices.T,order=1)
    occlusion=np.clip(.62*inner/(np.percentile(inner,90)+1e-9)+.38*ambient/(np.percentile(ambient,90)+1e-9),0,1)
    faces=[]
    for q in cells:
        for axis in range(3):
            advance=np.eye(3,dtype=int)[axis]
            if (density[tuple(q)]>=iso)==(density[tuple(q+advance)]>=iso):continue
            u=np.eye(3,dtype=int)[(axis+1)%3];v=np.eye(3,dtype=int)[(axis+2)%3]
            ring=[lookup.get(tuple(r)) for r in (q,q-u,q-u-v,q-v)]
            if None in ring:continue
            a,b,c,d=ring
            if np.dot(np.cross(vertices[b]-vertices[a],vertices[c]-vertices[a]),normals[ring].mean(axis=0))<0:
                b,d=d,b
            faces.extend([[a,b,c],[a,c,d]])
    normalized=np.rint((origin+vertices*cell)/height*100).clip(-127,127).astype(np.int8)
    return [encode(normalized),encode(np.asarray(faces,dtype='<u2')),encode(np.rint(normals*127).astype(np.int8)),
            encode(np.rint(occlusion*255).astype(np.uint8))]

canopies={}
# Restrict samples to cached tiles intersecting the corridor before decoding.
bounds=load(tiles/'ept.json')['bounds']
corners=[]
for x in (-45,14):
    for z in (-13,5):
        lon=origin_lon+(a*x+b*z)/(.0036*east)
        lat=origin_lat+(b*x-a*z)/(.0036*111320)
        corners.append([6378137*math.radians(lon),6378137*math.asinh(math.tan(math.radians(lat)))])
west,south=np.min(corners,axis=0)
east_edge,north=np.max(corners,axis=0)
parts=[]
for path in sorted(tiles.glob('ept-data_*.laz')):
    depth,ix,iy,_=map(int,path.stem.split('_')[1].split('-'))
    size=(bounds[3]-bounds[0])/2**depth
    left,bottom=bounds[0]+ix*size,bounds[1]+iy*size
    if left>east_edge or left+size<west or bottom>north or bottom+size<south:
        continue
    cloud=laspy.read(path)
    lon=np.rad2deg(np.asarray(cloud.x)/6378137)
    lat=np.rad2deg(np.arctan(np.sinh(np.asarray(cloud.y)/6378137)))
    x,z=project(lon,lat)
    keep=(x>-45)&(x<14)&(z>-13)&(z<5)
    parts.append(np.column_stack([x[keep],z[keep],np.asarray(cloud.z)[keep],
                 np.asarray(cloud.classification)[keep],np.asarray(cloud.number_of_returns)[keep]]))
samples=np.concatenate(parts)
ground=samples[samples[:,3]==2]
leaves=samples[np.isin(samples[:,3],[1,3,4,5])]
ground_index=cKDTree(ground[:,:2])
crown_index=cKDTree(leaves[:,:2])
stems=cKDTree([t['p'] for t in trees])
buildings=STRtree([Polygon(v['p']).buffer(.075) for v in load(DATA/'sf-waterfront.json')['buildings'] if len(v['p'])>2])
for j,t in enumerate(trees):
    p=t['p']
    if len(buildings.query(Point(p).buffer(.12),predicate='intersects')):
        continue
    ground_near=ground[ground_index.query_ball_point(p,.27)]
    if len(ground_near)<8:
        continue
    base=float(np.median(ground_near[:,2]))
    near=leaves[crown_index.query_ball_point(p,.39)]
    near=near[(near[:,2]>base+2.0)&(near[:,2]<base+29)]
    if len(near)<45:
        continue
    # Assign overlapping crowns to the nearest mapped stem. Remove returns
    # in or close to building footprints, including unclassified roof points.
    near=near[stems.query(near[:,:2])[1]==j]
    if len(near)<45:
        continue
    nearby=buildings.query(Point(p).buffer(.40),predicate='intersects')
    if len(nearby):
        from shapely import intersects_xy
        occupied=np.zeros(len(near),dtype=bool)
        for k in nearby:
            occupied |= intersects_xy(buildings.geometries[k],near[:,0],near[:,1])
        near=near[~occupied]
    if len(near)<45:
        continue
    # Multi-return pulses, vertical scatter and angular coverage reject solid
    # car roofs, lamp heads and wires accidentally sampled near a street tree.
    d=near[:,:2]-p
    r=np.linalg.norm(d,axis=1)
    inner=near[r<.15]
    if len(inner)<20 or np.sum(inner[:,4]>1)<5:
        continue
    h=float(np.percentile(inner[:,2],96)-base)
    if h<2.7 or np.ptp(np.percentile(inner[:,2],[15,90]))<.8:
        continue
    canopy=(near[:,2]>base+max(2,h*.44))&(near[:,2]<base+h+1)
    sectors=np.floor((np.arctan2(d[:,1],d[:,0])+math.pi)*4/math.pi).astype(int)%8
    radii=[np.percentile(r[canopy&(sectors==k)],90) for k in range(8) if np.sum(canopy&(sectors==k))>=6]
    if len(radii)<6:
        continue
    diameter=float(2*np.median(radii)/.06)
    if diameter<1.5 or diameter/h>1.8:
        continue
    t.update(heightM=round(h,2), crownM=round(diameter,2), groundM=round(base,2),
             canopyReturns=int(np.sum(canopy)),groundReturns=len(ground_near))

    if not t['palm'] and -7<p[0]<7 and -5.0<p[1]<-1.25:
        selected=near[canopy]
        xyz=np.column_stack([(selected[:,0]-p[0])/.06,selected[:,2]-base,(selected[:,1]-p[1])/.06])
        shell=canopy_mesh(xyz,h,diameter)
        if shell:canopies[t['id']]=shell

(DATA/'plaza-canopies.json').write_text(json.dumps(canopies,separators=(',',':'))+'\n')
print(len(canopies),'connected lidar crown meshes')
# The two remaining visible tree wells retain their surveyed horizontal
# position. Their model dimensions use the nearest three corroborated trees
# in the same median row and are explicitly identified as estimates.
median=[t for t in trees if t['id']<0]
for t in median:
    if 'heightM' in t:
        continue
    peers=sorted((p for p in median if 'heightM' in p and abs(t['p'][1]-p['p'][1])<.3),
                 key=lambda p: math.dist(t['p'],p['p']))[:3]
    t['estimatedHeightM']=round(float(np.median([p['heightM'] for p in peers])),2)
    t['estimatedCrownM']=round(float(np.median([p['crownM'] for p in peers])),2)

# Preserve the support category from the same City right-of-way polygons used
# for the visible road and sidewalk, independent of the lidar vertical datum.
street_plans=load(DATA/'survey-blocks.json')['streets']
surfaces={kind:STRtree([Polygon(rings[0],rings[1:]) for rings in plans])
          for kind,plans in street_plans.items()}
for t in trees:
    pt=Point(t['p'])
    for kind in ('curb','sidewalk','street','alley','courtyard','garden','parking','stall'):
        if len(surfaces[kind].query(pt,predicate='intersects')):
            t['surface']=kind
            break

result=dict(mapping='OpenStreetMap contributors, ODbL 1.0',mapUrl='https://www.openstreetmap.org/copyright',
            lidar='USGS 2023 San Francisco airborne lidar', lidarUrl='https://www.fisheries.noaa.gov/inport/item/73386',
            aerial='San Francisco 2024 RGB 8 cm orthoimagery', aerialUrl='https://tile.sf.gov/api/tiles/p2024_rgb8cm/{z}/{x}/{y}',
            benches=benches,trees=[t for t in trees if 'heightM' in t or t['palm'] or 'estimatedHeightM' in t])
(DATA/'plaza-survey.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print(len(benches),'benches;',sum('heightM' in t for t in trees),'measured crowns;',sum(t['supplemental'] for t in result['trees']),'new aerial positions')
