// @noflow

import babel from '@rolldown/plugin-babel';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const stripFlow = () =>
  babel({
    presets: ['@babel/preset-flow'],
    plugins: ['flow-parser/babel-plugin'],
    parserOpts: {reactRuntimeTarget: '19'},
  });

export default defineConfig({
  // Relative asset URLs, so the build works under a GitHub Pages subpath.
  base: './',
  // Strip Flow syntax first so the React plugin only sees plain JSX.
  plugins: [stripFlow(), react()],
  // The dependency scanner bypasses `plugins`, so it needs its own copy.
  optimizeDeps: {rolldownOptions: {plugins: [stripFlow()]}},
});
