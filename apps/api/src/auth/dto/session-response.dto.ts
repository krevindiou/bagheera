import { ApiProperty } from '@nestjs/swagger';
import { SUPPORTED_LOCALES } from '../../common/locale';

export class CurrentMemberDto {
  email!: string;
  @ApiProperty({ enum: SUPPORTED_LOCALES })
  locale!: (typeof SUPPORTED_LOCALES)[number];
}
