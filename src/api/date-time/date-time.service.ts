import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as dayjs from 'dayjs'
import * as isBetween from 'dayjs/plugin/isBetween'
import * as timezone from 'dayjs/plugin/timezone'
// import * as isoWeek from 'dayjs/plugin/isoWeek';
import * as utc from 'dayjs/plugin/utc'

@Injectable()
export class DateTimeService {
	private readonly timezone: string
	// private dayjs;

	constructor(private configService: ConfigService) {
		// Setup dayjs plugins
		dayjs.extend(utc)
		dayjs.extend(timezone)
		dayjs.extend(isBetween)

		// Get timezone from config or use default
		this.timezone =
			this.configService.get<string>('TIMEZONE') || 'Asia/Tashkent'

		// Set default timezone
		dayjs.tz.setDefault(this.timezone)
		// this.dayjs = dayjs
	}

	/**
	 * Get current date-time in application timezone
	 */
	now(): Date {
		return dayjs().tz(this.timezone).toDate()
	}

	getCurrentDate(): string {
		return dayjs().tz(this.timezone).format('YYYY-MM-DD')
	}

	// startOfMonth(date: Date | string): Date {
	// 	return dayjs(date).tz(this.timezone).startOf('month').toDate()
	// }

	// endOfMonth(date: Date | string): Date {
	// 	return dayjs(date).tz(this.timezone).endOf('month').toDate()
	// }

	getMonthRange(date: Date | string): { start: Date; end: Date } {
		return {
			start: dayjs(date).tz(this.timezone).startOf('month').toDate(),
			end: dayjs(date).tz(this.timezone).endOf('month').toDate()
		}
	}

	getDateRage(startDate: Date | string, endDate: Date | string) {
		return {
			start: startDate ? dayjs(startDate).tz(this.timezone).startOf('day').toDate() : dayjs().tz(this.timezone).startOf('month').toDate(),
			end: endDate ? dayjs(endDate).tz(this.timezone).endOf('day').toDate() : dayjs().tz(this.timezone).endOf('month').toDate()
		}
	}
	getDateRageFormat(startDate: Date | string, endDate: Date | string) {
		return {
			start: dayjs(startDate).tz(this.timezone).format('YYYY-MM-DD HH:mm:ss'),
			end: dayjs(endDate).tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')
		}
	}

	getStartAndEndOfMonth(
		startDate: Date | string,
		endDate: Date | string
	): { start: Date; end: Date } {
		return {
			start: dayjs(startDate).tz(this.timezone).startOf('month').toDate(),
			end: dayjs(endDate).tz(this.timezone).endOf('month').toDate()
		}
	}

	getMonthNumber() {
		return dayjs().tz(this.timezone).month()
	}

	isSameMonth(ts1: Date | string, ts2: Date | string): boolean {
		return dayjs(ts1).isSame(dayjs(ts2), 'month')
	}

	/**
	 * Convert any date input to application timezone
	 */
	toAppTimezone(date: string | Date | number): Date {
		return dayjs(date).tz(this.timezone).toDate()
	}

	formatTimes(
		_startTime: string,
		_endTime: string
	): { startTime: Date; endTime: Date } {
		const startTime = dayjs.tz(`${_startTime} 04:00`, this.timezone).toDate()
		const endTime = dayjs.tz(`${_endTime} 23:00`, this.timezone).toDate()

		return { startTime, endTime }
	}

	currentDay() {
		const start = dayjs().tz(this.timezone).startOf('day').format('HH:mm')
		const end = dayjs().tz(this.timezone).endOf('day').format('HH:mm')
		return { start, end }
	}

	currentWeekDay() {
		const day = dayjs().tz(this.timezone).day() || 7
		return day
	}

	/**
	 * Format date to standard date string (YYYY-MM-DD)
	 */
	formatDate(date: Date | string): string {
		return dayjs(date).tz(this.timezone).format('YYYY-MM-DD')
	}

	formatMonth(date: Date | string): string {
		return dayjs(date).tz(this.timezone).format('MMMM YYYY')
	}

	/**
	 * Format time to standard time string (HH:mm)
	 */
	formatTime(date: Date | string): string {
		return dayjs(date).tz(this.timezone).format('HH:mm')
	}

	/**
	 * Format date-time to standard date-time string (YYYY-MM-DD HH:mm:ss)
	 */
	formatDateTime(date: Date | string): string {
		return dayjs(date).tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')
	}

	formatDateTimeHour(date: Date | string): string {
		return dayjs(date).tz(this.timezone).format('YYYY-MM-DD HH:mm')
	}

	formatTimeDateString(date: Date | string): string {
		return dayjs(date).tz(this.timezone).format('HH:mm')
	}

	/**
	 * Start of day in application timezone
	 */
	startOfDay(date: Date | string): Date {
		return dayjs(date).tz(this.timezone).startOf('day').toDate()
	}

	formatOfDay(date: Date | string, time: string): Date {
		const [hours, minutes] = time.split(':').map(Number)
		return dayjs(date)
			.tz(this.timezone)
			.hour(hours)
			.minute(minutes)
			.second(0)
			.millisecond(0)
			.toDate()
	}

	weekDay() {
		return dayjs(new Date()).tz(this.timezone).day() || 7
	}

	/**
	 * End of day in application timezone
	 */
	endOfDay(date: Date | string): Date {
		return dayjs(date).tz(this.timezone).endOf('day').toDate()
	}

	/**
	 * Check if date is in the past
	 */
	isPast(date: Date | string): boolean {
		return dayjs(date).tz(this.timezone).isBefore(this.now())
	}

	isWithinTimeRange(startTime: Date, endTime: Date) {
		const checkTime = dayjs().tz(this.timezone)
		const _startTime = dayjs(startTime).tz(this.timezone)
		const _endTime = dayjs(endTime).tz(this.timezone)
		return checkTime.isAfter(_startTime) && checkTime.isBefore(_endTime)
	}

	/**
	 * Add time duration
	 */
	add(date: Date | string, amount: number, unit: dayjs.ManipulateType): Date {
		return dayjs(date).tz(this.timezone).add(amount, unit).toDate()
	}

	/**
	 * Get difference between dates in specified unit
	 */
	diff(
		date1: Date | string,
		date2: Date | string,
		unit: dayjs.QUnitType
	): number {
		return dayjs(date1).tz(this.timezone).diff(dayjs(date2), unit)
	}

	/**
	 * Sets time from HH:mm string format for a given date
	 * Used in Direction service for setting start/end times
	 */
	setTimeFromString(date: Date | string, timeString: string): Date {
		const [hours, minutes] = timeString.split(':').map(Number)
		return dayjs(date)
			.tz(this.timezone)
			.hour(hours)
			.minute(minutes)
			.second(0)
			.millisecond(0)
			.toDate()
	}

	timeStringFromDate(date: string, timeString: Date): Date {
		const [hours, minutes] = dayjs(timeString)
			.tz(this.timezone)
			.format('HH:mm')
			.split(':')
			.map(Number)
		return dayjs(date)
			.tz(this.timezone)
			.hour(hours)
			.minute(minutes)
			.second(0)
			.millisecond(0)
			.toDate()
	}

	/**
	 * Gets day of week (1-7, where 1 is Monday and 7 is Sunday)
	 * Used in Direction service for working days check
	 */
	getDayOfWeek(date: Date | string): number {
		return dayjs(date).tz(this.timezone).day() || 7
	}

	sameDayLastWeek(date: Date | string, dayOfWeek?: number) {
		return dayjs(date)
			.tz(this.timezone)
			.subtract(1, 'week')
			.format('YYYY-MM-DD')
	}

	// weekDay (date: Date | string) {
	// 	const weekday = dayjs(date).tz(this.timezone).subtract(1, 'week').day() === 0 ? 7: dayjs(date).tz(this.timezone).subtract(1, 'week').day()
	// 	return  weekday
	// }

	/**
	 * Adds specified number of months to date
	 * Used in Payment service for calculating expiration dates
	 */
	addMonths(date: Date | string, months: number): Date {
		return dayjs(date).tz(this.timezone).add(months, 'month').toDate()
	}

	/**
	 * Gets difference between two dates in hours
	 * Used in TimeSchedule service for availability checks
	 */

	date(date: Date | string): Date {
		return dayjs(date).tz(this.timezone).toDate()
	}
	getHoursDifference(date1: Date | string, date2: Date | string): number {
		return dayjs(date1).tz(this.timezone).diff(dayjs(date2), 'hour')
	}

	addMinut(date: Date | string, minutes: number): Date {
		return dayjs(date).tz(this.timezone).add(minutes, 'minute').toDate()
	}

	quizFinishTime(endDate: Date | string): boolean {
		const now = dayjs(new Date()).tz(this.timezone)
		if (now.isBefore(endDate) || now.isSame(endDate)) {
			return true
		} else {
			return false
		}
	}

	getMinutDiffernce(date1: Date | string, date2: Date | string): number {
		return dayjs(date1).tz(this.timezone).diff(dayjs(date2), 'minute')
	}

	/**
	 * Checks if date is within specified hours from now
	 * Used in TimeSchedule service for determining time slot availability
	 */
	isWithinHours(date: Date | string, hours: number): boolean {
		const now = this.now()
		const diff = this.getHoursDifference(date, now)
		return diff <= hours && diff > 0
	}

	isMoreThanHoursAhead(date: Date | string, hours: number): boolean {
		const now = this.now()
		const diff = this.getHoursDifference(date, now)
		return diff <= hours
	}

	shouldHide(startTime: Date, endTime: Date) {
		const now = dayjs(new Date()).tz(this.timezone)
		const start = dayjs(startTime).tz(this.timezone)
		const end = dayjs(endTime).tz(this.timezone)

		if (start.diff(now, 'hour', true) <= 2 && start.isAfter(now)) {
			return false
		}
		if (now.isAfter(end)) {
			return true
		}

		// Hozirgi vaqt intervalda yotsa, o'chirib bo'lmaydi
		if (now.isBetween(start, end, null, '[)')) {
			return false
		}

		// Boshlanish vaqti hozirgi vaqtdan 2 soat ichida bo'lsa, o'chirib bo'lmaydi

		// Barcha shartlarga to'g'ri kelsa, o'chirish mumkin
		return true
	}

	isBefore(date1: Date | string, date2: Date | string): boolean {
		return dayjs(date1).tz(this.timezone).isBefore(dayjs(date2))
	}

	isAfter(date1: Date | string, date2: Date | string): boolean {
		return dayjs(date1).tz(this.timezone).isAfter(dayjs(date2))
	}
	getStartEndToYear(endDate?: Date | string, startDate?: Date | string) {
		let _endDate = endDate || this.now()
		let _startDate = startDate || this.now()
		const end = dayjs(_endDate).tz(this.timezone).endOf('year').toDate()
		const start = dayjs(_startDate).tz(this.timezone).startOf('year').toDate()
		return { start, end }
	}

	getOldYear(endDate?: Date | string, startDate?: Date | string) {
		let _endDate = endDate || this.now()
		let _startDate = startDate || this.now()
		const end = dayjs(_endDate)
			.tz(this.timezone)
			.subtract(1, 'year')
			.endOf('year')
			.toDate()
		const start = dayjs(_startDate)
			.tz(this.timezone)
			.subtract(1, 'year')
			.startOf('year')
			.toDate()
		return { start, end }
	}

	monthLastDay() {
		const today = dayjs().tz(this.timezone)
		const lastMonthDay = today.endOf('month')
		return today.date() === lastMonthDay.date()
	}
	formatStartEnd(endDate?: Date | string, startDate?: Date | string) {
		const start = dayjs(startDate || this.now()).toISOString()
		const end = dayjs(endDate || this.now()).toISOString()
		return { start, end }
	}

	getStartEndToMonth(endDate?: Date | string, startDate?: Date | string) {
		let _endDate = endDate || this.now()
		let _startDate = startDate || this.now()
		const end = dayjs(_endDate).tz(this.timezone).endOf('month').toDate()
		const start = dayjs(_startDate).tz(this.timezone).startOf('month').toDate()

		return { start, end }
	}
	timeToMinutes(time: string): number {
		const [hours, minutes] = time.split(':').map(Number)
		return hours * 60 + minutes
	}

	getMonthsBetween(startISO: string, endISO: string): number {
		const start = dayjs(startISO)
		const end = dayjs(endISO)

		// Oylar farqi + 1 (start oyini ham hisobga olish uchun)
		const monthsDiff = end.diff(start, 'month') + 1

		return monthsDiff
	}

	// Daqiqalarni HH:mm formatiga aylantirish
	minutesToTime(minutes: number): string {
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
	}


	getStartMonthAndEndMonth(endDate: Date | string) {
		const _endDate = endDate || this.now()
		const subStartDate = dayjs(_endDate)
			.tz(this.timezone)
			.subtract(1, 'month')
			.startOf('month')
			.toDate()
		const subEndDate = dayjs(_endDate)
			.tz(this.timezone)
			.subtract(1, 'month')
			.endOf('month')
			.toDate()
		const currentStartDate = dayjs(_endDate)
			.tz(this.timezone)
			.startOf('month')
			.toDate()
		const currentEndDate = dayjs(_endDate)
			.tz(this.timezone)
			.endOf('month')
			.toDate()
		return {
			subStartDate,
			subEndDate,
			currentStartDate,
			currentEndDate
		}
	}

	getCurrentHour() {
		return dayjs().tz(this.timezone).format('HH:mm')
	}
	getCurrentYear() {
		return dayjs().tz(this.timezone).year()
	}
}
