import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { setLocale } from '../../i18n';
import { withGlobalPlugins } from '../../test-support/withGlobalPlugins';
import SchedulerFrequency from './SchedulerFrequency.vue';

function render(frequencyValue: number, frequencyUnit: 'day' | 'week' | 'month' | 'year') {
  return mount(SchedulerFrequency, {
    props: { scheduler: { frequencyValue, frequencyUnit, limitDate: null } },
    global: withGlobalPlugins().global,
  }).text();
}

const cases = [
  { unit: 'day', en: ['Every day', 'Every 3 days'], fr: ['Tous les jours', 'Tous les 3 jours'] },
  {
    unit: 'week',
    en: ['Every week', 'Every 3 weeks'],
    fr: ['Toutes les semaines', 'Toutes les 3 semaines'],
  },
  {
    unit: 'month',
    en: ['Every month', 'Every 3 months'],
    fr: ['Tous les mois', 'Tous les 3 mois'],
  },
  { unit: 'year', en: ['Every year', 'Every 3 years'], fr: ['Tous les ans', 'Tous les 3 ans'] },
] as const;

describe('SchedulerFrequency', () => {
  afterEach(async () => {
    await setLocale('en');
  });

  describe.each(['en', 'fr'] as const)('in %s', (locale) => {
    it.each(cases.map((c) => [c.unit, c[locale][0], c[locale][1]] as const))(
      'renders %s singular and plural',
      async (unit, singular, plural) => {
        await setLocale(locale);
        expect(render(1, unit)).toBe(singular);
        expect(render(3, unit)).toBe(plural);
      },
    );
  });
});
