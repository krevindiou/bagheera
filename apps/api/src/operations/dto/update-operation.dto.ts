import { OmitType } from '@nestjs/swagger';
import { ValueDateField } from '../../common/dto-fields';
import { CreateOperationDto } from './create-operation.dto';

// accountId is immutable but still submitted (read-only on the edit form);
// the service rejects any change. valueDate is required on edit: OmitType
// drops create's @IsOptional(), which a plain `extends` would inherit.
export class UpdateOperationDto extends OmitType(CreateOperationDto, ['valueDate'] as const) {
  @ValueDateField()
  valueDate!: string;
}
