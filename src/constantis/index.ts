export const permit_list = {
	read: true,
	create: true,
	update: true,
	remove: true,
	view: true,
	filter: true,
	export: true,
	import: true,
	upload: true,
	print: true,
	share: true,
	restore: true
}

export const ROLES = ['dashboard', 'role', 'profile', 'users']
export const initilRoles = [
	{
		name: 'ADMIN'
	},
	{
		name: 'SUPER_ADMIN'
	}
]

export enum RolesEnum {
	ADMIN = 'ADMIN',
	SUPER_ADMIN = 'SUPER_ADMIN',
	DOCTOR = 'DOCTOR',
	CLIENT = 'CLIENT',
}

export enum BookingStatus {
	PENDING = 'PENDING',
	CONFIRMED = 'CONFIRMED',
	CANCELLED = 'CANCELLED',
	COMPLETED = 'COMPLETED',
	NO_SHOW = 'NO_SHOW',
}

export enum BookingSource {
	WEB = 'WEB',
	BOT = 'BOT',
	ADMIN = 'ADMIN',
	INSTAGRAM = 'INSTAGRAM',
	RECOMMENDATION = 'RECOMMENDATION',
	WALK_IN = 'WALK_IN',
}

export enum PatientSource {
	INSTAGRAM = 'INSTAGRAM',
	RECOMMENDATION = 'RECOMMENDATION',
	WALK_IN = 'WALK_IN',
	WEB = 'WEB',
	BOT = 'BOT',
	ADMIN = 'ADMIN',
}

export enum Gender {
	MALE = 'MALE',
	FEMALE = 'FEMALE',
}

export enum PaymentMethod {
	CASH = 'CASH',
	CARD = 'CARD',
	TRANSFER = 'TRANSFER',
}

export enum PaymentStatus {
	PENDING = 'PENDING',
	PAID = 'PAID',
	CANCELLED = 'CANCELLED',
	REFUNDED = 'REFUNDED',
}

export enum NotificationType {
	SMS = 'SMS',
	TELEGRAM = 'TELEGRAM',
	PUSH = 'PUSH',
}

export enum NotificationStatus {
	PENDING = 'PENDING',
	SENT = 'SENT',
	FAILED = 'FAILED',
	CANCELLED = 'CANCELLED',
}

export const monthNumbersObj = {
	0: 'Yanvar',
	1: 'Fevral',
	2: 'Mart',
	3: 'Aprel',
	4: 'May',
	5: 'Iyun',
	6: 'Iyul',
	7: 'Avgust',
	8: 'Sentabr',
	9: 'Oktabr',
	10: 'Noyabr',
	11: 'Dekabr'
}

export const monthTranslation = {
	January: 'Yanvar',
	February: 'Fevral',
	March: 'Mart',
	April: 'Aprel',
	May: 'May',
	June: 'Iyun',
	July: 'Iyul',
	August: 'Avgust',
	September: 'Sentabr',
	October: 'Oktabr',
	November: 'Noyabr',
	December: 'Dekabr'
}

export enum CRON_NAMES {
	QUIZ_CHECK_TIME_FINISHED_CRON = 'QUIZ_CHECK_TIME_FINISHED',
	PAYMENT_AUTO_CREATE_CRON = 'PAYMENT_AUTO_CREATE_CRON',
	BOT_NOTIFCATION_CRON = 'BOT_NOTIFCATION_CRON',
	ATTENDANCE_WARNING_CRON = 'ATTENDANCE_WARNING_CRON'
}

export enum STATUS {
	ACTIVE = 'ACTIVE',
	FREEZE = 'FREEZE',
	FINISHED = 'FINISHED',
	DELETED = 'DELETED'
}

export enum STATUS_REASON {
	DISCIPLINE = 'DISCIPLINE',
	PAYMENT = 'PAYMENT',
	PERSONAL = 'PERSONAL',
	OTHER = 'OTHER'
}

function encodeUUID(uuid: string): string {
	return Buffer.from(uuid).toString('base64url')
}

function decodeUUID(encoded: string): string {
	return Buffer.from(encoded, 'base64url').toString()
}
export { decodeUUID, encodeUUID }

export const phoneRegEx = /^(?:\+998 ?)?\d{2} ?\d{3} ?\d{2} ?\d{2}$/



export enum OutcomeReason {
	PAYROLL = "PAYROLL",
	RENT = "RENT",
	TAX = "TAX",
	OFFICE_SUPPLIES = "OFFICE_SUPPLIES",
	OFFICE_OPERATIONS = "OFFICE_OPERATIONS",
	IT_INFRASTRUCTURE = "IT_INFRASTRUCTURE",
	INTERNET = "INTERNET",
	MARKETING = "MARKETING",
	TRANSPORT = "TRANSPORT",
	FINANCE = "FINANCE",
	EDUCATION = "EDUCATION",
	MAINTENANCE = "MAINTENANCE",
	SECURITY = "SECURITY",
	DIGITAL_SERVICES = "DIGITAL_SERVICES",
	EVENTS = "EVENTS",
	LEGAL = "LEGAL",
	CURRICULUM = "CURRICULUM",
	DEPRECIATION = "DEPRECIATION",
	PROJECT = "PROJECT",
	EMERGENCY = "EMERGENCY",
	OTHER = "OTHER"
}

export const OutcomeReasonDescriptions = {
	PAYROLL: "Xarajatlari (Payroll) Oyliklar, bonuslar, ustozlarga to‘lov, avanslar, vaqtinchalik ishchi, ustaga haq.",
	RENT: "Ijara haqi (Rent) O‘quv markazi binosi ijara pullari, qo‘shimcha xona ijara, podoxod solig‘i.",
	TAX: "Majburiy to‘lovlar (Taxes & Compliance) INPS, JShDS (podoxod), IT-Park 1% to‘lovi.",
	OFFICE_SUPPLIES: "Ofis anjomlari (Office Supplies) Qog‘oz, oq list, marker, ruchka, stakan, stepler, o‘q, fayllar, papkalar.                       ",
	OFFICE_OPERATIONS: "Ehtiyojlari (Office Operations) Suv, choy, kofe, salfetka, tozalovchi vositalar, texnichka sarfi.",
	IT_INFRASTRUCTURE: "Texnik ta’minot (IT Infrastructure) Kompyuterlar, monitorlar, klaviatura, sichqoncha, zaryadlovchi, blok pitaniya, kabel, servis xarajatlari.                       ",
	INTERNET: "Aloqa (Internet & Telecom) WiFi tariflari, shahar telefoni, SMS xabarnoma xizmati.",
	MARKETING: "Reklama (Marketing & PR) Banner, reklama dizayn, fotografiya, promo video, kontekst reklama, target xarajatlari.                       ",
	TRANSPORT: "Yetkazib berish (Transport) Yo‘lkira, taksi, kuryer, yetkazib berish (dostavka), yoqilg‘i kompensatsiyasi.",
	FINANCE: "Operatsiyalar va kassa (Finance & Cash Ops) Kassa apparati ijara/to‘lov, terminal xarajatlari, kartadan naqdga olish.                       ",
	EDUCATION: "Dasturiy xarajatlari (Education Program Costs) Sertifikatlar, testlar, motivatsiya sovg‘alari, dars uchun materiallar.                       ",
	MAINTENANCE: "Ta’mirlash va texnik xizmat (Maintenance) Elektr lampalari, ta’mir, usta chaqirish, mebel ta’miri, konditsioner tozalash.                       ",
	SECURITY: "Himoya (Security) Gvardiya to‘lovi, CCTV servis, signalizatsiya texnik xizmati.",
	DIGITAL_SERVICES: "xizmatlar (Digital Services) LMS litsenziyasi, Zoom/Meet premium, Google Workspace, Microsoft 365, ChatGPT obuna.",
	EVENTS: "va jamoa tadbirlari (HR Activities & Events) Tug‘ilgan kunlar, jamoa motivatsiyasi, futbol turniri, loyiha yakuniga bag‘ishlangan tadbirlar.                       ",
	LEGAL: "xizmatlar (Legal Services) Shartnoma tuzish, yuridik maslahat, notarius to‘lovlari.",
	CURRICULUM: "dasturi yangilanishi (Curriculum Development) Yangi kurslar ishlab chiqish, metodistga to‘lov, kontent yaratish.",
	DEPRECIATION: "Amortizatsiya (Depreciation) Kompyuter, stol, stul, doska, projektor va boshqa aktivlarning yillik amortizatsiyasi.                       ",
	PROJECT: "Xarajatlari (Project-Based Costs) Maxsus kurs uchun alohida xarajat: kamera, mikrofon, loyihaga to‘lovlari.",
	EMERGENCY: "Rejalashtirilmagan xarajatlar (Emergency & Buffer) Favqulodda ta’mir, to‘satdan zarur bo‘lib qolgan vositalar, zaxira mablag‘.",
	OTHER: ''
}

export enum HikivistionStatusINOUT {
	IN = 'IN',
	OUT = 'OUT',
}