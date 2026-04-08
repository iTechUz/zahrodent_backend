import { RoleCreateDto, RoleUpdateDto } from './dto';
import { PaginationDto } from '@/utils/paginations';
import { User } from '@prisma/client';
import { ApiController } from '../jwt.check.controller';
export declare class RolesController extends ApiController {
    private readonly rolesService;
    findAll(query: PaginationDto, user: User): Promise<{
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
    findOne(id: string, user: User): Promise<{
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
    getSomeRoles(): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(dto: RoleCreateDto, user: User): Promise<{
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
    update(id: string, dto: RoleUpdateDto, user: User): Promise<boolean>;
    remove(id: string, user: User): Promise<{
        success: boolean;
        message: string;
    }>;
}
