import {packCoordinateSurveys} from './scripts/pack-coordinate-surveys.ts';
import {packUrbanContext} from './scripts/pack-urban-context.ts';
import {resolve} from 'node:path';
import {build,defineConfig,type Plugin} from 'vite';
import {packBayRelief} from './scripts/pack-bay-relief.ts';
import react from '@vitejs/plugin-react';

function openingHead():Plugin{
  let root='';
  return {
    name:'waterfront-opening-head',
    configResolved(config){root=config.root;},
    async transformIndexHtml(html){
      // Inline the small shared solar selector so the browser starts fetching
      // its one correct print while it downloads the application entry point.
      const output=await build({root,configFile:false,logLevel:'silent',publicDir:false,
        build:{write:false,lib:{entry:resolve(root,'src/opening-head.ts'),name:'WaterfrontOpening',formats:['iife']}}});
      const result=Array.isArray(output)?output[0]:output;
      if(!('output' in result)||result.output[0].type!=='chunk')throw new Error('Missing opening prelude');
      const script=result.output[0].code;
      return html.replace('<!-- waterfront-opening-head -->',()=>'<script>'+script+'</script>');
    },
  };
}

export default defineConfig({plugins:[react(),packBayRelief(),packUrbanContext(),packCoordinateSurveys(),openingHead()],base:'./'});
