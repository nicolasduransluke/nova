import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateRelationshipDto {
  @IsOptional()
  @IsIn(['active', 'paused', 'ended'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
