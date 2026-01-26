import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
  IsEnum,
} from 'class-validator';
import type { MessageType } from '@nova/types';

export class ProcessMessageDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsEnum(['text', 'image', 'weight', 'sleep', 'meal', 'workout', 'energy'])
  messageType?: MessageType;
}
