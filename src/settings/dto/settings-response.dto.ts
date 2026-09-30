import { ApiProperty } from '@nestjs/swagger';

export class SettingsResponseDto {
  @ApiProperty({ example: 'Zahro Dental' })
  clinicName: string;

  @ApiProperty({ example: '' })
  address: string;

  @ApiProperty({ example: '' })
  phone: string;

  @ApiProperty({ example: '' })
  workingHours: string;

  @ApiProperty({
    example:
      'Hurmatli {name}, {date} kuni soat {time} da {doctor} qabuliga yozilgansiz. Zahro Dental',
  })
  smsReminderTemplate: string;

  @ApiProperty({
    example:
      'Hurmatli {name}, {date} kuni soat {time} da {doctor} qabuliga yozilgansiz. Zahro Dental',
  })
  telegramReminderTemplate: string;

  @ApiProperty({ minimum: 0, maximum: 7, example: 1 })
  reminderDaysAhead: number;
}
