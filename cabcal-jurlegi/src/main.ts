import { mount } from 'svelte';
import 'carbon-components-svelte/css/all.css';
import './app.css';
import App from './App.svelte';
import { initTheme } from './lib/state/theme.svelte';

initTheme();

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
