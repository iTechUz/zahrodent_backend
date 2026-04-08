import { PrismaService } from 'src/prisma.service';
import { HashingService } from 'src/utils/hashing/hashing.service';
import { PaginationDto } from 'src/utils/paginations';
import { CreateAdminDto, UpdateAdminDto } from './dto';
export declare class AdminService {
    private readonly prismaService;
    private readonly hashService;
    constructor(prismaService: PrismaService, hashService: HashingService);
    findAll(pagination: PaginationDto, user: any): Promise<{
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
    findOne(id: string, user: any): Promise<{
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
    create(data: CreateAdminDto, user: any): Promise<{
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
    update(id: string, data: UpdateAdminDto, user: any): Promise<{
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
    remove(id: string, user: any): Promise<{
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
