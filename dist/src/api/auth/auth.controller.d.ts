import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto';
import { ChangePasswordDto } from './dto/change-password.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginDto: AdminLoginDto): Promise<{
        token: string;
        branches: {
            id: string;
            phone: string | null;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            description: string | null;
            address: string | null;
        }[];
    }>;
    changePassword(changePasswordDto: ChangePasswordDto): Promise<{
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
