import { IsEmail, IsNotEmpty } from 'class-validator';

export class InvitePatientDto {
  @IsEmail()
  @IsNotEmpty()
  patientEmail: string;
}
