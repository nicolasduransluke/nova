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
import { ProcessMessageDto } from './dto/process-message.dto';

@Controller('messages')
export class MessageProcessorController {
  private readonly logger = new Logger(MessageProcessorController.name);

  constructor(
    private readonly messageProcessor: MessageProcessorService,
  ) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processMessage(
    @Body() dto: ProcessMessageDto,
  ): Promise<ApiResponse<ProcessMessageResponse>> {
    this.logger.debug(`Received message from user ${dto.userId}`);

    const startTime = Date.now();

    try {
      const result = await this.messageProcessor.processMessage({
        userId: dto.userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
        messageType: dto.messageType,
        pendingEntryId: dto.pendingEntryId,
      });

      const processingTime = Date.now() - startTime;
      this.logger.debug(`Message processed in ${processingTime}ms`);

      return {
        success: result.success,
        data: result,
        message: result.success
          ? 'Message processed successfully'
          : 'Failed to process message',
      };
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to process message',
      };
    }
  }

  @Post('process/sync')
  @HttpCode(HttpStatus.OK)
  async processMessageSync(
    @Body() dto: ProcessMessageDto,
  ): Promise<ApiResponse<ProcessMessageResponse>> {
    this.logger.debug(`Received sync message from user ${dto.userId}`);

    try {
      const result = await this.messageProcessor.processMessageSync({
        userId: dto.userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
        messageType: dto.messageType,
        pendingEntryId: dto.pendingEntryId,
      });

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Error processing message: ${error}`);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
