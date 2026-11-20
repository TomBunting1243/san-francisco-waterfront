"""Partition the Chestnut asphalt with paint traced on the 2024 SF orthophoto."""
from bisect import bisect_right
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union


def mark_chestnut(streets):
    # The 112 px/unit plate starts at (80,-11). Shear the image along the
    # avenue solely to make the transverse bars and lane-drop stations legible.
    def world(u,v):
        return 80+u/112, -11+(660+v-.20*u)/112

    shapes={key:[] for key in ('cycle','lane','yellow')}
    def stroke(key,points,width):
        axis=LineString([world(*p) for p in points])
        shapes[key].append(axis.buffer(width/224,cap_style='flat',join_style='mitre'))

    # Breakpoints follow the bend beyond Pier 31. The observed street-side
    # white stripe and the green pavement have distinct extents at the entry.
    axis=[(-22,277),(220,277.5),(590,278),(920,279),(1100,280),
          (1180,279.5),(1260,278),(1330,274.5),(1400,268.5),(1470,259.5),
          (1540,249),(1610,236.5),(1680,221.5)]
    def lane_edge(u):
        i=max(0,min(len(axis)-2,bisect_right([p[0] for p in axis],u)-1))
        a,b=axis[i:i+2]
        return a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0])
    def path(a,b,offset):
        return [(u,lane_edge(u)+offset) for u in [a,*[x for x,_ in axis if a<x<b],b]]
    for a,b in [(-22,178),(432,1680)]:
        shapes['cycle'].append(Polygon([world(*p) for p in path(a,b,0)+path(a,b,11.85)[::-1]]))
    for a,b in [(-22,178),(221,1680)]:
        stroke('lane',path(a,b,0),1.1)
    for offset in [-21,-43]:
        for a,b in [(-22,171),(216,407)]:
            stroke('lane',path(a,b,offset),1.35)
    # Two very different skip patterns separate the through lanes and turn lane.
    # Start/dash lengths are digitized; the last few faded skips follow their cadence.
    starts=[418,464,515,565,622,669,718,765,814,862,911,960,1008,1055,1102,1150,
            1199,1248,1296,1343,1391,1437,1483,1530,1576,1622,1668]
    for u in starts:
        stroke('lane',path(u,min(1680,u+15),-21),1.2)
    for u in range(461,1678,30):
        stroke('lane',path(u,min(1680,u+7),-43),1.15)

    # Six continental bars in each main carriageway, plus the short seventh
    # at the western curb ramp. Their ends step north as the walk crosses the street.
    for u,v,end in [(161,38,175),(136,48,179),(138,58,181),(140,69,183),
                    (142,79.5,185),(144,90,187),(147,100.5,189),
                    (171,224,212),(173,234.5,214),(175,245,217),
                    (177,256,219),(179,266.5,221),(181,277,224)]:
        stroke('lane',[(u,v),(end,v)],4.5)
    stroke('lane',[(145,216),(157,277)],2.0)
    stroke('lane',[(193,113.5),(200,113.5),(202,115),(221,203),(220,210),(217,212),(165,212)],1.3)
    for u,v in [(197,128),(202,149),(207,169),(214,200)]:
        stroke('lane',[(u,v),(u+5,v-8)],1.5)

    # A curved nose, diagonal hatch and short loading-zone hatch appear on the
    # 2024 plate. The rails cross this painted region on their own rail heads.
    stroke('yellow',[(0,113),(193,113)],1.1)
    stroke('yellow',[(295,113),(308,150),(330,181),(349,200),(361,207),(380,212),(697,213)],1.2)
    stroke('yellow',[(295,113),(770,113)],1.2)
    for u in [308,349,390,432,473,514]:
        stroke('yellow',[(u,113),(u+75,212)],1.25)
    stroke('yellow',[(556,149),(600,194)],1.25)
    stroke('yellow',[(494,133),(721,133),(763,119),(775,113)],1.15)
    for u in [473,514,555,596,637,678,716]:
        stroke('yellow',[(u,113),(u+20,133)],1.15)
    stroke('yellow',[(317,121),(319,117),(326,116),(357,136),(359,140),(355,144),(322,145),(318,141),(317,121)],1.15)

    # Remove each painted footprint from the asphalt. All adjoining faces now
    # share one elevation and one boundary, even at shallow driving angles.
    # The white crossing and lane rules take precedence over cycle infill.
    paint={key:unary_union(values) for key,values in shapes.items()}
    paint['yellow']=paint['yellow'].difference(paint['lane'])
    paint['cycle']=paint['cycle'].difference(paint['lane'].union(paint['yellow']))
    ink=unary_union(list(paint.values()))
    out=[]; markings={key:[] for key in paint}
    def append_polygons(target,g):
        if g.is_empty:return
        if g.geom_type!='Polygon':
            for piece in getattr(g,'geoms',[]):append_polygons(target,piece)
            return
        if g.area<1e-9:return
        target.append([[[round(x,8),round(z,8)] for x,z in list(r.coords)[:-1]] for r in [g.exterior,*g.interiors]])
    for plan in streets:
        surface=Polygon(plan[0],plan[1:])
        if surface.bounds[2]<79.8 or surface.bounds[0]>95 or not surface.intersects(ink):
            out.append(plan)
            continue
        append_polygons(out,surface.difference(ink))
        for key,area in paint.items():append_polygons(markings[key],surface.intersection(area))
    return out,markings
