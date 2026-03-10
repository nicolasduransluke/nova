import { IsEmail, IsOptional } from 'class-validator';

export class InvitePatientDto {
  @IsEmail()
  @IsOptional()
  patientEmail?: string;
}
