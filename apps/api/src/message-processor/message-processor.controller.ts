import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { ApiResponse, ProcessMessageResponse, Message } from '@nova/types';
import { MessageProcessorService } from './message-processor.service';
import { ProcessMessageDto } from './dto/process-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageProcessorController {
  private readonly logger = new Logger(MessageProcessorController.name);

  constructor(
    private readonly messageProcessor: MessageProcessorService,
  ) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processMessage(
    @Body() dto: ProcessMessageDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<ProcessMessageResponse>> {
    if (dto.userId !== user.sub) {
      throw new ForbiddenException('You can only send messages as yourself');
    }
    this.logger.debug(`Received message from user ${dto.userId}`);

    const startTime = Date.now();

    try {
      const result = await this.messageProcessor.processMessage({
        userId: dto.userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
        messageType: dto.messageType,
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

  @Get('history')
  async getMessageHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limitParam?: string,
  ): Promise<ApiResponse<Message[]>> {
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 100);

    try {
      const messages = await this.messageProcessor.getMessageHistory(user.sub, limit);
      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      this.logger.error(`Error fetching message history: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Post('process/sync')
  @HttpCode(HttpStatus.OK)
  async processMessageSync(
    @Body() dto: ProcessMessageDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponse<ProcessMessageResponse>> {
    if (dto.userId !== user.sub) {
      throw new ForbiddenException('You can only send messages as yourself');
    }
    this.logger.debug(`Received sync message from user ${dto.userId}`);

    try {
      const result = await this.messageProcessor.processMessageSync({
        userId: dto.userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
        messageType: dto.messageType,
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
