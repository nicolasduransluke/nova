import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsEnum,
} from 'class-validator';
import type { MessageType } from '@nova/types';

export class ProcessMessageDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsEnum(['text', 'image', 'weight', 'meal', 'workout'])
  messageType?: MessageType;

  @IsOptional()
  @IsString()
  timezone?: string;
}
