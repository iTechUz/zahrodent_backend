import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { AuthUserView } from '../auth/auth.service';

@ApiTags('users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha xodimlarni olish (Faqat Admin/SuperAdmin)' })
  findAll(@GetUser() user: AuthUserView) {
    return this.usersService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: "Xodim ma'lumotlarini olish" })
  findOne(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.usersService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Yangi xodim yaratish' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Xodim ma'lumotlarini yangilash" })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @GetUser() user: AuthUserView,
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Xodimni o'chirish" })
  remove(@Param('id') id: string, @GetUser() user: AuthUserView) {
    return this.usersService.remove(id, user);
  }
}
