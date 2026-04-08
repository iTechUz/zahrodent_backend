"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateTimeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const dayjs = require("dayjs");
const isBetween = require("dayjs/plugin/isBetween");
const timezone = require("dayjs/plugin/timezone");
const utc = require("dayjs/plugin/utc");
let DateTimeService = class DateTimeService {
    constructor(configService) {
        this.configService = configService;
        dayjs.extend(utc);
        dayjs.extend(timezone);
        dayjs.extend(isBetween);
        this.timezone =
            this.configService.get('TIMEZONE') || 'Asia/Tashkent';
        dayjs.tz.setDefault(this.timezone);
    }
    now() {
        return dayjs().tz(this.timezone).toDate();
    }
    getCurrentDate() {
        return dayjs().tz(this.timezone).format('YYYY-MM-DD');
    }
    getMonthRange(date) {
        return {
            start: dayjs(date).tz(this.timezone).startOf('month').toDate(),
            end: dayjs(date).tz(this.timezone).endOf('month').toDate()
        };
    }
    getDateRage(startDate, endDate) {
        return {
            start: startDate ? dayjs(startDate).tz(this.timezone).startOf('day').toDate() : dayjs().tz(this.timezone).startOf('month').toDate(),
            end: endDate ? dayjs(endDate).tz(this.timezone).endOf('day').toDate() : dayjs().tz(this.timezone).endOf('month').toDate()
        };
    }
    getDateRageFormat(startDate, endDate) {
        return {
            start: dayjs(startDate).tz(this.timezone).format('YYYY-MM-DD HH:mm:ss'),
            end: dayjs(endDate).tz(this.timezone).format('YYYY-MM-DD HH:mm:ss')
        };
    }
    getStartAndEndOfMonth(startDate, endDate) {
        return {
            start: dayjs(startDate).tz(this.timezone).startOf('month').toDate(),
            end: dayjs(endDate).tz(this.timezone).endOf('month').toDate()
        };
    }
    getMonthNumber() {
        return dayjs().tz(this.timezone).month();
    }
    isSameMonth(ts1, ts2) {
        return dayjs(ts1).isSame(dayjs(ts2), 'month');
    }
    toAppTimezone(date) {
        return dayjs(date).tz(this.timezone).toDate();
    }
    formatTimes(_startTime, _endTime) {
        const startTime = dayjs.tz(`${_startTime} 04:00`, this.timezone).toDate();
        const endTime = dayjs.tz(`${_endTime} 23:00`, this.timezone).toDate();
        return { startTime, endTime };
    }
    currentDay() {
        const start = dayjs().tz(this.timezone).startOf('day').format('HH:mm');
        const end = dayjs().tz(this.timezone).endOf('day').format('HH:mm');
        return { start, end };
    }
    currentWeekDay() {
        const day = dayjs().tz(this.timezone).day() || 7;
        return day;
    }
    formatDate(date) {
        return dayjs(date).tz(this.timezone).format('YYYY-MM-DD');
    }
    formatMonth(date) {
        return dayjs(date).tz(this.timezone).format('MMMM YYYY');
    }
    formatTime(date) {
        return dayjs(date).tz(this.timezone).format('HH:mm');
    }
    formatDateTime(date) {
        return dayjs(date).tz(this.timezone).format('YYYY-MM-DD HH:mm:ss');
    }
    formatDateTimeHour(date) {
        return dayjs(date).tz(this.timezone).format('YYYY-MM-DD HH:mm');
    }
    formatTimeDateString(date) {
        return dayjs(date).tz(this.timezone).format('HH:mm');
    }
    startOfDay(date) {
        return dayjs(date).tz(this.timezone).startOf('day').toDate();
    }
    formatOfDay(date, time) {
        const [hours, minutes] = time.split(':').map(Number);
        return dayjs(date)
            .tz(this.timezone)
            .hour(hours)
            .minute(minutes)
            .second(0)
            .millisecond(0)
            .toDate();
    }
    weekDay() {
        return dayjs(new Date()).tz(this.timezone).day() || 7;
    }
    endOfDay(date) {
        return dayjs(date).tz(this.timezone).endOf('day').toDate();
    }
    isPast(date) {
        return dayjs(date).tz(this.timezone).isBefore(this.now());
    }
    isWithinTimeRange(startTime, endTime) {
        const checkTime = dayjs().tz(this.timezone);
        const _startTime = dayjs(startTime).tz(this.timezone);
        const _endTime = dayjs(endTime).tz(this.timezone);
        return checkTime.isAfter(_startTime) && checkTime.isBefore(_endTime);
    }
    add(date, amount, unit) {
        return dayjs(date).tz(this.timezone).add(amount, unit).toDate();
    }
    diff(date1, date2, unit) {
        return dayjs(date1).tz(this.timezone).diff(dayjs(date2), unit);
    }
    setTimeFromString(date, timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return dayjs(date)
            .tz(this.timezone)
            .hour(hours)
            .minute(minutes)
            .second(0)
            .millisecond(0)
            .toDate();
    }
    timeStringFromDate(date, timeString) {
        const [hours, minutes] = dayjs(timeString)
            .tz(this.timezone)
            .format('HH:mm')
            .split(':')
            .map(Number);
        return dayjs(date)
            .tz(this.timezone)
            .hour(hours)
            .minute(minutes)
            .second(0)
            .millisecond(0)
            .toDate();
    }
    getDayOfWeek(date) {
        return dayjs(date).tz(this.timezone).day() || 7;
    }
    sameDayLastWeek(date, dayOfWeek) {
        return dayjs(date)
            .tz(this.timezone)
            .subtract(1, 'week')
            .format('YYYY-MM-DD');
    }
    addMonths(date, months) {
        return dayjs(date).tz(this.timezone).add(months, 'month').toDate();
    }
    date(date) {
        return dayjs(date).tz(this.timezone).toDate();
    }
    getHoursDifference(date1, date2) {
        return dayjs(date1).tz(this.timezone).diff(dayjs(date2), 'hour');
    }
    addMinut(date, minutes) {
        return dayjs(date).tz(this.timezone).add(minutes, 'minute').toDate();
    }
    quizFinishTime(endDate) {
        const now = dayjs(new Date()).tz(this.timezone);
        if (now.isBefore(endDate) || now.isSame(endDate)) {
            return true;
        }
        else {
            return false;
        }
    }
    getMinutDiffernce(date1, date2) {
        return dayjs(date1).tz(this.timezone).diff(dayjs(date2), 'minute');
    }
    isWithinHours(date, hours) {
        const now = this.now();
        const diff = this.getHoursDifference(date, now);
        return diff <= hours && diff > 0;
    }
    isMoreThanHoursAhead(date, hours) {
        const now = this.now();
        const diff = this.getHoursDifference(date, now);
        return diff <= hours;
    }
    shouldHide(startTime, endTime) {
        const now = dayjs(new Date()).tz(this.timezone);
        const start = dayjs(startTime).tz(this.timezone);
        const end = dayjs(endTime).tz(this.timezone);
        if (start.diff(now, 'hour', true) <= 2 && start.isAfter(now)) {
            return false;
        }
        if (now.isAfter(end)) {
            return true;
        }
        if (now.isBetween(start, end, null, '[)')) {
            return false;
        }
        return true;
    }
    isBefore(date1, date2) {
        return dayjs(date1).tz(this.timezone).isBefore(dayjs(date2));
    }
    isAfter(date1, date2) {
        return dayjs(date1).tz(this.timezone).isAfter(dayjs(date2));
    }
    getStartEndToYear(endDate, startDate) {
        let _endDate = endDate || this.now();
        let _startDate = startDate || this.now();
        const end = dayjs(_endDate).tz(this.timezone).endOf('year').toDate();
        const start = dayjs(_startDate).tz(this.timezone).startOf('year').toDate();
        return { start, end };
    }
    getOldYear(endDate, startDate) {
        let _endDate = endDate || this.now();
        let _startDate = startDate || this.now();
        const end = dayjs(_endDate)
            .tz(this.timezone)
            .subtract(1, 'year')
            .endOf('year')
            .toDate();
        const start = dayjs(_startDate)
            .tz(this.timezone)
            .subtract(1, 'year')
            .startOf('year')
            .toDate();
        return { start, end };
    }
    monthLastDay() {
        const today = dayjs().tz(this.timezone);
        const lastMonthDay = today.endOf('month');
        return today.date() === lastMonthDay.date();
    }
    formatStartEnd(endDate, startDate) {
        const start = dayjs(startDate || this.now()).toISOString();
        const end = dayjs(endDate || this.now()).toISOString();
        return { start, end };
    }
    getStartEndToMonth(endDate, startDate) {
        let _endDate = endDate || this.now();
        let _startDate = startDate || this.now();
        const end = dayjs(_endDate).tz(this.timezone).endOf('month').toDate();
        const start = dayjs(_startDate).tz(this.timezone).startOf('month').toDate();
        return { start, end };
    }
    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }
    getMonthsBetween(startISO, endISO) {
        const start = dayjs(startISO);
        const end = dayjs(endISO);
        const monthsDiff = end.diff(start, 'month') + 1;
        return monthsDiff;
    }
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
    getStartMonthAndEndMonth(endDate) {
        const _endDate = endDate || this.now();
        const subStartDate = dayjs(_endDate)
            .tz(this.timezone)
            .subtract(1, 'month')
            .startOf('month')
            .toDate();
        const subEndDate = dayjs(_endDate)
            .tz(this.timezone)
            .subtract(1, 'month')
            .endOf('month')
            .toDate();
        const currentStartDate = dayjs(_endDate)
            .tz(this.timezone)
            .startOf('month')
            .toDate();
        const currentEndDate = dayjs(_endDate)
            .tz(this.timezone)
            .endOf('month')
            .toDate();
        return {
            subStartDate,
            subEndDate,
            currentStartDate,
            currentEndDate
        };
    }
    getCurrentHour() {
        return dayjs().tz(this.timezone).format('HH:mm');
    }
    getCurrentYear() {
        return dayjs().tz(this.timezone).year();
    }
};
exports.DateTimeService = DateTimeService;
exports.DateTimeService = DateTimeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DateTimeService);
//# sourceMappingURL=date-time.service.js.map