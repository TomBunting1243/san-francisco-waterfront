"""Register the Market city-side landing in the existing curb, walk and road survey."""
from shapely import Polygon, box, constrained_delaunay_triangles, union_all

def apply_market_west_landing(data,streets):
    plate=lambda x,z: ((x+56)*132,(2-z)*132)
    world=lambda u,v: (-56+u/132,2-v/132)
    def surface(z):
        return min(.139,.0315+max(0,min(-6.249-z,z+9.066))/12)
    def triangles(poly):
        for tri in constrained_delaunay_triangles(poly).geoms:
            if tri.area>1e-11:yield list(tri.exterior.coords)[:3]
    def regions(poly):
        if poly.is_empty:return
        if poly.geom_type=='Polygon':
            ring=lambda r:[[round(x,7),round(z,7)] for x,z in list(r.coords)[:-1]]
            yield [ring(poly.exterior),*[ring(h) for h in poly.interiors]]
        else:
            for part in getattr(poly,'geoms',[]):yield from regions(part)
    def interp(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
    def sample(r,u):
        i=next((i for i in range(1,len(r)) if r[i][0]>=u),len(r)-1)
        a,b=r[i-1:i+1]
        return interp(a[1:],b[1:],(u-a[0])/(b[0]-a[0]))
    # Existing ROW marks the sides of the former street throat. The 2024
    # orthophoto shows one uninterrupted transversely graded curb here.
    runs={id:p for id,_,p in data['lines']}
    south=runs[3819277][-1];north=runs[3819446]
    su,sv=plate(*south[:2]);nu=7350
    a,b=north[:2];f=(world(nu,0)[0]-a[0])/(b[0]-a[0])
    join=list(interp(a,b,f));north[0]=join
    nv=plate(*join[:2])[1]
    # California's registered curb repairs refer to stable row indices. Keep the
    # original survey slots while suppressing these obsolete throat sides.
    retired=[3852263,3819278,3834194,3814052]
    lip=[(su,sv),(7204,1074),(7316,1080),(nu,nv)]
    # Correspondence between street lip and back of the stone apron. Insets
    # are material outlines from the aerial, not surveyed slope-break heights.
    back=[(su,su-1,sv+6),(7204,7195,1101),(7316,7310,1118),(nu,nu-1,nv+6)]
    panel=Polygon([world(*p) for p in [(7210,1075),(7305,1080),(7301,1105),(7206,1091)]])
    outline=Polygon([world(*p) for p in [(7204,1074),(7316,1080),(7310,1118),(7195,1101)]])
    us=[su,7204,7205,7220,7293,7314,7316,nu]
    rows=[];curb=[]
    def ground_point(u,v,h):
        x,z=world(u,v);return [round(x,7),round(h,7),round(z,7)]
    for u in us:
        v=sample(lip,u)[0];bu,bv=sample(back,u)
        tangent=(sample(lip,u+.05)[0]-sample(lip,u-.05)[0])/.1
        nx,nz=tangent/(1+tangent*tangent)**.5,1/(1+tangent*tangent)**.5
        if u==su:nx,nz=south[2:4]
        if u==nu:nx,nz=join[2:4]
        if u<=7205:h=.1524+(.12-.1524)*(u-su)/(7205-su)
        elif u<7220:h=.12*(7220-u)/15
        elif u<=7293:h=0
        elif u<7314:h=.14*(u-7293)/21
        else:h=.14+(.1524-.14)*(u-7314)/(nu-7314)
        x,z=world(u,v);q=h/.1524
        curb.append([round(x,7),round(z,7),round(nx,7),round(nz,7),round(q,6),.031])
        # First edge is the back of the curb lip. Center stays flush through
        # the LiDAR sample band. The back transitions to the existing ramp.
        top=.0315+.06*h
        front=[round(x-.011*nx,7),round(top,7),round(z-.011*nz,7)]
        end_grade=max(.0451,surface(world(bu,bv)[1])+.00035)
        near=interp(front,ground_point(bu,bv,end_grade),min(.5,6/max(1,bv-v)))
        near=list(near);near[1]=top+(end_grade-top)*(.10 if h>.001 else .012)
        endu=bu-(1138-bv)*.177
        if u==su or u==nu:
            # The adjoining surveyed curb cap reaches .0451 at .031 behind
            # the lip; match that endpoint before proceeding up the footway.
            near=[round(x-.031*nx,7),.0451,round(z-.031*nz,7)]
        outer=u==su or u==nu
        def side_grade(v):
            z=world(0,v)[1]
            # South is the original road-bed approach; north is surveyed
            # sidewalk. Both meet the same rising granite axis inland.
            underlying=.031 if u==su else .045
            return max(underlying,surface(z)+.00035) if z<=-6.249 else underlying
        if outer:end_grade=side_grade(bv)
        far=ground_point(endu,1138,surface(world(endu,1138)[1])+.00035)
        rear=ground_point(bu,bv,end_grade)
        intermediate=[]
        for level in [(2+6.249)*132, (2+6.249+(.045-.0315-.00035)*12)*132]:
            at=max(bv,min(1138,level))
            p=list(interp(rear,far,(at-bv)/(1138-bv)))
            if outer:p[1]=side_grade(at)
            intermediate.append(p)
        rows.append(([x+.037*nx,.032,z+.037*nz],front,near,rear,*intermediate,far))
    data['lines'].append([-202402,0,curb])
    pieces={'border':[],'inset':[],'walk':[],'remainder':[]}
    def xyz_on_tri(points,tri):
        a,b,c=tri
        X,Z=b[0]-a[0],b[2]-a[2];Y,W=c[0]-a[0],c[2]-a[2]
        den=X*W-Y*Z
        def at(x,z):
            f=((x-a[0])*W-(z-a[2])*Y)/den;g=(X*(z-a[2])-Z*(x-a[0]))/den
            return [round(x,7),round(a[1]+f*(b[1]-a[1])+g*(c[1]-a[1]),7),round(z,7)]
        return [at(*p) for p in points]
    footprints=[]
    for a,b in zip(rows,rows[1:]):
        for j in range(len(a)-1):
            for tri in [[a[j],b[j],b[j+1]],[a[j],b[j+1],a[j+1]]]:
                poly=Polygon([(x,z) for x,_,z in tri]);footprints.append(poly)
                if j==0 or poly.area<1e-10:continue
                for kind,region in [('inset',poly.intersection(panel)),('border',poly.intersection(outline).difference(panel)),('walk',poly.difference(outline))]:
                    for face in triangles(region):pieces[kind].append(xyz_on_tri(face,tri))
    patch=union_all(footprints)
    # Retain exact uncut sections of the original graded granite ribbon.
    axis=lambda z:-.13+(z+1.813)*.177
    strip=Polygon([(axis(z)+side,z) for z,side in
        [(-6.249,-.92),(-6.249,.92),(-6.249-5*2.817/32,.92),(-6.249-5*2.817/32,-.92)]])
    # In the short surviving parts of the old ribbon, retain whichever
    # finish was previously exposed. Do not put granite below the sidewalk
    # or keep the street bed behind the same visible granite surface.
    higher=[]
    for kind,h in [('sidewalk',.045),('curb',.049),('private',.032),('alley',.032)]:
        height_line=-6.249-(h-.0315-.00035)*12
        higher_side=box(-3,height_line,.3,-6.20)
        for n,p in enumerate(streets.get(kind,[])):
            for outer,*holes in data['overrides'].get(kind,{}).get(str(n),[p]):
                poly=Polygon(outer,holes)
                if poly.intersects(strip):higher.append(poly.intersection(higher_side))
    remainder_domain=strip.difference(patch).difference(union_all(higher))
    for i in range(5):
        z=-6.249-i*2.817/32;z1=-6.249-(i+1)*2.817/32
        a,b,c,d=[(axis(y)+side,y) for y,side in [(z,-.92),(z,.92),(z1,-.92),(z1,.92)]]
        for t in [[a,b,c],[b,d,c]]:
            base=[[x,surface(y)+.00035,y] for x,y in t]
            for face in triangles(Polygon(t).intersection(remainder_domain)):pieces['remainder'].append(xyz_on_tri(face,base))
    # Remove parcel surfaces under this replacement only; road and sidewalk
    # boundary nodes retain sub-millimetre precision at the shared perimeter.
    cuts={}
    pavedRoad=union_all([Polygon(p[0],p[1:]) for p in streets['street']])
    # Fill the sliver between the new gutter and the old digitized road end.
    fill=[]
    for a,b in zip(rows,rows[1:]):
        p,q=a[0],b[0]
        apron=Polygon([(p[0],p[2]),(q[0],q[2]),(q[0],q[2]+.12),(p[0],p[2]+.12)])
        fill.extend([[[round(x,7),.031,round(z,7)] for x,z in tri] for tri in triangles(apron.difference(pavedRoad).difference(patch))])
    fills=union_all([Polygon([(x,z) for x,_,z in tri]) for tri in fill])
    cut=patch.union(fills).union(remainder_domain)
    for kind in ('street','sidewalk','curb','private','alley'):
        for i,p in enumerate(streets.get(kind,[])):
            existing=data['overrides'].get(kind,{}).get(str(i),[p])
            remainder=[];changed=False
            for outer,*holes in existing:
                poly=Polygon(outer,holes)
                if poly.intersection(cut).area<1e-10:remainder.append([outer,*holes]);continue
                changed=True;remainder.extend(regions(poly.difference(cut)))
            if changed:cuts.setdefault(kind,{})[str(i)]=remainder
    data['westCityLanding']={**pieces,'road':fill,'cuts':cuts,'retiredCurbs':retired}
