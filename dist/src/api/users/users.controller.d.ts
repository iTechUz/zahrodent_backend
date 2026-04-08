import { FileUploadService } from '../file-upload/file-upload.service';
import { CreateUserDto, filterByUserDto, IUserProfileDto } from './dto/user.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    private readonly fileUploadService;
    constructor(usersService: UsersService, fileUploadService: FileUploadService);
    findAll(pagination: filterByUserDto): Promise<{
        data: ({
            roles: {
                name: string;
                id: string;
            };
            branches: {
                name: string;
                id: string;
                phone: string;
                address: string;
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
            total: number;
            page: number;
            pageSize: number;
            pageCount: number;
        };
    }>;
    numberOfUsers(): Promise<{
        count: {
            all: number;
            admins: number;
        };
    }>;
    getMe(user: IUserProfileDto): Promise<{
        roles: {
            permission: {
                name: string;
                id: string;
                roleId: string;
                filter: boolean;
                read: boolean;
                view: boolean;
                create: boolean;
                remove: boolean;
                update: boolean;
                print: boolean;
                share: boolean;
                export: boolean;
                import: boolean;
                upload: boolean;
                restore: boolean;
            }[];
            name: string;
            id: string;
        };
        id: string;
        phone: string;
        firstName: string;
        lastName: string;
        createdAt: Date;
        updatedAt: Date;
        image: string;
        branches: {
            name: string;
            id: string;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            address: string | null;
        }[];
    }>;
    findOne(id: string): Promise<{
        roles: {
            permission: {
                name: string;
                id: string;
                roleId: string;
                filter: boolean;
                read: boolean;
                view: boolean;
                create: boolean;
                remove: boolean;
                update: boolean;
                print: boolean;
                share: boolean;
                export: boolean;
                import: boolean;
                upload: boolean;
                restore: boolean;
            }[];
            name: string;
            id: string;
        };
        id: string;
        phone: string;
        firstName: string;
        lastName: string;
        createdAt: Date;
        updatedAt: Date;
        image: string;
        branches: {
            name: string;
            id: string;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            address: string | null;
        }[];
    }>;
    updateCurrentBranch(user: any, branchId: string): Promise<{
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
    update(id: string, data: Partial<CreateUserDto>): Promise<{
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
    delete(id: string): Promise<{
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
    uploadAvatar(user: IUserProfileDto, body: CreateUserDto): Promise<{
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
