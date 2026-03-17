import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubDepartmentsService } from './sub-departments.service';
import { CreateSubDepartmentDto } from './dto/create-sub-department.dto';
import { UpdateSubDepartmentDto } from './dto/update-sub-department.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('sub-departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubDepartmentsController {
  constructor(private readonly subDepartmentsService: SubDepartmentsService) {}

  @Post('department/:departmentId')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN)
  create(
    @Param('departmentId') departmentId: string,
    @Body() createSubDepartmentDto: CreateSubDepartmentDto,
    @Request() req: any,
  ) {
    return this.subDepartmentsService.create(departmentId, createSubDepartmentDto, req.user);
  }

  @Get()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
  )
  findAll(@Request() req: any) {
    return this.subDepartmentsService.findAll(req.user);
  }

  @Get('department/:departmentId')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DEPARTMENT_ADMIN)
  findByDepartment(@Param('departmentId') departmentId: string, @Request() req: any) {
    return this.subDepartmentsService.findByDepartment(departmentId, req.user);
  }

  @Get(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
  )
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.subDepartmentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateSubDepartmentDto: UpdateSubDepartmentDto,
    @Request() req: any,
  ) {
    return this.subDepartmentsService.update(id, updateSubDepartmentDto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.subDepartmentsService.remove(id, req.user);
  }
}
