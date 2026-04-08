import { PaginationDto } from 'src/utils/paginations';
export declare class CreateUserDto {
    firstName?: string;
    lastName?: string;
    phone: string;
    password?: string;
    image: string;
    roleId: string;
    currentBranchId: string;
    branchIds: string[];
}
declare const UpdateUserDto_base: import("@nestjs/common").Type<Partial<CreateUserDto>>;
export declare class UpdateUserDto extends UpdateUserDto_base {
}
export declare class filterByUserDto extends PaginationDto {
    roleId: string;
}
export declare class SetCurrentBranchDto {
    branchId: string;
}
export declare class UserProfileDto {
    firstName?: string;
    lastName?: string;
    phone?: string;
}
interface Permissions {
    read: boolean;
    create: boolean;
    update: boolean;
    remove: boolean;
    view: boolean;
    export: boolean;
    filter: boolean;
    import: boolean;
    print: boolean;
    share: boolean;
    upload: boolean;
    restore: boolean;
}
interface Roles {
    id: string;
    name: string;
    permissions: {
        all: Permissions;
    };
}
export interface IUserProfileDto {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
    image: string | null;
    currentBranchId: string | null;
    studentGroups: any[];
    teachingGroups: any[];
    roles: Roles;
    branches: any[];
    createdAt: string;
    updatedAt: string;
}
export {};
