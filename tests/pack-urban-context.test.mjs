import assert from 'node:assert/strict';
import {test} from 'node:test';
import {urbanStreamBytes} from '../app/urban-stream.ts';
import {packedUrbanSurvey} from '../scripts/pack-urban-context.ts';
import survey from '../public/data/urban-context.json' with {type:'json'};

function restored(survey){
  const packed=packedUrbanSurvey(survey);
  return {...packed,tiles:packed.tiles.map(([x,z,b,r,...metadata])=>
    [x,z,...[b,r].map(encoded=>Buffer.from(urbanStreamBytes(encoded)).toString('base64')),...metadata])};
}

test('production survey reconstructs both original streams and metadata for every city tile',()=>{
  assert.deepEqual(restored(survey),survey);
});
test('packed paths preserve signed wrap across both coordinate limits and empty records',()=>{
  const boundary=Buffer.alloc(1+2+16);
  boundary[0]=16;boundary.writeUInt16LE(4,1);
  [-32768,32767,32767,-32768,0,1,-1,-32768].forEach((v,i)=>boundary.writeInt16LE(v,3+i*2));
  const sample={tiles:[[0,0,'',Buffer.concat([boundary,boundary,Buffer.from([0,0,0])]).toString('base64'),[],123]]};
  assert.deepEqual(restored(sample),sample);
});
test('unsupported or truncated streams defer to the original Vite JSON module',()=>{
  for(const b of ['AA==','!new-format',Buffer.from([0,0,0,0,0,0,0,0,1,1,0]).toString('base64')])
    assert.equal(packedUrbanSurvey({tiles:[[0,0,b,'',[]]]}),undefined);
});

test('standalone Vite build emits the packed module and keeps the research JSON readable',async()=>{
  const {build}=await import('vite');
  const {fileURLToPath}=await import('node:url');
  const {packUrbanContext}=await import('../scripts/pack-urban-context.ts');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const entry=fileURLToPath(new URL('../public/data/urban-context.json',import.meta.url));
  const output=await build({root,configFile:false,publicDir:false,logLevel:'silent',plugins:[packUrbanContext()],
    build:{write:false,lib:{entry,formats:['es'],fileName:'urban'}}});
  const chunk=output[0].output.find(chunk=>chunk.type==='chunk');
  const packed=(await import('data:text/javascript;base64,'+Buffer.from(chunk.code).toString('base64'))).default;
  assert.deepEqual(packed,packedUrbanSurvey(survey));
  assert.ok(packed.tiles.some(tile=>tile[2].startsWith('!1b')));
});
