import { mount } from 'svelte';
import App from './App.svelte';
import { applyUIScale } from '$lib/ui-scale';

void applyUIScale();
mount(App, { target: document.getElementById('app')! });
