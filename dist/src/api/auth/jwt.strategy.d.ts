import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private configService;
    private prisma;
    constructor(configService: ConfigService, prisma: PrismaService);
    validate(payload: {
        sub: string;
        role: string;
    }): Promise<{
        id: string;
        phone: string;
        roles: {
            name: string;
            id: string;
        };
        roleName: string;
        roleId: string;
        currentBranchId: string;
    }>;
}
export {};
