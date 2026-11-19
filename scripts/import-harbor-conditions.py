"""Bake SF Bay Ferry GTFS and NOAA hourly predictions. Pass an operator GTFS zip
and NOAA JSON from station 9414290, GMT, metric, MLLW, interval=h."""
import csv
from datetime import datetime, timedelta
from io import TextIOWrapper
import json
from pathlib import Path
import sys
from zipfile import ZipFile

out = Path(__file__).resolve().parents[1] / 'public/data'
archive = ZipFile(sys.argv[1])
def rows(name):
    with archive.open(name+'.txt') as stream:
        return list(csv.DictReader(TextIOWrapper(stream, encoding='utf-8-sig')))

def minutes(t):
    h,m,_=map(int,t.split(':'))
    return h*60+m

info=rows('feed_info')[0]
start,end=[datetime.strptime(info[k],'%Y%m%d') for k in ('feed_start_date','feed_end_date')]
services=rows('calendar')
exceptions=rows('calendar_dates')
trips={r['trip_id']:r for r in rows('trips')}
routes={r['route_id']:r['route_short_name'] for r in rows('routes')}
times={}
for r in rows('stop_times'):
    times.setdefault(r['trip_id'],[]).append(r)
platforms={'72011':'E','72012':'G','72013':'F'}
stops={r['stop_id']:r['stop_name'].replace(' Ferry Terminal','').replace(' Ferry Dock','') for r in rows('stops')}
calls=[];turns={}
for tid,st in times.items():
    st.sort(key=lambda r:int(r['stop_sequence']))
    for i,s in enumerate(st):
        gate=platforms.get(s['stop_id'])
        if not gate: continue
        if i<len(st)-1:
            call=[minutes(s['departure_time']),gate,routes[trips[tid]['route_id']],st[i+1]['stop_id'],'out']
            calls.append((trips[tid]['service_id'],call))
            turns.setdefault((trips[tid]['service_id'],trips[tid]['block_id']),[]).append(call)
        if i>0:
            call=[minutes(s['arrival_time']),gate,routes[trips[tid]['route_id']],st[i-1]['stop_id'],'in']
            calls.append((trips[tid]['service_id'],call))
            turns.setdefault((trips[tid]['service_id'],trips[tid]['block_id']),[]).append(call)
for block in turns.values():
    previous=None
    for call in sorted(block,key=lambda c:(c[0],c[4])):
        if call[4]=='out' and previous and previous[4]=='in' and call[1]==previous[1] and call[0]-previous[0]<=90:
            call.append(previous[0])
        previous=call
days=[];patterns=[]
date=start
while date<=end:
    stamp=date.strftime('%Y%m%d')
    active={s['service_id'] for s in services if s[date.strftime('%A').lower()]=='1' and s['start_date']<=stamp<=s['end_date']}
    for e in exceptions:
        if e['date']==stamp:
            if e['exception_type']=='1': active.add(e['service_id'])
            else: active.discard(e['service_id'])
    entries=sorted([c for sid,c in calls if sid in active])
    if entries not in patterns: patterns.append(entries)
    days.append(patterns.index(entries))
    date+=timedelta(days=1)
def write(name,obj):
    (out/name).write_text(json.dumps(obj,separators=(',',':'))+'\n')
write('harbor-timetable.json',dict(start=start.date().isoformat(),end=end.date().isoformat(),version=info['feed_version'],days=days,
    stops={k:v for k,v in stops.items() if any(k==c[3] for _,c in calls)},patterns=patterns))
pred=json.loads(Path(sys.argv[2]).read_text())['predictions']
ts=[datetime.strptime(r['t'],'%Y-%m-%d %H:%M') for r in pred]
assert all(b-a==timedelta(hours=1) for a,b in zip(ts,ts[1:]))
write('harbor-tide-hours.json',dict(start=ts[0].isoformat()+'Z',cm=[round(float(r['v'])*100) for r in pred]))
