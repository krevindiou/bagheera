import { LocaleField } from '../../common/dto-fields';
import type { Locale } from '../../common/locale';

export class UpdateLocaleDto {
  @LocaleField()
  locale!: Locale;
}
