import { IsString, MinLength } from 'class-validator';

export class CreatePatientCommentDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsString()
  @MinLength(1)
  patientId: string;
}
