import { createI18n } from "vue-i18n";
import en from "./locales/en";

// English-only catalog for now; other locales are added alongside their
// route prefixes once the frontend feature pages exist.
export const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: { en },
});
