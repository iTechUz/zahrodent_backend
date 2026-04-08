export declare class RoleCreateDto {
    name: string;
    permissions: {
        [menu: string]: {
            [action: string]: boolean;
        };
    };
}
export declare class RoleUpdateDto {
    name: string;
    permissions: {
        [menu: string]: {
            [action: string]: boolean;
        };
    };
}
export declare class PermissionUpdateDto {
    name: string;
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
}
