// Run from either checkout. Only read the city's approved export surface.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const here=name=>path.join(root,name);
const output='references/README.md';
const notes=['references/WATERFRONT-REFERENCE-AUDIT.md','references/ANGLER-FRONTAGE.md','references/RESEARCH-SOURCES.md'];
const num=n=>n.toLocaleString('en-US');
const order=(a,b)=>a<b?-1:a>b?1:0;
const label=s=>s.replaceAll('|','／').replace(/[\[\]]/g,'').trim();
const title=name=>path.basename(name).replace(/\.(?:test\.)?[a-z]+$/,'').replace(/^(?:import-|survey-)/,'').replace(/-/g,' ');
const publicSource=name=>notes.includes(name)||name==='THIRD-PARTY-NOTICES.md'||/^(?:(?:app|src)\/.*\.(?:ts|tsx)|public\/data\/.*\.json|scripts\/(?:import-|clip-|survey-).*\.(?:mjs|py)|tests\/.*\.test\.mjs)$/.test(name);
async function inputs(){
  if(fs.existsSync(here('scripts/city-export.mjs'))){
    const {sourceReader,createExport}=await import('./city-export.mjs');
    const bundle=createExport(sourceReader(root,'HEAD',true),'reference-catalog');
    for(const name of [output,...notes,'references/SURVEY-ASSETS.csv','scripts/catalog-city-references.mjs'])
      assert.ok(bundle.files.has(name),'missing public export entry '+name);
    return new Map([...bundle.files].filter(([name])=>publicSource(name)));
  }
  const files=new Map();
  function visit(dir){
    for(const entry of fs.readdirSync(here(dir),{withFileTypes:true})){
      const name=path.posix.join(dir,entry.name);
      if(entry.isDirectory())visit(name);
      else if(entry.isFile()&&publicSource(name))files.set(name,fs.readFileSync(here(name)));
    }
  }
  for(const dir of ['app','src','tests','scripts','references','public/data'])visit(dir);
  files.set('THIRD-PARTY-NOTICES.md',fs.readFileSync(here('THIRD-PARTY-NOTICES.md')));
  return files;
}
const files=await inputs();
for(const n of notes)assert.ok(files.has(n),'missing export input '+n);
const sources=new Map();
function add(raw,description,where,context){
  // Trim prose punctuation, but retain balanced parentheses inside filenames.
  let value=raw.replaceAll('&amp;','&').replace(/[.,;:]+$/,'');
  while(value.endsWith(')')&&value.split(')').length>value.split('(').length)value=value.slice(0,-1);
  if(value.includes('${')||/[{}`<>\\]/.test(value))return;
  let u;try{u=new URL(value);}catch{return;}
  if(!['http:','https:'].includes(u.protocol)||!u.hostname.includes('.')||u.hostname==='www.w3.org'||u.hostname==='example.com'||/\.local$|\.internal$|^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname))return;
  if(u.username||u.password||[...u.searchParams.keys()].some(k=>/token|signature|credential|api[_-]?key|^key$|auth|expires/i.test(k)))throw new Error('Private or temporary URL in '+where);
  // An empty bbox is the importer's interpolation prefix, not a recorded map extract.
  if([...u.searchParams].some(([k,v])=>k==='bbox'&&!v))return;
  const target=u.href;u.hash='';
  const key=u.href,record=sources.get(key)??{url:key,items:new Map(),descriptions:new Map()};
  if(!record.items.has(where))record.items.set(where,{context,targets:new Set()});
  record.items.get(where).targets.add(target);
  if(description)record.descriptions.set(description,(record.descriptions.get(description)??0)+1);
  sources.set(key,record);
}
for(const [name,buffer] of [...files].sort(([a],[b])=>order(a,b))){
  const lines=buffer.toString().split('\n');let section=title(name),anchor='';
  for(const [i,line] of lines.entries()){
    if(name.endsWith('.md')&&/^#{1,6} /.test(line)){
      section=line.replace(/^#+ /,'');
      anchor=section.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/ /g,'-');
    }
    if(!line.includes('http'))continue;
    const where=name+(name.endsWith('.md')&&anchor?'#'+anchor:name.endsWith('.md')?'':'#L'+(i+1));

    for(const hit of line.matchAll(/https?:\/\/[^\s<>"'`\]]+/g)){
      const prefix=line.slice(0,hit.index);
      const named=prefix.match(/\[([^\[\]]+)\]\($/);
      add(hit[0],named?.[1],where,section);
    }
  }
}

const types=['Photographs and imagery','Maps and plans','Data and services','Reports and technical documents','Licenses and credits','Additional published sources'];
function sourceType(record){
  const u=new URL(record.url),d=[...record.descriptions.keys()].join(' ').toLowerCase();
  if(/creativecommons.org|opendatacommons.org/.test(u.hostname)||/\/copyright\/?$|\/attribution\.md/i.test(u.pathname)||/^(license|rights)$/.test(d))return types[4];
  if(u.hostname==='kartaview.org'&&u.pathname.startsWith('/details/'))return types[0];
  if(/tile\.sf\.gov|image(server)?\b.*naip|naip.*imageserver/.test(record.url.toLowerCase()))return types[0];
  if(/\.(?:jpe?g|png|webp|tiff?)$/i.test(u.pathname)||/page.*photo|photograph|photo|aerial|orthoimagery|street view|gallery|panorama/i.test(d))return types[0];
  if(/openstreetmap\.org\/(?:way|node|relation)\//.test(record.url)||/floor plan|site plan|blueprint|elevation drawing|measured drawing|terminal map|survey map|map sheet|architectural drawing/i.test(d))return types[1];
  if(/data\.sf\.gov|data\.sfgov\.org|arcgis\/rest|ept\.json|api\.openstreetmap|gtfs|data\.opendatasoft|opendata\.aws|terrain-tiles|climate\.weather\.gc|api\.weather\.gov/i.test(record.url)||/dataset|inventory|lidar|data service/i.test(d))return types[2];
  if(/\.pdf$/i.test(u.pathname)||/report|specification|permit|technical|engineering|environmental review/i.test(d))return types[3];
  return types[5];
}
function packedUrban(d){
  let buildings=0,roads=0;
  for(const [,,buildings64,roads64] of d.tiles){
    const b=Buffer.from(buildings64,'base64'),r=Buffer.from(roads64,'base64');
    let i=0;while(i<b.length){
      const rings=b.readUInt8(i+8);i+=9;
      for(let j=0;j<rings;j++)i+=2+4*b.readUInt16LE(i);
      buildings++;
    }assert.equal(i,b.length);
    i=0;while(i<r.length){i+=3+4*r.readUInt16LE(i+1);roads++;}assert.equal(i,r.length);
  }
  assert.equal(buildings,d.counts.buildings);assert.equal(roads,d.counts.roads);
  return {buildings,roads};
}
const units={
 'bay-shore-cut':'points:mesh points', 'bierman-ground':'cm:elevation samples',
 'california-sidewalk':'ramps:curb ramps', 'california-terminal':'nodes:track nodes stops:stop records',
 'curb-survey':'lines:curb lines ramps:curb ramps', 'downtown-roofs':'roofs:roof measurements profiles:height profiles setbacks:setback records',
 'east-bay-shore':'coastalCells:coastal cells tidalVertices:tidal vertices','embarcadero-tracks':'ways:mapped ways',
 'folsom-portal':'sections:portal sections','frost-trees':'$:tree IDs','harbor-tide-hours':'cm:hourly water levels',
 'harbor-timetable':'days:service days stops:stop records', 'market-lights':'poles:lighting standards',
 'market-street':'platforms:platforms trees:tree records crossings:crossings','plaza-canopies':'$:crown geometries',
 'plaza-survey':'trees:tree records benches:bench records','promenade-crossings':'crossings:crossings',
 'promenade-light-grades':'$:pole grade records','promenade-lights':'curb:curbside standards inland:inland standards',
 'promenade-transit':'inbound:inbound route vertices outbound:outbound route vertices','radar-palette':'colors:radar color bins',
 'rincon-curb-edge':'wells:tree wells','roof-finishes':'finishes:roof finish records','roof-pitches':'pitches:pitched roof records',
 'sf-waterfront':'buildings:building features roads:road features piers:pier features art:art records',
 'sightline-streets':'street:road polygons sidewalk:sidewalk polygons curb:curb polygons bars:crossing stripes trees:tree records',
 'south-beach':'buildings:building features docks:dock features roads:road features','steuart-junction':'curves:track curves',
 'survey-blocks':'buildings:building features outsideRoads:road segments','survey-shore':'piles:pile positions decks:deck outlines',
 'surveyed-shopfronts':'$:storefront records','transbay-crossings':'sites:crossing sites','tree-wells':'$:tree-well records',
 'waterfront-landscape':'areas:landscape areas paths:path features trees:tree records','waterfront-tree-survey':'trees:tree records',
 'approach-soma':'buildings:building features roads:road features ramps:ramp features',
};
function measures(key,d){
  if(key==='urban-context'){const u=packedUrban(d);return num(d.tiles.length)+' scene tiles, '+num(u.buildings)+' building records, '+num(u.roads)+' road records';}
  if(key==='bay-relief'){
    const heights=d.grids.reduce((n,g)=>n+g.rows*g.cols,0),pairs=[...d.buildings,...d.paths].reduce((n,f)=>n+f[1].length,0);
    return num(d.grids.length)+' terrain grids, '+num(heights)+' elevation samples, '+num(pairs)+' coordinate pairs across '+num(d.buildings.length)+' building and '+num(d.paths.length)+' path records';
  }
  if(key==='approach-karp')return d.width+' × '+d.height+' portrait tone samples';
  if(key==='approach-coke')return num(d.points.length)+' wordmark points';
  assert.ok(units[key],'describe dataset '+key);
  return [...units[key].matchAll(/(\w+|\$):(.+?)(?= \w+:|$)/g)].map(([,prop,unit])=>{
    const field=prop==='$'?d:d[prop];assert.ok(field,'missing '+key+'.'+prop);
    return num(Object.keys(field).length)+' '+unit;
  }).join(', ');
}
const data=[...files].filter(([name])=>name.startsWith('public/data/')).sort(([a],[b])=>order(a,b));
const nonGeographic=new Set(['approach-karp','approach-coke','radar-palette','harbor-tide-hours','harbor-timetable']);
const keyOf=name=>path.basename(name,'.json');
const bytes=data.reduce((n,[,b])=>n+b.length,0),geo=data.filter(([name])=>!nonGeographic.has(keyOf(name)));
const geoBytes=geo.reduce((n,[,b])=>n+b.length,0);
const counts=types.map(t=>[t,[...sources.values()].filter(r=>sourceType(r)===t).length]);
// The tabular register is deliberately separate from the research bibliography:
 // a 3DEP octree member or a raster tile is an address within its source dataset.
const registry=fs.readFileSync(here('references/SURVEY-ASSETS.csv'),'utf8').trimEnd().split('\n');
assert.equal(registry.shift(),'series,asset_id,stored_bytes,point_records,source_url');
const assetHosts={'USGS-3DEP-2023':'s3-us-west-2.amazonaws.com','NAIP-2022':'gis.wildlife.ca.gov','SF-RGB8CM-2024':'tile.sf.gov','JAMESTOWN-WATERFRONT':'www.jamestownlp.com','NPS-ALCATRAZ':'www.nps.gov','WATERFRONT-PLAZA':'images.squarespace-cdn.com',
  'SF-PUBLIC-WORKS':'sfpublicworks.org','PORT-SF':'sfport.com','SF-PLANNING':'default.sfplanning.org','SHAH-KAWASAKI':'skarc.com','JLL':'res.cloudinary.com','APRIL-WAGNER':'champagnecoloredglasses.com','RIDE-KARTAVIEW':'cdn.kartaview.org','RIDE-COMMONS':['upload.wikimedia.org','thumb.wikimedia.org']};
const rideCredits=[...files.get('references/RESEARCH-SOURCES.md').toString().matchAll(
  /\| (KartaView|Wikimedia Commons) (\d+) \| [^|]+ \| \d{4}-\d{2}-\d{2} \| \[CC[^\]]*\]\(https:\/\/creativecommons\.org\//g
)].map(([,provider,id])=>(provider==='KartaView'?'RIDE-KARTAVIEW':'RIDE-COMMONS')+':'+id);
const unregisteredCredits=new Set(rideCredits);
assert.equal(unregisteredCredits.size,rideCredits.length,'duplicate photo credit');
const members=new Map(),assetURLs=new Set();
let assetBytes=0;
for(const line of registry){
  const [series,id,stored,pointCount,address]=line.split(',');
  const u=new URL(address);
  assert.ok(id&&Number.isSafeInteger(+stored)&&+stored>0&&u.protocol==='https:'&&[assetHosts[series]].flat().includes(u.hostname));
  assert.ok(!assetURLs.has(address)&&!u.username&&!u.password);assetURLs.add(address);
  if(series.startsWith('RIDE-'))assert.ok(unregisteredCredits.delete(series+':'+id),'missing or duplicate ride photo credit for '+id);
  const stats=members.get(series)??{count:0,bytes:0,points:0};
  stats.count++;stats.bytes+=+stored;stats.points+=Number(pointCount);
  members.set(series,stats);assetBytes+=+stored;
}
assert.equal(unregisteredCredits.size,0,'ride photo credit without a registered source file');
const sharedAssets=[...assetURLs].filter(u=>sources.has(u)).length;
const text=[
 '# San Francisco waterfront research catalog','',
 'Follow the research behind the city, from the Ferry Building’s clock and arcades to regional terrain, street furniture, dining rooms and ferry landings. Each source below links back to the public file that cites it.','',
 '## Start here','',
 '- [Waterfront reference audit](WATERFRONT-REFERENCE-AUDIT.md) — landmark-by-landmark evidence, survey methods and reconstruction limits.',
 '- [Angler storefront record](ANGLER-FRONTAGE.md) — the architectural elevation, operator photographs and finished sidewalk.',
 '- [Additional field and archive sources](RESEARCH-SOURCES.md) — retained research citations, measured survey input and gaps.',
 '- [Ride photograph attributions](RESEARCH-SOURCES.md#ride-photograph-attributions) — individual KartaView and Wikimedia Commons views, capture dates, creators and licenses.',
 '- [Exact survey downloads](SURVEY-ASSETS.csv) — public LiDAR octree IDs, orthophoto tile coordinates, original imagery requests and architectural photographs with their measured sizes.',
 '- [Attribution and licenses](../THIRD-PARTY-NOTICES.md) — map data, elevation products, font and adapted artwork.',
 '', '## Scale of the inputs','',
 '| Measure | Recorded amount |','|---|---:|',
 '| Cited publication, image, data and source URLs | '+num(sources.size)+' |',
 '| Survey asset URLs | '+num(assetURLs.size)+' ('+num(sharedAssets)+' also directly cited) |',
 '| Distinct URLs across both registers | '+num(sources.size+assetURLs.size-sharedAssets)+' |',
 '| Shipped geographic JSON files | '+geo.length+' files · '+num(geoBytes)+' bytes |',
 '| Other shipped data JSON (portrait, wordmark, radar palette, tides and timetables) | '+(data.length-geo.length)+' files · '+num(bytes-geoBytes)+' bytes |',
 '| Measured input files in the [asset register](SURVEY-ASSETS.csv) | '+num(assetURLs.size)+' files · '+num(assetBytes)+' bytes |',
 '| LAS header records in the USGS point-cloud subset | '+num(members.get('USGS-3DEP-2023').points)+' point records |','',
 'Shipped sizes use the exact JSON bytes in this repository before build compression. The working-set sample measures retained input files. A complete byte total for original research or a count of all individual photographs inside galleries and PDFs is unavailable. Multiple layers may describe the same building or tree. Their feature counts should be read independently.','',
 '### Explore by subject','',
 '- [Buildings, piers and vessels](WATERFRONT-REFERENCE-AUDIT.md#reconstructing-the-view-from-the-ferry-building) · [Ferry Building after dark](WATERFRONT-REFERENCE-AUDIT.md#ferry-building-after-dark)',
 '- [Planting sites and curbs](WATERFRONT-REFERENCE-AUDIT.md#trees-planting-sites-and-curb-lines) · [Bay Bridge and ferry approaches](WATERFRONT-REFERENCE-AUDIT.md#bay-bridge-soma-approach-and-ferries)',
 '- [Individual architectural photographs](RESEARCH-SOURCES.md#recovered-individual-images) · [Restaurant elevation and interiors](ANGLER-FRONTAGE.md)',
 '', '## Data inventory','', '| Shipped file | Raw bytes | Contents measured in that file |','|---|---:|---|',
 ...data.map(([name,b])=>'| ['+path.basename(name)+'](../'+name+') | '+num(b.length)+' | '+measures(keyOf(name),JSON.parse(b))+' |'),
 '', '## Source directory','',
 'Each URL has one entry. Page and sheet fragments share an entry and retain their individual deep links. Source types reflect the cited material; a gallery or project report may contain several kinds. File links identify where the source was recorded. For photo reuse, consult the original item’s rights statement.','',
 ...counts.map(([t,c])=>'- ['+t+'](#'+t.toLowerCase().replaceAll(' ','-')+') · '+num(c))
];
for(const t of types){
  text.push('','### '+t,'');
  const selected=[...sources.values()].filter(r=>sourceType(r)===t).sort((a,b)=>order(a.url,b.url));
  for(const r of selected){
    const u=new URL(r.url),locations=[...r.items],first=locations[0][1];
    const subject=[...r.descriptions.keys()].find(d=>d.length>4)??(first.context+' · '+u.hostname);
    const href=[...new Set(locations.flatMap(([,v])=>[...v.targets]))].sort(order);
    const linkTarget=s=>s.replaceAll('(','%28').replaceAll(')','%29');
    const url=href.find(v=>v===r.url)??href[0];
    const others=href.filter(v=>v!==url);
    const context=locations.map(([loc,item])=>'['+label(item.context)+'](../'+loc+')').join(' · ');
    text.push('- ['+label(subject)+']('+linkTarget(url)+') · '+u.hostname.replace(/^www\./,'')+(others.length?' · '+others.map(v=>'['+label(new URL(v).hash.slice(1)||'source')+']('+linkTarget(v)+')').join(' · '):'')+' — '+context);
  }
}
text.push('','## Maintenance','','Run `node scripts/catalog-city-references.mjs` to regenerate this inventory or add `--check` to verify it. Links come from the exported city code, geometry tests, data, importers, source notes and attribution notice. The generator groups exact URL addresses before the fragment; independent host aliases and separate queries remain separate records.','');
const result=text.join('\n');
// Verify file and heading targets against the public file map, including the
// generated notices, which exist only in the standalone distribution.
const documents=new Map([...files,[output,Buffer.from(result)]]);
for(const name of [output,...notes]){
  for(const match of documents.get(name).toString().matchAll(/\]\(([^)]+)\)/g)){
    const href=match[1];if(/^https?:/.test(href))continue;
    const [target,fragment]=href.split('#');
    const full=target?path.posix.normalize(path.posix.join(path.posix.dirname(name),target)):name;
    if(full==='references/SURVEY-ASSETS.csv'&&!fragment)continue;
    assert.ok(documents.has(full),'missing public target '+href+' in '+name);
    if(!fragment)continue;
    const targetText=documents.get(full).toString();
    if(/^L\d+$/.test(fragment)){
      assert.ok(+fragment.slice(1)<=targetText.split('\n').length,'line outside '+full);
    }else{
      const slugs=[...targetText.matchAll(/^#{1,6} (.+)$/gm)].map(([,h])=>h.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu,'').replace(/ /g,'-'));
      assert.ok(slugs.includes(fragment),'missing heading '+href);
    }
  }
}
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(here(output),'utf8'),result,'regenerate '+output);
else fs.writeFileSync(here(output),result);
console.log(sources.size+' source URLs; '+data.length+' data files; '+bytes+' data bytes; '+geoBytes+' geographic bytes');
