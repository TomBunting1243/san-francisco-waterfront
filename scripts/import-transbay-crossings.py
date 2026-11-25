"""Rebuild the Transbay intersections from 2024 city orthophoto traces.
Run with the project's Shapely >=2.1 survey interpreter. Optional --plates DIR
writes rectified reference JPEGs from the city's zoom-20 tile service
(needs Pillow). All source pixels below are in these unshifted plates at 200 px
per scene unit. Direction and widths come from the paint, not the street axis.
"""
from pathlib import Path
import argparse,json,math
from shapely import Polygon
from shapely.geometry import box
from road_paint_surface import road_paint_surface
BASE=Path(__file__).resolve().parents[1]/'public/data'
C,S=.988686,-.150004
# Centers are the bounding-box centers of SFMTA ROW polygons, projected before
# registration. Screen coordinates are along Beale/Main (right) and toward
# the bay along Howard/Mission (down). Edges are endpoints of first/last bars.
sites=[
 ('Mission / Main',[-15.375873,-20.810637],[
 ('inland',(195,150,195,202),(396,150,396,202),[[193,200],[211,218],[230,234],[248,254],[266,271],[306,309],[321,328],[340,345],[358,363],[376,382],[395,401]],False),
 ('bay',(214,398,214,452),(397,398,397,451),[[230,237],[249,253],[269,273],[289,292],[303,310],[323,329],[340,346],[360,366],[379,384],[394,401]],False),
 ('south',(131,227,186,227),(155,375,210,375),[[224,231],[242,249],[260,267],[279,286],[298,304],[316,322],[335,340],[355,359],[373,377]],True),
 ('north',(410,221,463,221),(410,386,463,386),[[218,224],[237,242],[255,260],[273,279],[294,299],[313,318],[330,334],[348,353],[366,372],[384,392]],True)]),
 ('Mission / Beale',[-16.389149,-27.262508],[
 ('inland',(230,134,230,186),(405,133,405,184),[[227,234],[246,253],[264,271],[282,289],[299,306],[315,322],[331,339],[348,355],[365,373],[384,392],[402,410]],False),
 ('bay',(208,393,207,450),(407,405,407,460),[[204,212],[222,230],[240,248],[259,266],[276,284],[294,301],[312,319],[331,339],[349,356],[368,375],[386,393],[404,411]],False),
 ('south',(157,215,213,215),(137,372,194,372),[[212,219],[230,238],[248,256],[266,274],[287,294],[307,314],[328,336],[349,357],[368,376]],True),
 ('north',(415,203,469,203),(414,399,474,399),[[200,208],[219,225],[236,244],[275,282],[294,301],[313,321],[332,339],[350,357],[368,375],[386,393]],True)]),
 ('Howard / Main',[-26.809376,-19.130576],[
 ('inland',(213,143,213,208),(386,142,386,208),[[211,218],[229,236],[247,254],[267,274],[287,294],[308,315],[327,334],[346,353],[364,371],[383,389]],False),
 ('bay',(225,406,225,462),(399,406,399,461),[[220,225],[240,247],[258,265],[276,283],[294,302],[319,322],[335,338],[350,352],[365,368],[380,384],[399,402]],False),
 ('south',(153,212,202,212),(153,385,202,385),[[212,215],[227,234],[246,249],[291,295],[305,312],[323,328],[337,340],[353,355],[367,370],[383,386]],True),
 ('north',(416,245,472,245),(416,382,472,382),[[242,249],[260,267],[278,285],[292,300],[309,316],[324,331],[342,347],[361,368],[379,386]],True)]),
 ('Howard / Beale',[-27.825250,-25.574915],[
 ('inland',(214,131,214,182),(413,132,413,187),[[215,220],[231,239],[249,256],[268,274],[284,292],[302,309],[320,328],[338,345],[356,363],[374,381],[392,399],[410,417]],False),
 ('bay',(219,410,219,457),(393,407,393,460),[[216,224],[235,241],[253,260],[275,282],[297,304],[316,322],[333,341],[352,360],[369,377],[389,395]],False),
 ('south',(155,190,208,190),(155,395,207,395),[[189,194],[205,212],[224,230],[242,249],[279,286],[340,344],[355,363],[374,378],[392,400]],True),
 ('north',(420,197,473,197),(420,326,474,326),[[193,200],[211,218],[229,237],[248,255],[266,274],[284,292],[303,310],[321,329]],True)]),
 # The thin northern stripes on the inland and north legs remain visible in
 # shadow. On the south leg omit the foliage-obscured station below bar 7.
 ('Howard / Spear',[-25.894,-12.650],[
 ('inland',(235,149,235,209),(410,152,410,211),[[232,239],[250,257],[269,275],[287,293],[305,311],[323,325],[344,346],[356,358],[367,369],[376,378],[387,389],[397,399],[409,411]],False),
 ('bay',(224,401,224,456),(400,401,400,459),[[221,227],[238,245],[257,263],[275,281],[291,297],[306,313],[326,333],[346,352],[363,369],[379,385],[397,403]],False),
 ('south',(173,220,218,220),(175,379,218,379),[[217,224],[235,242],[254,261],[272,279],[291,297],[309,316],[327,332],[357,360],[378,380]],True),
 ('north',(429,222,472,222),(432,394,476,394),[[220,223],[229,232],[241,244],[251,254],[261,264],[274,277],[287,291],[301,308],[319,326],[338,345],[356,363],[375,381],[392,396]],True)])]
# Thick transverse limit lines, independently traced from the same ortho.
# The thin eastbound parking-hatch boundary (u=221..240) is a different mark.
# Southbound Spear's aligned stripe remains visible on both sides of a vehicle.
stop_bars={'Howard / Spear':[
    ('Howard eastbound',[(240,109),(278.5,109.8),(278.5,114),(240,113.5)]),
    ('Howard westbound',[(279.5,492.4),(345.8,492),(345.8,496),(279.5,496.6)]),
    ('Spear southbound',[(512.1,219.5),(515.9,219.5),(516.9,346.5),(512.8,346.5)]),
]}
def world(center,p):
 u,v=(p[0]-300)/200,(p[1]-300)/200
 return [round(center[0]+C*u-S*v,6),round(center[1]+S*u+C*v,6)]
def mid(a):return [(a[0]+a[2])/2,(a[1]+a[3])/2]
def write_plates(folder):
 from PIL import Image
 from urllib.request import urlopen
 from io import BytesIO
 folder.mkdir(parents=True,exist_ok=True);tiles={}
 def pixel(pt):
  x,z=pt;e=(-.03552029735*x+.04836012986*z)/.0036;n=(.04836012986*x+.03552029735*z)/.0036
  lon=-122.39348+e/(111320*math.cos(math.radians(37.79554)));lat=37.79554+n/111320;w=2**20*256
  return (lon+180)/360*w,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*w
 for name,center,_ in sites:
  w,h=(1500,720) if name=='Howard / Beale' else (600,600)
  corners=[pixel(world(center,pt)) for pt in [(0,0),(w,0),(0,h),(w,h)]]
  left,top=[int(n/256) for n in map(min,zip(*corners))];right,bottom=[int(n/256) for n in map(max,zip(*corners))]
  m=Image.new('RGB',((right-left+1)*256,(bottom-top+1)*256))
  for i in range(left,right+1):
   for j in range(top,bottom+1):
    if (i,j) not in tiles:
     with urlopen(f'https://tile.sf.gov/api/tiles/p2024_rgb8cm/20/{i}/{j}',timeout=20) as src:
      tiles[i,j]=Image.open(BytesIO(src.read())).convert('RGB').resize((256,256))
    m.paste(tiles[i,j],((i-left)*256,(j-top)*256))
  (x,y),(a,b),(c,d),_=corners
  plate=m.transform((w,h),Image.Transform.AFFINE,((a-x)/w,(c-x)/h,x-left*256,(b-y)/w,(d-y)/h,y-top*256),Image.Resampling.BICUBIC)
  plate.save(folder/(name.replace(' / ','-')+'.jpg'),quality=95)
def howard_beale_bulb():
    """2024 modern edge and polygon of added paving relative to active SFMTA
    curb traces. The polygon closes through the terminal driveway apron; that
    short administrative seam is not a curb. See --plates for registration.
    """
    center=sites[3][1]
    # Near end joins the historic Howard edge. Curve and long tangent continue
    # along Beale to the eastern apron of the transit-center driveway.
    edge=[(409,504),(404,469),(402,455),(400,438),(400,418),(398,402),
          (398,390),(401,377),(405,367),(411,359),(418,351),(425,345),
          (431,340),(439,337),(447,335),(458,334),(482,334),(540,334),
          (585,334),(620,335),(650,336),(680,339),(720,343),(780,350),
          (840,357),(900,364),(950,369),(1000,375),(1050,381),(1090,385),
          (1100,387),(1110,391),(1118,396),(1124,401),(1128,407),
          (1131,414),(1132,422),(1132,431)]
    # Measured legacy edge in the same frames from 2024 SFMTA curbs.geojson:
    # 3817469 straight Howard, 3827192 old arc, 3817470 straight Beale, then
    # 3789432 at the terminal driveway. Last station interpolates this trace.
    old=[(409,504),(409,462),(408,458),(409,450),(412,442),(415,435),
         (420,429),(426,424),(433,421),(441,419),(443,418),(1016,422),
         (1051,422),(1060,431)]
    pts=lambda coords:[world(center,p) for p in coords]
    # Six individual planted beds separated by light cross-aisles. Traced
    # from the 2024 Beale frontage in the wide plate. Keep the tactile pad and
    # the Howard turning corner clear. Plant species are unresolved.
    beds=[
        [(505,359),(562,357),(569,360),(569,398),(519,398),(512,393),(506,377)],
        [(583,358),(673,359),(680,363),(679,399),(588,399),(582,389)],
        [(694,363),(786,370),(790,375),(789,400),(697,400),(692,393)],
        [(806,373),(884,381),(891,387),(890,401),(809,401),(803,393)],
        [(906,382),(940,386),(943,397),(949,398),(948,409),(908,409),(904,404)],
        [(972,390),(1019,389),(1033,395),(1032,410),(1022,416),(978,415),(968,409)]
    ]
    return {'beds':[pts(ring) for ring in beds],'edge':pts(edge),'oldEdge':pts(old),'addedPaving':pts(edge+list(reversed(old[1:]))),
            'landing':world(center,(446,353)),'curbToe':world(center,(446,335)),
            'sourceIds':[3817469,3827192,3817470,3789432]}

def crossing_axes():
 return {name:[dict(side=side,axis=[world(center,mid(a)),world(center,mid(b))]) for side,a,b,_,_ in legs] for name,center,legs in sites}

def build(axes):
    spear_bounds=box(-27.5,-14.3,-24.3,-11.0)
    surface_mark=road_paint_surface(box(-30,-30,-13,-17).union(spear_bounds),spear_bounds)
    out=[]
    for name,center,legs in sites:
        records=[]
        for (side,a,b,bars,vertical),coord in zip(legs,axes[name]):
            index=1 if vertical else 0
            def edge(t,which):
                frac=(t-a[index])/(b[index]-a[index])
                pt=[a[which]+frac*(b[which]-a[which]),a[which+1]+frac*(b[which+1]-a[which+1])]
                pt[index]=t
                return world(center,pt)
            marks=[]
            for low,high in bars:
                corners=[edge(low,0),edge(high,0),edge(high,2),edge(low,2)]
                fragments=surface_mark(Polygon(corners))
                if fragments:marks.append(fragments)
            records.append({**coord,'marks':marks})
        site={'name':name,'center':center,'legs':records}
        if name in stop_bars:
            site['stopBars']=[{'approach':approach,'triangles':surface_mark(Polygon([world(center,p) for p in corners]))}
                              for approach,corners in stop_bars[name]]
        out.append(site)
    data={'source':'https://sfplanninggis.org/1938/','imagery':'SF 2024 RGB 8 cm','sites':out}
    (BASE/'transbay-crossings.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
    print([(site['name'],[len(leg['marks']) for leg in site['legs']]) for site in out])

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--plates',type=Path)
 parser.add_argument('--axes',action='store_true');args=parser.parse_args()
 if args.plates:write_plates(args.plates)
 axes=crossing_axes()
 if args.axes:print(json.dumps(axes));return
 build(axes)
if __name__=='__main__':main()
