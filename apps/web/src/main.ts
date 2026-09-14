import 'bootstrap/dist/css/bootstrap.min.css';
// Self-hosted (via @fontsource) instead of Google Fonts' CDN — same
// families/weights theme.css expects ('Space Grotesk' 500/600/700,
// 'Archivo' 400/500/600/700), no runtime request to a remote font host.
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import './style.css';
import './styles/theme.css';
import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import { queryClient } from './api/query-client';
import { initSentry } from './sentry';
import { vAutofocus } from './directives/autofocus';

const app = createApp(App);
initSentry(app);

app
  .use(createPinia())
  .use(router)
  .use(i18n)
  .use(VueQueryPlugin, { queryClient })
  .directive('autofocus', vAutofocus)
  .mount('#app');
