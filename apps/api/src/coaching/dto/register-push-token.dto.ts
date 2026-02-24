import { IsString, IsOptional, Matches } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$/, {
    message: 'pushToken must be a valid Expo push token',
  })
  pushToken!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
