import { COUNTRY_CODES } from '@bagheera/reference-data';
import { i18n } from '../i18n';

// Registration's country dropdown: the shared ISO 3166-1 alpha-2 codes,
// named by `Intl.DisplayNames`.

export interface CountryOption {
  code: string;
  name: string;
}

const FALLBACK_COUNTRY = 'US';

// Not reactive: a locale switch mid-registration keeps the old names until
// the page is revisited.
export function getCountryOptions(): CountryOption[] {
  const regionNames = new Intl.DisplayNames([i18n.global.locale.value], { type: 'region' });

  return COUNTRY_CODES.map((code) => ({
    code,
    name: regionNames.of(code) ?? code,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export function getDefaultCountry(options: CountryOption[]): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region && options.some((option) => option.code === region)) {
      return region;
    }
  } catch {
    // Unparsable/unsupported locale — fall through to the default.
  }

  return FALLBACK_COUNTRY;
}
