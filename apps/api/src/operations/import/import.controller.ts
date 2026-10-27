import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { ClientIp } from '../../common/client-ip.decorator';
import { MessageResponseDto } from '../../common/dto/message-response.dto';
import type { MemberId } from '../../security/ids';
import {
  MEMBER_IMPORT_PREVIEW_LIMIT,
  MEMBER_WRITE_LIMIT,
} from '../../security/rate-limit.constants';
import { RateLimit } from '../../security/rate-limit.decorator';
import { CurrentMember } from '../../session/current-member.decorator';
import { PayloadTooLargeToBusinessError } from './file-too-large.filter';
import {
  ConfirmImportDto,
  ImportPreviewDto,
  ImportResultDto,
  ImportUploadDto,
  PreviewImportDto,
  StartImportDto,
} from './import.dto';
import { ImportService, type UploadedBankFile } from './import.service';

// integration-spec: covered per concern by the import.*.integration-spec.ts files
// Providing the file and confirming draw on the member's shared write budget;
// a preview, which records nothing, has a budget of its own.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('operations/import')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  // One byte over the limit still reaches the service, which answers with the
  // business error; much larger bodies are cut off while uploading.
  @Post()
  @HttpCode(200)
  @UseFilters(PayloadTooLargeToBusinessError)
  @UseInterceptors(
    FileInterceptor('file', {
      // The file and the account id, nothing else.
      limits: {
        files: 1,
        fields: 1,
        parts: 2,
        fieldSize: 256,
        fileSize: IMPORT_LIMITS.MAX_FILE_BYTES + 1,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['accountId', 'file'],
      properties: {
        accountId: { type: 'string', format: 'uuid' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(
    @CurrentMember() memberId: MemberId,
    @Body() dto: StartImportDto,
    @UploadedFile() file: UploadedBankFile | undefined,
  ): Promise<ImportUploadDto> {
    return this.imports.upload(memberId, dto.accountId, file);
  }

  @Post(':importId/preview')
  @RateLimit(MEMBER_IMPORT_PREVIEW_LIMIT)
  @HttpCode(200)
  preview(
    @CurrentMember() memberId: MemberId,
    @Param('importId', ParseUUIDPipe) importId: string,
    @Body() dto: PreviewImportDto,
  ): Promise<ImportPreviewDto> {
    return this.imports.preview(memberId, importId, dto);
  }

  @Post(':importId/confirm')
  @HttpCode(200)
  confirm(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Param('importId', ParseUUIDPipe) importId: string,
    @Body() dto: ConfirmImportDto,
  ): Promise<ImportResultDto> {
    return this.imports.confirm(memberId, ip, importId, dto);
  }

  @Delete(':importId')
  @HttpCode(200)
  async discard(
    @CurrentMember() memberId: MemberId,
    @Param('importId', ParseUUIDPipe) importId: string,
  ): Promise<MessageResponseDto> {
    await this.imports.discard(memberId, importId);
    return { message: 'Import discarded' };
  }
}
