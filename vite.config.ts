import {defineConfig} from 'vite';
import {packBayRelief} from './scripts/pack-bay-relief.ts';
import react from '@vitejs/plugin-react';

export default defineConfig({plugins:[react(),packBayRelief()],base:'./'});
