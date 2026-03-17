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
  Query,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post('hospital/:hospitalId')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  create(
    @Param('hospitalId') hospitalId: string,
    @Body() createDepartmentDto: CreateDepartmentDto,
    @Request() req: any,
  ) {
    return this.departmentsService.create(hospitalId, createDepartmentDto, req.user);
  }

  @Get()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  findAll(@Query('hospitalId') hospitalId: string | undefined, @Request() req: any) {
    // If hospitalId is provided as query param, use it
    if (hospitalId) {
      return this.departmentsService.findByHospital(hospitalId, req.user);
    }
    return this.departmentsService.findAll(req.user);
  }

  @Get('hospital/:hospitalId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  findByHospital(@Param('hospitalId') hospitalId: string, @Request() req: any) {
    return this.departmentsService.findByHospital(hospitalId, req.user);
  }

  @Get(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
  )
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.departmentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @Request() req: any,
  ) {
    return this.departmentsService.update(id, updateDepartmentDto, req.user);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.departmentsService.remove(id, req.user);
  }
}
