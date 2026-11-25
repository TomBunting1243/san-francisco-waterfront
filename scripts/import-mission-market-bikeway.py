"""Rebuild Mission–Market markings from plate measurements, clipped to scene pavement.
Requires Node with TS stripping, project npm dependencies and Shapely 2.1.
Plate is SF's 2024 RGB orthophoto, x=-56+u/132, z=2-v/132 (7.92 px/m).
"""
import argparse
import json
import subprocess
from bisect import bisect_left
from pathlib import Path
from shapely import Polygon, LineString, union_all, constrained_delaunay_triangles
from shapely.affinity import rotate, translate

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/data/mission-market-bikeway.json'
parser = argparse.ArgumentParser()
parser.add_argument('--support', type=Path, help='optional cached original pavement triangle survey')
args = parser.parse_args()

# The actual road, curb batter and existing zebras own their surfaces.
# Read them before this addition, including on a clean checkout without generated data.
def ground():
    if args.support:
        return json.loads(args.support.read_text())
    js = """
import {registerHooks} from 'node:module';
registerHooks({load(url,ctx,next){if(url.endsWith('/mission-market-bikeway.ts'))return {format:'module',source:'export function addMissionMarketBikeway(){}',shortCircuit:true};return next(url,ctx);}});
const {addSurveyBlocks}=await import('./app/survey-blocks.ts'),T=await import('three');
const ms=[];addSurveyBlocks(g=>{const m=new T.Mesh(g);ms.push(m);return m;});let out=[];
for(const m of ms){const g=m.geometry,p=g.attributes.position,i=g.index;
 for(let j=0;j<(i?.count??p.count);j+=3){const q=[0,1,2].map(k=>{const n=i?i.getX(j+k):j+k;return [(p.getX(n)+56)*132,(2-p.getZ(n))*132,p.getY(n)]});
 if(Math.max(...q.map(t=>t[0]))<5615||Math.min(...q.map(t=>t[0]))>7240||Math.max(...q.map(t=>t[1]))<485||Math.min(...q.map(t=>t[1]))>675||q.some(t=>t[2]<.0307||t[2]>.16))continue;
 const [a,b,c]=q;if((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])>1.e-7)out.push([m.name,q]);}}
console.log(JSON.stringify(out));
"""
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',js], cwd=ROOT))

# Traffic-side edge of the coloured track and outer boundary of the striped aisle.
north=[(5877,543.2),(5891,542),(5910,539),(5940,534),(5960,530),(5985,526),(6005,526),
       (6040,529),(6100,533),(6160,537),(6220,542),(6280,546),(6330,550),(6382,553.5)]
south=[(6563,593.6),(6578,594),(6600,591),(6620,587),(6640,583),(6666,577),(6680,576),
       (6710,577),(6770,580),(6810,582.5),(6840,584),(6900,586),(6990,586),(7060,585),
       (7100,585),(7110,587),(7150,596),(7180,604),(7202,608),(7230,609)]
def y_at(points,x):
    i=max(1,min(len(points)-1,bisect_left([p[0] for p in points],x)))
    (a,v),(b,w)=points[i-1:i+1]
    return v+(w-v)*(x-a)/(b-a)
def section(points,l,r,offset):
    return [(x,y_at(points,x)+offset) for x in [l,*[x for x,y in points if l<x<r],r]]
def band(points,l,r,upper,lower):
    return Polygon(section(points,l,r,upper)+section(points,l,r,lower)[::-1])
def trace(points,width):
    return LineString(points).buffer(width/2,cap_style='flat',join_style='mitre')
white=[];green=[];yellow=[]
# Main crossings were already traced separately. Leave all three zebra approaches intact.
for axis,regions in [(north,[(5877.9,6237),(6291,6381)]),(south,[(6563.4,6775),(6831,7009),(7070,7230)])]:
    for l,r in regions: green.append(band(axis,l,r,-23.2,-.62))
    white.append(trace(axis,1.25))
# Floating curb/end tapers, drawn as single return outlines.
outer1=[(5876.7,553.3),(5950,561.4),(5986.5,564.4),(5989.7,563),(5990.7,545),(5992.8,542.8),(6002,542.8),(6100,550.5),(6200,557.4),(6278.7,563.6),(6280.7,565),(6280.4,582.5),(6283.1,584.7),(6374,591.4),(6379.3,589.3),(6382.4,553.8)]
outer2=[(6561.9,604.5),(6580,607),(6637,611.2),(6641.2,609.5),(6644,591.5),(6646.9,589.7),(6670,590.5),(6720,594.6),(6820,600.3),(6900,602.4),(7040,602.7),(7108.8,601.6),(7110.6,604),(7110.6,620),(7113,621.6),(7198,623.0),(7227.4,622.5)]
for points in [outer1,outer2]:white.append(trace(points,1.3))
# Individual obliques, intersected with the actual aisle shape. Imagery includes
# a bus across several road-side ends; continue those short diagonals within the aisle.
# Origins and slopes fit the local white crest in the 2024 aerial; exclude
# the first ambiguous stripe immediately beside the south Mission zebra.
for axis,outline,marks in [
    (north,outer1,[(5910,.98),(5941,1.28),(5969,1.08),(6001,1.18),(6036,1.08),
      (6070,1.08),(6104,1.08),(6142,1.08),(6179,1.18),(6215,1.18),(6249,1.08),
      (6286,1.18),(6322,1.18),(6358,1.28)]),
    (south,outer2,[(6563,.98),(6596,1.08),(6624,1.08),(6652,.98),(6683,1.18),
      (6716,1.08),(6754,1.28),(6789,1.28),(6825,1.28),(6860,1.08),(6896,.98),
      (6932,.98),(6968,.98),(7005,.98),(7041,.98),(7076,.98),(7118,.98),
      (7162,.98),(7206,.98)])]:
    aisle=Polygon(axis+outline[::-1]).buffer(0)
    for x,slope in marks:
        y=y_at(axis,x); white.append(trace([(x,y),(x+45,y+45*slope)],1.22).intersection(aisle))
# Streetside lane stripe behind each floating loading bay. These bays remain
# available to stopped vehicles; there is no continuous kerb wall here.
for seg in [[(5990,564.5),(6115,574.0),(6280,585)],[(6641,612),(6800,622),(6900,624.9),(7040,624.2),(7110,623.4)]]:
    white.append(trace(seg,1.25))
# Three pedestrian ladders across the cycle track: the stripes run in the
# travel direction of the bikes; gaps in green frame their entire crossing.
for l,r,axis in [(6251.1,6275.7,north),(6796.2,6819.4,south),(7011.5,7049.8,south)]:
    for d in [-21,-14.35,-7.7]:white.append(band(axis,l,r,d,d+2))
# The driveway has three green conflict patches with short white end dashes.
for q in [[[6401.0,535.2],[6410.2,537.5],[6402.7,559.5],[6393.1,556.6]],
          [[6428.1,543.8],[6437.7,546.5],[6429.4,569.5],[6420.0,566.6]],
          [[6456,552.9],[6465.1,555.5],[6457.4,579.7],[6447.8,577.1]]]:
    green.append(Polygon(q));white.append(trace([q[2],q[3]],1.3))
green.append(Polygon([(6469,560.1),(6509.5,563.4),(6508.4,575.3),(6528,576.9),(6526.3,589.8),(6468.1,586.7)]))
white.append(trace([(6510,563.4),(6508.6,575.4)],1.75))
white.append(trace([(6468.5,587.4),(6506,589.7),(6526.3,591)],1.2))
# Between Mission's two zebras: turning/waiting box in the buffer, not a
# green carpet across the intersection. Original north and south ladders stay.
mb=[(5698.1,527.8),(5823,536.1)]
white.append(trace(mb,1.25));white.append(trace([(5696.6,541.8),(5822.1,550.1)],1.25))
for x in [5698.1,5775.2,5823]:
    y=y_at(mb,x);white.append(trace([(x,y),(x-1.6,y+14)],1.2))
for x in [5709.4,5757]:
    y=y_at(mb,x);white.append(trace([(x,y),(x+11,y+14)],1.2))
for x in [5701,5713,5725,5737,5749,5761,5770]:
    white.append(band(mb,x,x+5,10.5,11.7))
green.append(Polygon([(5776,533.6),(5822.1,536.7),(5820.7,549.0),(5774.6,546.0)]))
def arrow(x,y,angle):
    shape=Polygon([(-4.8,-.7),(.6,-.7),(.6,-2.15),(5.1,0),(.6,2.15),(.6,.7),(-4.8,.7)])
    return translate(rotate(shape,angle,origin=(0,0)),x,y)
# In the clear parts of the aerial, paired bike and arrow marks oppose one
# another across the centerline. Leave stencils under tree crowns unrepresented.
for axis,x,dir in [(north,5905,-1),(north,5947,1),(north,6147,-1),(north,6202,1),
                   (south,6590,-1),(south,6934,1),(south,7181,-1)]:
    angle=180 if dir<0 else 0
    white.append(arrow(x,y_at(axis,x)+(-5.2 if dir<0 else -18.5),angle))
# Mission's small turn box contains a bicycle between opposing hooked arrows.
box=[(-3.8,-3),(-.7,-3),(.6,-2.4),(1.4,-1.1),(1.4,.8),(2.9,.8),
     (.6,3.7),(-1.7,.8),(-.2,.8),(-.2,-1),(-1,-1.7),(-3.8,-1.7)]
for x,sign in [(5784,1),(5815,-1)]:
    mark=Polygon([(a*sign,b) for a,b in box])
    white.append(translate(rotate(mark,4,origin=(0,0)),x,y_at(mb,x)+7))
bike=Polygon([(-5,-3),(-4,-4),(-2.4,-3.7),(-1.7,-2.2),(-2.4,-.8),(-.1,-.3),
    (1.3,-.9),(2.1,0),(4.2,-.4),(5.1,.1),(4.6,1.2),(1,1.5),(-1.6,1.2),
    (-1.4,2.5),(-2.6,3.8),(-4.5,3.5),(-5.4,2.5),(-4.9,1.2),(-3.6,.5),
    (-3.2,-.6),(-4.8,-1.3)],[
    [(-4.3,y),(-3.5,y-.65),(-2.7,y),(-3.5,y+.7)] for y in [-2.4,2.3]])
white.append(translate(rotate(bike,94,origin=(0,0)),5799.5,y_at(mb,5799.5)+7))
for axis,x,dir in [(north,5905,1),(north,5947,-1),(north,6147,1),(north,6202,-1),
                   (south,6590,1),(south,6934,-1),(south,7181,1)]:
    white.append(translate(rotate(bike,0 if dir>0 else 180,origin=(0,0)),x,
                           y_at(axis,x)+(-5.2 if dir<0 else -18.5)))
# Dashed yellow centerline where the aerial resolves it, including in the driveway.
for axis,spans in [(north,[(5966,5971),(6018,6023),(6071,6076),(6124,6129),(6177,6182),(6315,6320)]),
                   (south,[(6693,6698),(6745,6750),(6866,6871),(6940,6945),(7092,7097),(7150,7155)])]:
    for l,r in spans:yellow.append(band(axis,l,r,-12.1,-11.1))
# Distinct upright/shadow pairs from the plan image. Closely spaced unidentified
# objects at the driveway and vehicles obscuring some posts are not replicated.
posts=[[5911.6,546.2],[5936,550],[5965,544],[5995.3,540.2],[6031.6,543.4],[6067,547],
       [6101,548.9],[6137.2,551.7],[6172.3,554.6],[6208.2,557.5],[6245,560],[6281,562.2],
       [6588,607.4],[6621,599],[6641,598.6],[6676,591],[6711,592.6],[6749,595.3],
       [6786,596.6],[6822,598.8],[6859,600.3],[6895,600.8],[7040,600.2],[7076,600.3],
       [7158,609.5],[7200,619.7]]

existing=ground()
road=union_all([Polygon([(u,v) for u,v,h in q]) for name,q in existing if all(abs(h-.031)<1.e-6 for _,_,h in q)])
cover=union_all([Polygon([(u,v) for u,v,h in q]) for name,q in existing if max(h for _,_,h in q)>.03102])
allowed=road.difference(cover.buffer(.04))
ink=union_all(white).intersection(allowed)
center=union_all(yellow).intersection(allowed).difference(ink)
cycle=union_all(green).intersection(allowed).difference(ink.union(center))
def encode(regions):
    verts=[];ids={};faces={}
    for pigment,poly in regions:
        index=[]
        for tri in constrained_delaunay_triangles(poly).geoms:
            xy=[(round(x,2),round(y,2)) for x,y in list(tri.exterior.coords)[:3]]
            (x,y),(v,w),(b,c)=xy;cross=(v-x)*(c-y)-(w-y)*(b-x)
            if abs(cross)<.005:continue
            if cross<0:xy.reverse()
            for pos in xy:
                if pos not in ids:ids[pos]=len(verts);verts.append(pos)
                index.append(ids[pos])
        faces[pigment]=index
    return {'vertices':verts,'faces':faces,'posts':posts}
data=encode([('green',cycle),('yellow',center),('white',ink)])
OUTPUT.write_text(json.dumps(data,separators=(',',':'))+'\n')
print(len(data['vertices']),{k:len(v)//3 for k,v in data['faces'].items()},len(posts),OUTPUT.stat().st_size)
