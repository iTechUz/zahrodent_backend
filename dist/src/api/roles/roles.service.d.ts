import { PrismaService } from 'src/prisma.service';
import { RoleCreateDto, RoleUpdateDto } from './dto';
export declare class RolesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(pagination: any, user: any): Promise<{
        data: ({
            permission: {
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
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
            _count: {
                permission: number;
            };
        } & {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
        })[];
        meta: {
            total: number;
            page: any;
            pageSize: any;
            pageCount: number;
        };
    }>;
    findOne(id: string, user: any): Promise<{
        permission: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
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
        users: {
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
        }[];
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(data: RoleCreateDto, user: any): Promise<{
        permission: {
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
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
    } & {
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, data: RoleUpdateDto, user: any): Promise<boolean>;
    remove(id: string, user: any): Promise<{
        success: boolean;
        message: string;
    }>;
    getSomeRoles(): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
}
