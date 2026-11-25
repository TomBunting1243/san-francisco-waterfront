"""Clip paint to the same municipal asphalt, curb and gutter used by the scene."""
from pathlib import Path
import json
from shapely import Polygon, constrained_delaunay_triangles, union_all
from shapely.geometry import LineString

BASE = Path(__file__).resolve().parents[1] / 'public/data'

def read(name):
    return json.loads((BASE / name).read_text())

def road_paint_surface(bounds, edge_bounds):
    blocks=read('survey-blocks.json')['streets']
    curbs=read('curb-survey.json')
    corners=read('fremont-corner-curbs.json')['stations']
    def parcels(kind):
        for i,poly in enumerate(blocks[kind]):
            for part,(outer,*holes) in enumerate(curbs['overrides'].get(kind,{}).get(str(i),[poly])):
                adjusted=corners.get(kind,{}).get(str(i))
                if part==0 and adjusted:
                    outer=[p for j,point in enumerate(outer) for p in adjusted.get(str(j),[point])]
                p=Polygon(outer,holes)
                if p.intersects(bounds):yield p
    road=union_all(list(parcels('street'))).difference(union_all([*parcels('curb'),*parcels('sidewalk')]))
    faces=[];gutters=[]
    def offset(station,dist):return station[0]+station[2]*dist,station[1]+station[3]*dist
    for _,_,stations in curbs['lines']:
        for a,b in zip(stations,stations[1:]):
            segment=LineString([a[:2],b[:2]])
            # Include partial gutter runs where a traced line reaches the plate edge.
            partial=not bounds.covers(segment)
            if partial and not edge_bounds.intersects(segment):continue
            back=.157 if min(a[4],b[4])<1 else .031
            qa,qb=offset(a,.0023),offset(b,.0023)
            face=Polygon([qa,qb,offset(b,-back),offset(a,-back)]).buffer(0)
            faces.append(face.intersection(edge_bounds) if partial else face)
            for coords,heights in [([offset(a,.037),offset(b,.037),qb],[.032,.032,.0315]),([offset(a,.037),qb,qa],[.032,.0315,.0315])]:
                p=Polygon(coords)
                if partial:p=p.intersection(edge_bounds)
                if p.area>1e-10:gutters.append((p,coords,heights))
    road=road.difference(union_all(faces))
    def triangles(region,terrain=None):
        result=[]
        for tri in constrained_delaunay_triangles(region).geoms:
            if tri.area<1e-8:continue
            verts=[]
            for x,z in list(tri.exterior.coords)[:3]:
                y=.031
                if terrain:
                    ((ax,az),(bx,bz),(cx,cz)),(A,B,C)=terrain
                    det=(bx-ax)*(cz-az)-(cx-ax)*(bz-az)
                    u=((x-ax)*(cz-az)-(cx-ax)*(z-az))/det
                    v=((bx-ax)*(z-az)-(x-ax)*(bz-az))/det
                    y=A+(B-A)*u+(C-A)*v
                verts.append([round(x,6),round(z,6),round(y+.00024,7)])
            result.append(verts)
        return result
    def surface_mark(polygon):
        region=polygon.intersection(road)
        fragments=[]
        for gutter,coords,hs in gutters:
            if region.intersects(gutter):
                fragments.extend(triangles(region.intersection(gutter),(coords,hs)))
                region=region.difference(gutter)
        fragments.extend(triangles(region))
        return fragments
    return surface_mark
