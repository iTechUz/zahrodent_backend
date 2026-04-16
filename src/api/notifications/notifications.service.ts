import { Injectable, NotFoundException } from "@nestjs/common";
import { add } from "date-fns";
import { PrismaService } from '@/prisma.service'; // ✅ If using path aliases
import { PaginationDto } from "src/utils/paginations";
import { NotificationsCreateDto } from "./dto";

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(pagination:PaginationDto) {
        const { page, pageSize, search, sortBy } = pagination;

        let where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } }
            ];
        }

        const data = await this.prisma.branch.findMany({
            where,
            take: pageSize,
            skip: (page - 1) * pageSize,
            orderBy: {
                createdAt: sortBy.toLowerCase() === 'asc' ? 'asc' : 'desc'
            }
        });

        const total = await this.prisma.branch.count({ where });

        return {
            data,
            total,
            page,
            pageSize
        };
    }


    async findOne(id: string) {
        const branch = await this.prisma.branch.findUnique({
            where: { id },
        });
        if (!branch) {
            throw new NotFoundException(`Branch with ID ${id} not found`);
        }
        return branch;
    }


    async create(data: NotificationsCreateDto) {
        return this.prisma.branch.create({
            data,
        });
    }

    async update(id: string, data: NotificationsCreateDto) {
        await this.findOne(id);
        return this.prisma.branch.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        await this.findOne(id);
        return this.prisma.branch.delete({
            where: { id },
        });
    }
}