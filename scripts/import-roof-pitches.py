"""Fit continuous roof planes to observed USGS 2023 San Francisco LiDAR returns.
Usage: python scripts/import-roof-pitches.py <san-francisco-2023 cache>
Requires the downtown-grid.npz produced by import-downtown-roofs.py.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from affine import Affine
from rasterio.features import geometry_mask
from scipy.ndimage import distance_transform_edt
from shapely.geometry import Polygon, mapping

DATA=Path(__file__).resolve().parents[1]/'public/data'
X0,Z0,CELL,SCALE=-99,-118,.09,.06
METRES=CELL/SCALE

def robust(matrix,y):
    keep=np.ones(len(y),dtype=bool)
    for _ in range(4):
        if keep.sum()<matrix.shape[1]+3:return None
        p=np.linalg.lstsq(matrix[keep],y[keep],rcond=None)[0]
        err=np.abs(y-matrix@p)
        next_keep=err<max(.38,2.6*np.median(err))
        if np.array_equal(keep,next_keep):break
        keep=next_keep
    return p

def fit(x,z,y,xx,zz,edges,foot):
    matrix=np.column_stack((x,z,np.ones(len(y))))
    plane=robust(matrix,y)
    if plane is None:return
    d0,d1=edges
    def score(pieces):
        predicted=np.min(np.stack([matrix@p for p in pieces]),axis=0)
        err=np.abs(y-predicted)
        if np.percentile(err,83)>.57 or np.mean(err<.44)<.78:return
        # Neighboring observed cells must rise smoothly where the model does.
        # A level terrace plus vertical step can otherwise mimic a gable in least squares.
        jumps=predicted[d1]-predicted[d0]
        active=np.abs(jumps)>.095
        if active.sum()<18:return
        measured=y[d1[active]]-y[d0[active]]
        expected=jumps[active]
        agreement=(np.sign(expected)*measured>np.maximum(.035,.28*np.abs(expected)))&(np.abs(measured-expected)<.48)
        if agreement.mean()<.64:return
        if np.percentile(predicted,90)-np.percentile(predicted,10)<.91:return
        return float(np.mean(np.minimum(err,1.)**2)**.5)

    best=None
    if .115<=np.linalg.norm(plane[:2])<=1.25:
        quality=score([plane])
        if quality is not None:best=(quality,[plane])
    # Local plane gradients from contiguous observations provide a test independent
    # of the rectangular footprint axes (including oblique roofs).
    index={(int(col),int(row)):i for i,(col,row) in enumerate(zip(xx,zz))}
    gradients=[]
    for i,(col,row) in enumerate(zip(xx,zz)):
        near=[index.get((col-1,row)),index.get((col+1,row)),index.get((col,row-1)),index.get((col,row+1))]
        if None in near:continue
        left,right,top,bottom=near
        g=np.array([(y[right]-y[left])/(2*METRES),(y[bottom]-y[top])/(2*METRES)])
        if .14<np.linalg.norm(g)<1.2:gradients.append(g)
    if len(gradients)<18:return best
    grad=np.array(gradients)
    if len(grad)>3500:grad=grad[::math.ceil(len(grad)/3500)]
    covariance=np.cov(grad.T)
    normal=np.linalg.eigh(covariance)[1][:,-1]
    axes=[normal]
    # Gradients on a true pitched roof reverse across a spatially continuous ridge.
    # A weak second mode alone is insufficient even if the envelope fits several vents.
    box=np.asarray(foot.minimum_rotated_rectangle.exterior.coords)
    for j in [0,1]:
        axis=box[j+1]-box[j];axis/=np.linalg.norm(axis)
        if abs(axis@normal)>.85 and abs(axis@normal)<.999:axes.append(axis)
    for axis in axes:
        slopes=grad@axis
        if min(np.mean(slopes>.10),np.mean(slopes<-.10))<.18:continue
        t=x*axis[0]+z*axis[1]
        for ridge in np.quantile(t,np.linspace(.22,.78,13)):
            hinge=np.maximum(t-ridge,0)
            model=robust(np.column_stack((matrix,hinge)),y)
            if model is None:continue
            p=model[:3];q=p+model[3]*np.array([axis[0],axis[1],-ridge])
            if p[:2]@axis<.13 or q[:2]@axis>-.13 or max(np.linalg.norm(p[:2]),np.linalg.norm(q[:2]))>1.25:continue
            pred=np.minimum(matrix@p,matrix@q)
            # Each flank must have its own sustained, measured rise and spatial support.
            passing=True
            for side in [t<ridge,t>=ridge]:
                if side.sum()<18 or np.ptp(t[side])<2.7 or np.percentile(np.abs(y[side]-pred[side]),80)>.53:
                    passing=False;break
                pairs=side[d0]&side[d1]&(np.abs(pred[d1]-pred[d0])>.10)
                if pairs.sum()<9:
                    passing=False;break
                diff=pred[d1[pairs]]-pred[d0[pairs]]
                if np.mean((y[d1[pairs]]-y[d0[pairs]])*np.sign(diff)>.04)<.65:
                    passing=False;break
            if not passing:continue
            quality=score([p,q])
            if quality is not None and (best is None or quality+.012<best[0]):best=(quality,[p,q])
    return best

def main():
    src=np.load(Path(sys.argv[1])/'downtown-grid.npz')
    dsm,ground=src['dsm'],src['ground']
    ground=ground[tuple(distance_transform_edt(~np.isfinite(ground),return_distances=False,return_indices=True))]
    buildings=json.loads((DATA/'sf-waterfront.json').read_text())['buildings']
    parents={b['parent'] for b in buildings if b.get('parent')}
    out={}
    for b in buildings:
        if b.get('part') or b['id'] in parents:continue
        poly=Polygon(b['p'])
        if not poly.is_valid or poly.area<.28 or poly.is_empty:continue
        cx,cz=poly.centroid.coords[0]
        if not (-95<cx<72 and -112<cz<26):continue
        a,v,c,d=poly.bounds
        i,j=max(0,int((a-X0)/CELL)),max(0,int((v-Z0)/CELL))
        k,l=min(dsm.shape[1],int((c-X0)/CELL)+2),min(dsm.shape[0],int((d-Z0)/CELL)+2)
        if k<=i or l<=j:continue
        guard=poly.buffer(-.055)
        if guard.is_empty:continue
        mask=geometry_mask([mapping(guard)],out_shape=(l-j,k-i),transform=Affine(CELL,0,X0+i*CELL,0,CELL,Z0+j*CELL),invert=True)
        surface=dsm[j:l,i:k]
        seen=mask&np.isfinite(surface)
        if seen.sum()<30 or seen.sum()<.8*mask.sum():continue
        zz,xx=np.nonzero(seen)
        ground_y=np.median(ground[j:l,i:k][mask])
        y=surface[seen].astype(float)-ground_y
        if np.percentile(y,7)<2.3 or np.ptp(np.percentile(y,[10,90]))<1.:continue
        x=(X0+(i+xx+.5)*CELL-cx)/SCALE;z=(Z0+(j+zz+.5)*CELL-cz)/SCALE
        index=np.full(mask.shape,-1);index[seen]=np.arange(len(y))
        dx=seen[:,:-1]&seen[:,1:];dz=seen[:-1,:]&seen[1:,:]
        edges=(np.r_[index[:,:-1][dx],index[:-1,:][dz]],np.r_[index[:,1:][dx],index[1:,:][dz]])
        result=fit(x,z,y,xx,zz,edges,poly)
        if result is None:continue
        quality,planes=result
        vertices=np.asarray(poly.exterior.coords)
        xy=(vertices-[cx,cz])/SCALE
        exterior=np.min(np.stack([xy@p[:2]+p[2] for p in planes]),axis=0)
        if np.min(exterior)<2.1 or np.max(y)-np.min(y)>15+np.ptp(exterior):continue
        # Prevent extrapolation over unsampled wings beyond the measured range.
        if np.min(exterior)<np.percentile(y,3)-1.8:continue
        if b.get('measured') and abs(float(np.median(y))*SCALE-b['h'])>max(.30,b['h']*.20):continue
        out[str(b['id'])]=[round(cx,4),round(cz,4),[[round(p[0],5),round(p[1],5),round(p[2]*SCALE,5)] for p in planes],len(y),round(quality,3)]
    output={'source':'https://s3-us-west-2.amazonaws.com/usgs-lidar-public/CA_SanFrancisco_1_B23/ept.json','cellMetres':METRES,'pitches':out}
    (DATA/'roof-pitches.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
    print('Accepted',len(out),'footprints;',sum(len(r[2])==2 for r in out.values()),'two-sided')
def check_fitter():
    # Compare tilted returns, a true ridge, two large flat terraces and random clutter on the same grid.
    zz,xx=np.indices((14,18))
    x=(xx.flatten()-8.5)*METRES;z=(zz.flatten()-6.5)*METRES
    idx=np.arange(len(x)).reshape(xx.shape)
    edges=(np.r_[idx[:,:-1].ravel(),idx[:-1,:].ravel()],np.r_[idx[:,1:].ravel(),idx[1:,:].ravel()])
    foot=Polygon([(-14,-11),(14,-11),(14,11),(-14,11)])
    rng=np.random.default_rng(2023)
    noise=rng.normal(0,.07,len(x))
    def result(y):return fit(x,z,y,xx.ravel(),zz.ravel(),edges,foot)
    shed=result(12+.24*x+.07*z+noise)
    gable=result(12-.36*np.abs(x-.5)+.03*z+noise)
    assert shed and len(shed[1])==1 and np.linalg.norm(shed[1][0][:2]-[.24,.07])<.025
    assert gable and len(gable[1])==2
    assert result(9+noise) is None
    assert result(10+3*(x>0)+noise) is None
    assert result(10+rng.normal(0,1.8,len(x))) is None
    print('Passed planar, ridge, flat, terrace and clutter source-grid checks')
if __name__=='__main__':
    if sys.argv[1:] == ['--self-test']:check_fitter()
    else:main()
