import { mount } from 'svelte';
import 'carbon-components-svelte/css/g100.css';
import './app.css';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
