import { ApiProperty } from '@nestjs/swagger';

export class DashboardResponseDto {
  @ApiProperty({ example: 120, description: 'doctor uchun — o‘z bemorlari' })
  totalPatients: number;

  @ApiProperty({ example: 14, description: '`date` joylashgan oy' })
  newPatientsThisMonth: number;

  @ApiProperty({ example: 9, description: '`date` kunidagi qabullar' })
  todayBookings: number;

  @ApiProperty({ example: 4 })
  todayCompleted: number;

  @ApiProperty({ example: 11, description: 'Barcha pending qabullar' })
  pendingBookings: number;

  @ApiProperty({
    example: 3,
    description: '`date` kuni qabuli bor shifokorlar',
  })
  activeDoctors: number;

  @ApiProperty({ example: 5 })
  totalDoctors: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1500000,
    description: 'Faqat admin; boshqalarga null',
  })
  todayRevenue: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 42000000 })
  monthRevenue: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 8000000 })
  monthExpenses: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 3200000,
    description: 'Bemorlar umumiy qarzi',
  })
  unpaidTotal: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 7,
    description: 'Qarzdor bemorlar soni',
  })
  unpaidCount: number | null;
}

export class MonthlyPointDto {
  @ApiProperty({ example: '2026-09' })
  month: string;

  @ApiProperty({ example: 14 })
  newPatients: number;

  @ApiProperty({ example: 80 })
  bookings: number;

  @ApiProperty({ example: 61 })
  completedBookings: number;

  @ApiProperty({ type: Number, nullable: true, example: 42000000 })
  revenue: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 8000000 })
  expenses: number | null;
}

export class SourcePointDto {
  @ApiProperty({ example: 'telegram' })
  source: string;

  @ApiProperty({ example: 25 })
  count: number;
}
