import { PrismaService } from '@/prisma.service';
import { PaginationDto } from "src/utils/paginations";
import { BranchCreateDto } from "./dto";
export declare class BranchService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(pagination: PaginationDto): Promise<{
        data: {
            name: string;
            id: string;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            description: string | null;
            address: string | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    findOne(id: string): Promise<{
        name: string;
        id: string;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        address: string | null;
    }>;
    create(data: BranchCreateDto): Promise<{
        name: string;
        id: string;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        address: string | null;
    }>;
    update(id: string, data: BranchCreateDto): Promise<{
        name: string;
        id: string;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        address: string | null;
    }>;
    remove(id: string): Promise<{
        name: string;
        id: string;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        address: string | null;
    }>;
}
