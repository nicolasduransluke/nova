import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AppleNativeAuthDto {
  @IsString()
  @IsNotEmpty()
  identityToken!: string;

  @IsOptional()
  @IsString()
  fullName?: string;
}
