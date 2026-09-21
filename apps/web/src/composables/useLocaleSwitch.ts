import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { apiClient } from '../api/client';
import { setLocale } from '../i18n';
import { isSupportedLocale, setStoredLocale, type Locale } from '../i18n/locales';
import { useSessionStore } from '../stores/session.store';
import { useToast } from './useToast';

// Shared by LanguageSwitcher.vue (the pre-auth shell's standalone picker)
// and AccountMenu.vue (the sidebar's language section) — same switching
// logic, two different trigger UIs wrapped around it.
export function useLocaleSwitch() {
  const route = useRoute();
  const router = useRouter();
  const session = useSessionStore();
  const { t } = useI18n();
  const { push: toast } = useToast();

  const current = computed<Locale>(() =>
    isSupportedLocale(route.params.locale) ? route.params.locale : 'en',
  );

  async function choose(locale: Locale): Promise<void> {
    if (locale === current.value) return;

    // Every call site elsewhere navigates by name and lets the router fill
    // in `locale` from the current route (see router/index.ts's withLocale)
    // — this is the one place that instead passes it explicitly, since
    // switching *is* the locale change.
    await setLocale(locale);
    setStoredLocale(locale);
    await router.replace({ name: route.name ?? undefined, params: { ...route.params, locale } });

    if (session.isAuthenticated) {
      const { response } = await apiClient.POST('/members/locale', { body: { locale } });
      if (response.ok) {
        session.setLocale(locale);
      } else {
        toast(t('language.genericError'), 'error');
      }
    }
  }

  return { current, choose };
}
