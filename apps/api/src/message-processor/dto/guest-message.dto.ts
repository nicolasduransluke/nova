import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class GuestMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
