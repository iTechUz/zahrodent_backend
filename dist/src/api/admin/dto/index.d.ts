export declare class CreateAdminDto {
    phone: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    branchIds: string[];
}
declare const UpdateAdminDto_base: import("@nestjs/common").Type<Partial<CreateAdminDto>>;
export declare class UpdateAdminDto extends UpdateAdminDto_base {
}
export {};
