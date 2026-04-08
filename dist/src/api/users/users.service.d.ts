import { HashingService } from 'src/utils/hashing';
import { PrismaService } from '../../prisma.service';
import { DateTimeService } from '../date-time/date-time.service';
import { CreateUserDto, filterByUserDto, IUserProfileDto } from './dto/user.dto';
export declare class UsersService {
    private prisma;
    private dateTimeService;
    private hashService;
    constructor(prisma: PrismaService, dateTimeService: DateTimeService, hashService: HashingService);
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
    findOne(id: string, currentUser?: IUserProfileDto): Promise<{
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
    setCurrentBranch(user: IUserProfileDto, branchId: string): Promise<{
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
    remove(id: string): Promise<{
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
    create(user: IUserProfileDto, data: CreateUserDto): Promise<{
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
    numberOfUsers(): Promise<{
        count: {
            all: number;
            admins: number;
        };
    }>;
}
