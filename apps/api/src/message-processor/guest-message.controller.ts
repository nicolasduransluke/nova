import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiResponse, ProcessMessageResponse } from '@nova/types';
import { MessageProcessorService } from './message-processor.service';
import { GuestMessageDto } from './dto/guest-message.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('messages')
export class GuestMessageController {
  private readonly logger = new Logger(GuestMessageController.name);

  constructor(
    private readonly messageProcessor: MessageProcessorService,
  ) {}

  @Public()
  @Post('guest')
  @HttpCode(HttpStatus.OK)
  async processGuestMessage(
    @Body() dto: GuestMessageDto,
  ): Promise<ApiResponse<ProcessMessageResponse>> {
    this.logger.debug('Received guest message');

    try {
      const result = await this.messageProcessor.processGuestMessage(
        dto.content,
        dto.imageUrl,
      );

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error processing guest message: ${error}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
