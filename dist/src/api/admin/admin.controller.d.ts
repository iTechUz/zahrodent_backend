import { PaginationDto } from '@/utils/paginations';
import { User } from '@prisma/client';
import { ApiController } from '../jwt.check.controller';
import { CreateAdminDto, UpdateAdminDto } from './dto';
export declare class AdminController extends ApiController {
    private readonly adminService;
    findAll(query: PaginationDto, user: User): Promise<{
        data: ({
            roles: {
                name: string;
                id: string;
            };
            branches: {
                name: string;
                id: string;
            }[];
        } & {
            id: string;
            phone: string | null;
            firstName: string | null;
            lastName: string | null;
            password: string | null;
            createdAt: Date;
            updatedAt: Date;
            roleId: string | null;
            currentBranchId: string | null;
            image: string | null;
            status: import(".prisma/client").$Enums.UserStatus;
            statusChangedAt: Date | null;
            statusReason: string | null;
        })[];
        meta: {
            page: number;
            pageSize: number;
            total: number;
            pageCount: number;
        };
    }>;
    findOne(id: string, user: User): Promise<{
        roles: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
        };
        branches: {
            name: string;
            id: string;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            address: string | null;
        }[];
    } & {
        id: string;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        password: string | null;
        createdAt: Date;
        updatedAt: Date;
        roleId: string | null;
        currentBranchId: string | null;
        image: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        statusChangedAt: Date | null;
        statusReason: string | null;
    }>;
    create(dto: CreateAdminDto, user: User): Promise<{
        id: string;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        password: string | null;
        createdAt: Date;
        updatedAt: Date;
        roleId: string | null;
        currentBranchId: string | null;
        image: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        statusChangedAt: Date | null;
        statusReason: string | null;
    }>;
    update(id: string, dto: UpdateAdminDto, user: User): Promise<{
        id: string;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        password: string | null;
        createdAt: Date;
        updatedAt: Date;
        roleId: string | null;
        currentBranchId: string | null;
        image: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        statusChangedAt: Date | null;
        statusReason: string | null;
    }>;
    remove(id: string, user: User): Promise<{
        id: string;
        phone: string | null;
        firstName: string | null;
        lastName: string | null;
        password: string | null;
        createdAt: Date;
        updatedAt: Date;
        roleId: string | null;
        currentBranchId: string | null;
        image: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        statusChangedAt: Date | null;
        statusReason: string | null;
    }>;
}
