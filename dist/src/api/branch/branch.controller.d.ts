import { PaginationDto } from 'src/utils/paginations';
import { ApiController } from '../jwt.check.controller';
import { BranchCreateDto } from './dto';
export declare class BranchController extends ApiController {
    private readonly branchService;
    getAllBranches(pagination: PaginationDto): Promise<{
        data: {
            id: string;
            name: string;
            description: string | null;
            address: string | null;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    getBranchById(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createBranch(data: BranchCreateDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateBranch(id: string, data: BranchCreateDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteBranch(id: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        address: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
