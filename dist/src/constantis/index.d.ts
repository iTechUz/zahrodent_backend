export declare const permit_list: {
    read: boolean;
    create: boolean;
    update: boolean;
    remove: boolean;
    view: boolean;
    filter: boolean;
    export: boolean;
    import: boolean;
    upload: boolean;
    print: boolean;
    share: boolean;
    restore: boolean;
};
export declare const ROLES: string[];
export declare const initilRoles: {
    name: string;
}[];
export declare enum RolesEnum {
    ADMIN = "ADMIN",
    SUPER_ADMIN = "SUPER_ADMIN"
}
export declare const monthNumbersObj: {
    0: string;
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    9: string;
    10: string;
    11: string;
};
export declare const monthTranslation: {
    January: string;
    February: string;
    March: string;
    April: string;
    May: string;
    June: string;
    July: string;
    August: string;
    September: string;
    October: string;
    November: string;
    December: string;
};
export declare enum CRON_NAMES {
    QUIZ_CHECK_TIME_FINISHED_CRON = "QUIZ_CHECK_TIME_FINISHED",
    PAYMENT_AUTO_CREATE_CRON = "PAYMENT_AUTO_CREATE_CRON",
    BOT_NOTIFCATION_CRON = "BOT_NOTIFCATION_CRON",
    ATTENDANCE_WARNING_CRON = "ATTENDANCE_WARNING_CRON"
}
export declare enum STATUS {
    ACTIVE = "ACTIVE",
    FREEZE = "FREEZE",
    FINISHED = "FINISHED",
    DELETED = "DELETED"
}
export declare enum STATUS_REASON {
    DISCIPLINE = "DISCIPLINE",
    PAYMENT = "PAYMENT",
    PERSONAL = "PERSONAL",
    OTHER = "OTHER"
}
declare function encodeUUID(uuid: string): string;
declare function decodeUUID(encoded: string): string;
export { decodeUUID, encodeUUID };
export declare const phoneRegEx: RegExp;
export declare enum OutcomeReason {
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
export declare const OutcomeReasonDescriptions: {
    PAYROLL: string;
    RENT: string;
    TAX: string;
    OFFICE_SUPPLIES: string;
    OFFICE_OPERATIONS: string;
    IT_INFRASTRUCTURE: string;
    INTERNET: string;
    MARKETING: string;
    TRANSPORT: string;
    FINANCE: string;
    EDUCATION: string;
    MAINTENANCE: string;
    SECURITY: string;
    DIGITAL_SERVICES: string;
    EVENTS: string;
    LEGAL: string;
    CURRICULUM: string;
    DEPRECIATION: string;
    PROJECT: string;
    EMERGENCY: string;
    OTHER: string;
};
export declare enum HikivistionStatusINOUT {
    IN = "IN",
    OUT = "OUT"
}
