import { IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, {
    message: "Telefon raqami noto'g'ri formatda (+998XXXXXXXXX)",
  })
  phone: string;

  @IsString()
  @MinLength(1, { message: 'password is required' })
  password: string;
}
