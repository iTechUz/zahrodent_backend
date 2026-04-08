"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HikivistionStatusINOUT = exports.OutcomeReasonDescriptions = exports.OutcomeReason = exports.phoneRegEx = exports.STATUS_REASON = exports.STATUS = exports.CRON_NAMES = exports.monthTranslation = exports.monthNumbersObj = exports.RolesEnum = exports.initilRoles = exports.ROLES = exports.permit_list = void 0;
exports.decodeUUID = decodeUUID;
exports.encodeUUID = encodeUUID;
exports.permit_list = {
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
};
exports.ROLES = ['dashboard', 'role', 'profile', 'users'];
exports.initilRoles = [
    {
        name: 'ADMIN'
    },
    {
        name: 'SUPER_ADMIN'
    }
];
var RolesEnum;
(function (RolesEnum) {
    RolesEnum["ADMIN"] = "ADMIN";
    RolesEnum["SUPER_ADMIN"] = "SUPER_ADMIN";
})(RolesEnum || (exports.RolesEnum = RolesEnum = {}));
exports.monthNumbersObj = {
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
};
exports.monthTranslation = {
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
};
var CRON_NAMES;
(function (CRON_NAMES) {
    CRON_NAMES["QUIZ_CHECK_TIME_FINISHED_CRON"] = "QUIZ_CHECK_TIME_FINISHED";
    CRON_NAMES["PAYMENT_AUTO_CREATE_CRON"] = "PAYMENT_AUTO_CREATE_CRON";
    CRON_NAMES["BOT_NOTIFCATION_CRON"] = "BOT_NOTIFCATION_CRON";
    CRON_NAMES["ATTENDANCE_WARNING_CRON"] = "ATTENDANCE_WARNING_CRON";
})(CRON_NAMES || (exports.CRON_NAMES = CRON_NAMES = {}));
var STATUS;
(function (STATUS) {
    STATUS["ACTIVE"] = "ACTIVE";
    STATUS["FREEZE"] = "FREEZE";
    STATUS["FINISHED"] = "FINISHED";
    STATUS["DELETED"] = "DELETED";
})(STATUS || (exports.STATUS = STATUS = {}));
var STATUS_REASON;
(function (STATUS_REASON) {
    STATUS_REASON["DISCIPLINE"] = "DISCIPLINE";
    STATUS_REASON["PAYMENT"] = "PAYMENT";
    STATUS_REASON["PERSONAL"] = "PERSONAL";
    STATUS_REASON["OTHER"] = "OTHER";
})(STATUS_REASON || (exports.STATUS_REASON = STATUS_REASON = {}));
function encodeUUID(uuid) {
    return Buffer.from(uuid).toString('base64url');
}
function decodeUUID(encoded) {
    return Buffer.from(encoded, 'base64url').toString();
}
exports.phoneRegEx = /^(?:\+998 ?)?\d{2} ?\d{3} ?\d{2} ?\d{2}$/;
var OutcomeReason;
(function (OutcomeReason) {
    OutcomeReason["PAYROLL"] = "PAYROLL";
    OutcomeReason["RENT"] = "RENT";
    OutcomeReason["TAX"] = "TAX";
    OutcomeReason["OFFICE_SUPPLIES"] = "OFFICE_SUPPLIES";
    OutcomeReason["OFFICE_OPERATIONS"] = "OFFICE_OPERATIONS";
    OutcomeReason["IT_INFRASTRUCTURE"] = "IT_INFRASTRUCTURE";
    OutcomeReason["INTERNET"] = "INTERNET";
    OutcomeReason["MARKETING"] = "MARKETING";
    OutcomeReason["TRANSPORT"] = "TRANSPORT";
    OutcomeReason["FINANCE"] = "FINANCE";
    OutcomeReason["EDUCATION"] = "EDUCATION";
    OutcomeReason["MAINTENANCE"] = "MAINTENANCE";
    OutcomeReason["SECURITY"] = "SECURITY";
    OutcomeReason["DIGITAL_SERVICES"] = "DIGITAL_SERVICES";
    OutcomeReason["EVENTS"] = "EVENTS";
    OutcomeReason["LEGAL"] = "LEGAL";
    OutcomeReason["CURRICULUM"] = "CURRICULUM";
    OutcomeReason["DEPRECIATION"] = "DEPRECIATION";
    OutcomeReason["PROJECT"] = "PROJECT";
    OutcomeReason["EMERGENCY"] = "EMERGENCY";
    OutcomeReason["OTHER"] = "OTHER";
})(OutcomeReason || (exports.OutcomeReason = OutcomeReason = {}));
exports.OutcomeReasonDescriptions = {
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
};
var HikivistionStatusINOUT;
(function (HikivistionStatusINOUT) {
    HikivistionStatusINOUT["IN"] = "IN";
    HikivistionStatusINOUT["OUT"] = "OUT";
})(HikivistionStatusINOUT || (exports.HikivistionStatusINOUT = HikivistionStatusINOUT = {}));
//# sourceMappingURL=index.js.map