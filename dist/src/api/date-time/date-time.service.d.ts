import { ConfigService } from '@nestjs/config';
import * as dayjs from 'dayjs';
export declare class DateTimeService {
    private configService;
    private readonly timezone;
    constructor(configService: ConfigService);
    now(): Date;
    getCurrentDate(): string;
    getMonthRange(date: Date | string): {
        start: Date;
        end: Date;
    };
    getDateRage(startDate: Date | string, endDate: Date | string): {
        start: Date;
        end: Date;
    };
    getDateRageFormat(startDate: Date | string, endDate: Date | string): {
        start: string;
        end: string;
    };
    getStartAndEndOfMonth(startDate: Date | string, endDate: Date | string): {
        start: Date;
        end: Date;
    };
    getMonthNumber(): number;
    isSameMonth(ts1: Date | string, ts2: Date | string): boolean;
    toAppTimezone(date: string | Date | number): Date;
    formatTimes(_startTime: string, _endTime: string): {
        startTime: Date;
        endTime: Date;
    };
    currentDay(): {
        start: string;
        end: string;
    };
    currentWeekDay(): 1 | 2 | 5 | 3 | 4 | 6 | 7;
    formatDate(date: Date | string): string;
    formatMonth(date: Date | string): string;
    formatTime(date: Date | string): string;
    formatDateTime(date: Date | string): string;
    formatDateTimeHour(date: Date | string): string;
    formatTimeDateString(date: Date | string): string;
    startOfDay(date: Date | string): Date;
    formatOfDay(date: Date | string, time: string): Date;
    weekDay(): 1 | 2 | 5 | 3 | 4 | 6 | 7;
    endOfDay(date: Date | string): Date;
    isPast(date: Date | string): boolean;
    isWithinTimeRange(startTime: Date, endTime: Date): boolean;
    add(date: Date | string, amount: number, unit: dayjs.ManipulateType): Date;
    diff(date1: Date | string, date2: Date | string, unit: dayjs.QUnitType): number;
    setTimeFromString(date: Date | string, timeString: string): Date;
    timeStringFromDate(date: string, timeString: Date): Date;
    getDayOfWeek(date: Date | string): number;
    sameDayLastWeek(date: Date | string, dayOfWeek?: number): string;
    addMonths(date: Date | string, months: number): Date;
    date(date: Date | string): Date;
    getHoursDifference(date1: Date | string, date2: Date | string): number;
    addMinut(date: Date | string, minutes: number): Date;
    quizFinishTime(endDate: Date | string): boolean;
    getMinutDiffernce(date1: Date | string, date2: Date | string): number;
    isWithinHours(date: Date | string, hours: number): boolean;
    isMoreThanHoursAhead(date: Date | string, hours: number): boolean;
    shouldHide(startTime: Date, endTime: Date): boolean;
    isBefore(date1: Date | string, date2: Date | string): boolean;
    isAfter(date1: Date | string, date2: Date | string): boolean;
    getStartEndToYear(endDate?: Date | string, startDate?: Date | string): {
        start: Date;
        end: Date;
    };
    getOldYear(endDate?: Date | string, startDate?: Date | string): {
        start: Date;
        end: Date;
    };
    monthLastDay(): boolean;
    formatStartEnd(endDate?: Date | string, startDate?: Date | string): {
        start: string;
        end: string;
    };
    getStartEndToMonth(endDate?: Date | string, startDate?: Date | string): {
        start: Date;
        end: Date;
    };
    timeToMinutes(time: string): number;
    getMonthsBetween(startISO: string, endISO: string): number;
    minutesToTime(minutes: number): string;
    getStartMonthAndEndMonth(endDate: Date | string): {
        subStartDate: Date;
        subEndDate: Date;
        currentStartDate: Date;
        currentEndDate: Date;
    };
    getCurrentHour(): string;
    getCurrentYear(): number;
}
