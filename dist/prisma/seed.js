"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const constantis_1 = require("../src/constantis");
const prisma = new client_1.PrismaClient();
const logger = new common_1.Logger('Seed');
async function main() {
    const adminPhone = process.env.ADMIN_PHONE || '+998900000000';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin!@#$%';
    for (const roleData of constantis_1.initilRoles) {
        const existingRole = await prisma.roles.findFirst({
            where: { name: roleData.name }
        });
        if (!existingRole) {
            const data = await prisma.roles.create({
                data: {
                    name: roleData.name,
                }
            });
            await prisma.permission.create({
                data: {
                    roleId: data.id,
                    name: 'all',
                    ...constantis_1.permit_list
                }
            });
            logger.log(`Role created: ${roleData.name}`);
        }
        else {
            logger.log(`Role already exists: ${existingRole.name}`);
        }
    }
    const findSuperAdmin = await prisma.roles.findFirst({
        where: { name: constantis_1.RolesEnum.SUPER_ADMIN }
    });
    const existingAdmin = await prisma.user.findFirst({
        where: {
            phone: adminPhone,
            roles: {
                name: constantis_1.RolesEnum.SUPER_ADMIN
            }
        }
    });
    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const admin = await prisma.user.create({
            data: {
                phone: adminPhone,
                password: hashedPassword,
                roleId: findSuperAdmin.id,
            }
        });
        logger.log(`Admin created: ${admin.phone}`);
    }
    else {
        logger.log('Admin already exists');
    }
}
main()
    .catch(e => {
    logger.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map