import { TimeZoneField } from '../../common/dto-fields';

export class UpdateTimeZoneDto {
  @TimeZoneField()
  timeZone!: string;
}
