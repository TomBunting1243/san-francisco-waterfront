import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {coordinateSurveys,packCoordinates} from '../scripts/pack-coordinate-surveys.ts';
import {unpackCoordinateSurvey} from '../app/coordinate-survey.ts';

test('every production survey reconstructs its exact geometry and metadata in original order',()=>{
  for(const name of coordinateSurveys){
    const data=JSON.parse(readFileSync(new URL('../public/data/'+name+'.json',import.meta.url),'utf8'));
    assert.deepEqual(unpackCoordinateSurvey(...packCoordinates(data)),data,name);
  }
});

test('mixed precision, signed deltas and unknown data keep the original survey values',()=>{
  const data={a:[[[-100,13],[100,-17]],[[.0001,.0002]],[[.00001,0]],[[0,-.1234567]]],
    extra:[[],[[Math.PI,1]],[[1,2,3]],'a tree',null,true],b:[[899999,-899999],[-899999,899999]]};
  assert.deepEqual(unpackCoordinateSurvey(...packCoordinates(data)),data);
  assert.equal(packCoordinates([data,'~P3c']),undefined);
  assert.deepEqual(unpackCoordinateSurvey(...packCoordinates([data,[[-0,1]]])),[data,[[-0,1]]]);
  assert.equal(packCoordinates([data,'~Z']),undefined);
  assert.equal(packCoordinates({plain:true}),undefined);
});

test('the production Vite module uses the coordinate streams and exposes the complete survey',async()=>{
  const {build}=await import('vite');
  const {fileURLToPath}=await import('node:url');
  const {packCoordinateSurveys}=await import('../scripts/pack-coordinate-surveys.ts');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const input=fileURLToPath(new URL('../public/data/survey-blocks.json',import.meta.url));
  const [output]=await build({root,configFile:false,publicDir:false,logLevel:'silent',plugins:[packCoordinateSurveys()],
    build:{write:false,lib:{entry:input,formats:['es'],fileName:'blocks'}}});
  const {code}=output.output.find(chunk=>chunk.type==='chunk');
  assert.ok(code.includes('atob('));
  const {default:compiledSurvey}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  assert.deepEqual(compiledSurvey,JSON.parse(readFileSync(input,'utf8')));
});
