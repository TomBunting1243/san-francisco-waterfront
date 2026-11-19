import assert from 'node:assert/strict';
import {test} from 'node:test';
import {packedReliefModule} from '../scripts/pack-bay-relief.ts';
import relief from '../public/data/bay-relief.json' with {type:'json'};

async function unpack(data){
  const code=packedReliefModule(data);
  return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
}

test('production relief encoding preserves every number, ordered path and survey metadata field',async()=>{
  const actual=await unpack(relief);
  assert.deepEqual(actual,relief);
  assert.equal([...actual.paths,...actual.buildings].reduce((n,row)=>n+row[1].length,0),57172);
});

test('relief deltas span the globe, preserve metadata on empty features, and defer unsupported input to Vite',async()=>{
  const synthetic={buildings:[[1,[[-180,-90],[180,90]],'coast'],[2,[],null]],paths:[['trail',[[179.999999,-89.999999],[0,0]]]]};
  assert.deepEqual(await unpack(synthetic),synthetic);
  for(const pair of [[-.0000001,1],[-0,1],[181,0],[1,2,3]]){
    assert.equal(packedReliefModule({buildings:[],paths:[['trail',[pair]]]}),undefined);
  }
});

test('Vite emits the packed survey in a production build',async()=>{
  const {build}=await import('vite');
  const {fileURLToPath}=await import('node:url');
  const {packBayRelief}=await import('../scripts/pack-bay-relief.ts');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const input=fileURLToPath(new URL('../public/data/bay-relief.json',import.meta.url));
  const output=await build({root,configFile:false,publicDir:false,logLevel:'silent',plugins:[packBayRelief()],
    build:{write:false,lib:{entry:input,formats:['es'],fileName:'relief'}}});
  const {code}=output[0].output.find(chunk=>chunk.type==='chunk');
  assert.ok(code.includes('atob('));
  const emitted=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  assert.deepEqual(emitted.default,relief);
});
