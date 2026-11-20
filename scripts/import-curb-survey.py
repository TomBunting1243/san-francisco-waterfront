"""Rebuild waterfront curb faces from cached SFMTA curbs/ROW and SF Public Works ramp inventory.
Run: survey-env/bin/python scripts/import-curb-survey.py <reference-survey>
"""
import json, math, runpy, sys
from pathlib import Path
from shapely import STRtree, set_precision
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union, polygonize, nearest_points

D=Path(__file__).resolve().parents[1]/'public/data'
S=Path(sys.argv[1])
def read(p): return json.loads(p.read_text())
sf=read(D/'sf-waterfront.json')
lat,lon=sf['origin']; east=111320*math.cos(math.radians(lat))
a,b,c,d=-.03552029735*east,.04836012986*111320,.04836012986*east,.03552029735*111320
transform=[a,b,c,d,-lon*a-lat*b,-lon*c-lat*d]
def projected(name):
    for f in read(S/name)['features']:
        if f['geometry']:
            yield f['properties'],affine_transform(shape(f['geometry']),transform)
def pieces(g,kind):
    if g.is_empty:return []
    if g.geom_type==kind:return [g]
    return [p for child in getattr(g,'geoms',[]) for p in pieces(child,kind)]
def ring(r):return [[round(x,3),round(z,3)] for x,z in r.coords[:-1]]
def plan(p):
    p=orient(p)
    return [ring(r) for r in (p.exterior,*p.interiors)]
def tangent(line,t):
    a,b=line.interpolate(max(0,t-.018)),line.interpolate(min(line.length,t+.018))
    dx,dz=b.x-a.x,b.y-a.y
    length=max(1e-9,math.hypot(dx,dz));return dx/length,dz/length

market=read(D/'market-street.json'); landscape=read(D/'waterfront-landscape.json')
roadlines=[LineString(r['p']) for r in sf['roads'] if len(r['p'])>1 and r['kind'] not in ('pedestrian','platform','street_lamp')]
roadIndex=STRtree(roadlines)
# The Transbay grid is rotated relative to the Embarcadero. Carry each public
# block face through the last junction (Harrison to Market, Beale to Spear).
# Existing curbs, rights of way and crossings still control the final shape.
transbay=Polygon([(-52.8,-8.4),(-2.6,-16.2),(-4.9,-31.4),(-55.1,-23.5)]).buffer(1.45)
focus=unary_union([box(-101,-15,26,2),LineString([(-1.5,-9),(-8.2,-54)]).buffer(2.1),transbay])
# SFMTA stores intersection polygons separately from street approaches. Their
# layer is blank, even at large public junctions with painted crosswalks.
row=unary_union([p for v,p in projected('row.geojson') if p.intersects(focus)
                and v['LAYER'].strip() in ('STREETS','PRIVATE','Streets_Pedestri','')
                and v['ST_TYPE'].strip() not in ('PLZ','TUNL')]).buffer(.04)
motor=unary_union([r.buffer(1.26) for r in roadlines if r.intersects(focus.buffer(2))])
buildings=unary_union([Polygon(b['p']).buffer(.025) for b in sf['buildings'] if len(b['p'])>2])
parks=unary_union([Polygon(p['p']).buffer(-.035) for p in sf['parks'] if len(p['p'])>2])
rails=[LineString(p) for p in read(D/'embarcadero-tracks.json')['tracks']]+[LineString(p) for _,_,p in market['tracks']]
trackCut=unary_union([l.buffer(.088) for l in rails])
platforms=unary_union([Polygon(p).buffer(.025) for _,_,p in market['platforms']])
allowed=focus.intersection(row).intersection(motor).difference(unary_union([buildings,parks,trackCut,platforms]))
trace=runpy.run_path(str(Path(__file__).with_name('import-transbay-crossings.py')))
bulb=trace['howard_beale_bulb']()
addedPaving=Polygon(bulb['addedPaving'])
oldEdge=LineString(bulb['oldEdge']).buffer(.014)
beds=[Polygon(r) for r in bulb['beds']]
# Two yellow detectable-warning panels visible on the orthophoto. Cut them
# into the sloping concrete below, so the paint never floats or fights it.
beale_center=next(center for name,center,_ in trace['sites'] if name=='Howard / Beale')
def plate_ring(pixels):
    return Polygon([trace['world'](beale_center,p) for p in pixels])
tactile=unary_union([plate_ring([(438,345),(453,345),(454,360),(439,360)]),
                     plate_ring([(407,407),(420,407),(420,423),(407,423)])])
source=[(pr,set_precision(g,.001)) for pr,g in projected('curbs.geojson') if not pr['INT_Z'] and pr['STATUS']=='Active' and pr['CBB_TYPE'] in ('BLK','ISL') and g.intersects(focus.buffer(4))]
source=[(pr,g.difference(oldEdge) if pr['OBJECTID'] in bulb['sourceIds'] else g) for pr,g in source]
# Negative source ID denotes the curb independently traced on the aerial.
# Its terminal driveway seam stays open. The old face gets no second cap.
source.append(({'OBJECTID':-202401,'CBB_TYPE':'BLK'},LineString(bulb['edge'])))
islands=list(polygonize(unary_union([g for pr,g in source if pr['CBB_TYPE']=='ISL'])))
median=next(p for p in islands if p.covers(Point(0,-4.46)))
plantingIsland=next(p for p in islands if p.covers(Point(4.0556,-3.2556)))
plazaIslands=unary_union([median,plantingIsland])
allIslands=unary_union(islands)
# Marked crossing centerlines sometimes stop short of the independent curb
# trace. Extend the observed approach tangent by 2.5 m to find its curb cut.
def crosswalk(points,extension=.15):
    line=LineString(points);ax,az=tangent(line,0);bx,bz=tangent(line,line.length)
    a,b=points[0],points[-1]
    return LineString([(a[0]-ax*extension,a[1]-az*extension),*points,(b[0]+bx*extension,b[1]+bz*extension)])
paths=[crosswalk(p) for _,p in market['crossings']]
# Paint can end up to five metres short of the gutter at a Transbay bulb-out.
# Use the same rectified orthophoto trace used to draw the crossing itself.
transbay_axes=trace['crossing_axes']()
paths.extend(crosswalk(leg['axis'],extension=.30) for legs in transbay_axes.values() for leg in legs)
# Extend the independently traced 2024 paint bar lines to the gutter.
for stripes in read(D/'promenade-crossings.json')['crossings']:
    def middle(bar):return tuple(sum(p[k] for p in bar)/len(bar) for k in (0,1))
    paths.append(crosswalk([middle(stripes[0]),middle(stripes[-1])]))
paths += [LineString(r['p']) for r in landscape['paths'] if r.get('layer','0') in ('0','') and r['kind'] in ('footway','pedestrian','path') and len(r['p'])>1]
pathIndex=STRtree(paths)
# Many DPW records at the same intersection share a single point, regardless of
# corner. Only use an individually resolved location to create an additional cut.
ramps={}
for pr,pt in projected('waterfront-curb-ramps.geojson'):
    if focus.covers(pt) and pr['crexist']=='1':
        ramps.setdefault((round(pt.x,2),round(pt.y,2)),[]).append((pr,pt))
unique=[entries[0][1] for entries in ramps.values() if len(entries)==1]
rampIndex=STRtree(unique)
slabs=read(D/'survey-blocks.json')['streets']
walks=unary_union([addedPaving,*[Polygon(v[0],v[1:]) for v in slabs['sidewalk']]])
out=[]; cutWalk=[]; lipCuts=[]; mapped=[]
for props,src in source:
    clipped=src if props['OBJECTID']==-202401 else src.intersection(allowed)
    for line in pieces(clipped,'LineString'):
        line=line.simplify(.002)
        if line.length<.035:continue
        mid=line.interpolate(.5,normalized=True); road=roadlines[roadIndex.nearest(mid)]
        dx,dz=tangent(line,line.length*.5); nx,nz=-dz,dx
        fwd=Point(mid.x+nx*.045,mid.y+nz*.045);rev=Point(mid.x-nx*.045,mid.y-nz*.045)
        island=props['CBB_TYPE']=='ISL'
        if island and allIslands.contains(fwd)!=allIslands.contains(rev):sign=-1 if allIslands.contains(fwd) else 1
        elif walks.contains(fwd)!=walks.contains(rev):sign=-1 if walks.contains(fwd) else 1
        else:
            near=road.interpolate(road.project(mid));sign=1 if (near.x-mid.x)*nx+(near.y-mid.y)*nz>=0 else -1
        isMedian=island and mid.distance(plazaIslands.boundary)<.014
        openings=[]
        for j in pathIndex.query(line.buffer(.04)):
            path=paths[j]
            for pt in pieces(line.intersection(path),'Point'):
                t=line.project(pt);u=path.project(pt);t1,t2=tangent(line,t);p1,p2=tangent(path,u)
                if abs(t1*p2-t2*p1)>.44:openings.append((t,.098))
        for j in rampIndex.query(line.buffer(.105)):
            pt=unique[j]
            if line.distance(pt)<.105:openings.append((line.project(pt),.054))
        # Crossings stop at mapped paths and at independently located existing ramps.
        stations={0.,line.length}
        stations.update(line.project(Point(v)) for v in line.coords)
        for t,w in openings:
            mapped.append([round(line.interpolate(t).x,3),round(line.interpolate(t).y,3)])
            stations.update(max(0,min(line.length,t+v)) for v in (-w-.058,-w,w,w+.058))
        points=[]
        for t in sorted(stations):
            p=line.interpolate(t);dx,dz=tangent(line,t)
            factor=min([1.]+[max(0,min(1,(abs(t-k)-w)/.058)) for k,w in openings])
            pt=[round(p.x,3),round(p.y,3),round(-dz*sign,3),round(dx*sign,3),round(factor,2)]
            if not points or pt[:2]!=points[-1][:2]:points.append(pt)
        if len(points)<2:continue
        out.append([props['OBJECTID'],int(isMedian),points])
        for v,w in zip(points,points[1:]):
            def pos(p,dist):return (p[0]+dist*p[2],p[1]+dist*p[3])
            back=.157 if min(v[4],w[4])<1 else .031
            poly=Polygon([pos(v,.004),pos(w,.004),pos(w,-back),pos(v,-back)]).buffer(.0008)
            cutWalk.append(poly)
        lipCuts.append(line.buffer(.031))
def overrides(arr,mask):
    out={}
    for i,rings in enumerate(arr):
        p=Polygon(rings[0],rings[1:])
        if p.intersects(mask):
            result=p.difference(mask)
            out[str(i)]=[plan(q) for q in pieces(set_precision(result,.001),'Polygon') if q.area>.00015]
    return out
walkCut=unary_union(cutWalk+[plazaIslands.buffer(.001)])
oldWalk=unary_union([Polygon(v[0],v[1:]) for v in slabs['sidewalk']])
bealeWalk=addedPaving.difference(unary_union([walkCut,oldWalk,*beds]))
curbCut=unary_union([oldEdge.buffer(.030)]+lipCuts+[plazaIslands.buffer(.025),trackCut.intersection(focus)])
data={'sources':['https://services.sfmta.com/arcgis/rest/services/ROW/rightofway/MapServer/1','https://data.sf.gov/d/ch9w-7kih','https://sfpublicworks.org/services/permits/street-improvement'],
      'median':ring(median.exterior),'plantingIsland':ring(plantingIsland.exterior),'lines':out,'ramps':sorted(set(map(tuple,mapped))),
      'bealeWalk':[plan(p) for p in pieces(set_precision(bealeWalk,.001),'Polygon') if p.area>.00015],
      'bealeBeds':[plan(p) for p in beds],
      'overrides':{'curb':overrides(slabs['curb'],curbCut),'sidewalk':overrides(slabs['sidewalk'],walkCut)}}
# Split the surveyed island at its actual outline, the pedestrian band and
# ramp grade breaks. No paving triangle can bridge a street or rail opening.
from shapely.ops import triangulate
axis=lambda z:-.13+(z+1.813)*.177
def strip(near,far,w):
    return Polygon([(axis(near)-w,near),(axis(near)+w,near),(axis(far)+w,far),(axis(far)-w,far)])
def tris(p):
    return [ring(t.exterior) for t in triangulate(p) if p.covers(t)]
# Split only the apron triangles touched by the two warnings. Interpolate
# within the original triangle to retain the measured drain-to-footway grade.
beale_aprons={}
for id,_,stations in out:
    if id!=-202401:continue
    for index,(a,b) in enumerate(zip(stations,stations[1:])):
        back=.157 if min(a[4],b[4])<1 else .031
        def profile(p,offset,y):return (p[0]+p[2]*offset,p[1]+p[3]*offset,y)
        def inner(p):return profile(p,-.011,.0315+p[4]*.1524*.06)
        corners=[inner(a),inner(b),profile(b,-back,.0451),profile(a,-back,.0451)]
        if not Polygon([pt[:2] for pt in corners]).intersects(tactile):continue
        surfaces=[]
        for i,j,k in [(0,1,2),(0,2,3)]:
            a0,b0,c0=[corners[h] for h in (i,j,k)]
            tri=Polygon([pt[:2] for pt in (a0,b0,c0)])
            if tri.area<1e-10:continue
            dx,dz,dy=[b0[h]-a0[h] for h in range(3)]
            ex,ez,ey=[c0[h]-a0[h] for h in range(3)]
            def vertex(x,z):
                t=((x-a0[0])*ez-(z-a0[1])*ex)/(dx*ez-dz*ex)
                u=(dx*(z-a0[1])-dz*(x-a0[0]))/(dx*ez-dz*ex)
                return [round(x,5),round(a0[2]+t*dy+u*ey,6),round(z,5)]
            for yellow,region in [(0,tri.difference(tactile)),(1,tri.intersection(tactile))]:
                for polygon in pieces(region,'Polygon'):
                    for facet in triangulate(polygon):
                        if polygon.covers(facet) and facet.area>1e-10:
                            surfaces.append({'warning':bool(yellow),'points':[vertex(x,z) for x,z in list(facet.exterior.coords)[:3]]})
        beale_aprons[index]=surfaces
data['bealeAprons']=beale_aprons
def grid(region):
    out=[]
    x0,y0,x1,y1=region.bounds
    for i in range(math.floor(x0/.17),math.ceil(x1/.17)):
        for j in range(math.floor(y0/.10),math.ceil(y1/.10)):
            for poly in pieces(region.intersection(box(i*.17,j*.10,(i+1)*.17,(j+1)*.10)),'Polygon'):
                out.extend(tris(poly))
    return out
medianBand=plazaIslands.intersection(strip(-2.9,-6,.81))
gates=[]
for path in paths:
    for pt in pieces(plazaIslands.boundary.intersection(path),'Point'):
        if abs(pt.x-axis(pt.y))<.65:gates.append([round(pt.x,3),round(pt.y,3)])
data['medianGates']=gates
data['medianPaving']=[t for part in pieces(medianBand,'Polygon') for t in grid(part)]
data['medianSlab']=[t for poly in pieces(plazaIslands.difference(medianBand),'Polygon') for t in tris(poly)]
# The narrow northbound refuge has two curb ramps facing each other across
# a 0.365-unit island. Give the granite the actual ramp triangles, leaving
# the curb lips/gutters and the rest of the island in their original batch.
from shapely import constrained_delaunay_triangles
def add_ferry_refuge(data):
    refuge_strip=strip(-2.96,-3.51,.81)
    refuge_path=next(stations for id,_,stations in data['lines'] if id==3833285)
    refuge=Polygon([p[:2] for p in refuge_path]).intersection(refuge_strip)
    data['medianPaving']=[t for t in data['medianPaving'] if not -3.51<sum(p[1] for p in t)/3<-2.96]
    refuge_paving=[]; refuge_aprons={}; margins=[]
    def facets(area,height):
        result=[]
        for polygon in pieces(area,'Polygon'):
            for facet in constrained_delaunay_triangles(polygon).geoms:
                if facet.area<1e-12:continue
                result.append([[round(x,7),round(height(x,z),7),round(z,7)] for x,z in list(facet.exterior.coords)[:3]])
        return result
    def curb_point(p,offset,y):
        return (p[0]+p[2]*offset,p[1]+p[3]*offset,y)
    for index,(a,b) in enumerate(zip(refuge_path,refuge_path[1:])):
        back=.157 if min(a[4],b[4])<1 else .031
        def section(p):
            top=.0315+p[4]*.1524*.06
            return [curb_point(p,.0023,.0315),curb_point(p,0,top),curb_point(p,-.011,top),curb_point(p,-back,.040644)]
        sa,sb=section(a),section(b)
        for j in range(3):
            if not Polygon([p[:2] for p in (sa[j],sb[j],sb[j+1],sa[j+1])]).intersects(refuge_strip):continue
            for A,B,C in [(sa[j],sb[j],sb[j+1]),(sa[j],sb[j+1],sa[j+1])]:
                tri=Polygon([p[:2] for p in (A,B,C)])
                if tri.area<1e-12:continue
                margins.append(tri)
                if j!=2:continue
                dx,dz,dy=(B[i]-A[i] for i in range(3));ex,ez,ey=(C[i]-A[i] for i in range(3))
                def height(x,z):
                    t=((x-A[0])*ez-(z-A[1])*ex)/(dx*ez-dz*ex)
                    u=(dx*(z-A[1])-dz*(x-A[0]))/(dx*ez-dz*ex)
                    return A[2]+t*dy+u*ey
                refuge_paving.extend(facets(tri.intersection(refuge_strip),height))
                refuge_aprons.setdefault(index,[]).extend(facets(tri.difference(refuge_strip),height))
    refuge_paving.extend(facets(refuge.difference(unary_union(margins)),lambda x,z:.040644))
    data['ferryRefugePaving']=refuge_paving
    data['ferryRefugeAprons']=refuge_aprons
def join_median_corners(data):
    # Separate survey runs meet at identical plan coordinates. A shared
    # miter keeps the end curb sections edge-to-edge at those three corners.
    ends={}
    for _,median,path in data['lines']:
        if median:
            for v in [path[0],path[-1]]:ends.setdefault(tuple(v[:2]),[]).append(v)
    for pair in ends.values():
        if len(pair)!=2:continue
        a,b=pair
        scale=math.hypot(a[2]+b[2],a[3]+b[3])
        normal=[round((a[j]+b[j])/scale,6) for j in [2,3]]
        a[2:]=b[2:]=[*normal,min(a[4],b[4])]

def trim_median_caps(data):
    # The curb mesh owns its stone lip and shoulder. Clip the island surfacing
    # against those exact station offsets, including the wider lowered ramps.
    caps=[]
    for source,median,path in data['lines']:
        if not median:continue
        for a,b in zip(path,path[1:]):
            back=.157 if min(a[4],b[4])<1 else .031
            def offset(v,t):return (v[0]-t*v[2],v[1]-t*v[3])
            for inner,outer in [(0,.011),(.011,back)]:
                p,q=offset(a,inner),offset(b,inner)
                r,s=offset(b,outer),offset(a,outer)
                caps.extend(t for t in [Polygon([p,q,r]),Polygon([p,r,s])] if t.area>1e-12)
    mask=unary_union(caps)
    for key in ['medianSlab','medianPaving']:
        result=[]
        for points in data[key]:
            tri=Polygon(points)
            if not tri.intersects(mask):
                result.append(points)
                continue
            for poly in pieces(tri.difference(mask),'Polygon'):
                for cut in constrained_delaunay_triangles(poly).geoms:
                    if cut.area>1e-12:
                        result.append([[round(x,7),round(z,7)] for x,z in list(cut.exterior.coords)[:3]])
        data[key]=result

join_median_corners(data)
add_ferry_refuge(data)
trim_median_caps(data)
# Keep high plaza brick outside the graded former street entrance.
west=strip(-6.249,-9.066,1.23)
park=Polygon(next(v['p'] for v in sf['parks'] if v['name']=='Embarcadero Plaza'))
data['westCut']=ring(west.exterior)
data['westPark']=[plan(p) for p in pieces(park.difference(west),'Polygon')]
data['westFlanks']=grid(west.difference(strip(-6.249,-9.066,.92)).intersection(park))
(D/'curb-survey.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
print('curb runs / stations / crossing centres',len(out),sum(len(v[2]) for v in out),len(data['ramps']))
