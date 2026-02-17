import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { HospitalsService } from './hospitals.service';
import { CreateHospitalDto, UpdateHospitalDto, CreateHospitalUserDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('hospitals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  /**
   * GET /hospitals
   * Get all hospitals (Super Admin and Hospital Admin)
   */
  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async findAll() {
    return this.hospitalsService.findAll();
  }

  /**
   * GET /hospitals/:id
   * Get single hospital by ID
   */
  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async findOne(@Param('id') id: string) {
    return this.hospitalsService.findOne(id);
  }

  /**
   * POST /hospitals
   * Create new hospital (Super Admin only)
   */
  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  async create(
    @Body() createHospitalDto: CreateHospitalDto,
    @Request() req: any,
  ) {
    const userId = req.user.id; // Changed from req.user.userId
    return this.hospitalsService.create(createHospitalDto, userId);
  }

  /**
   * PUT /hospitals/:id
   * Update hospital (Super Admin and Hospital Admin for their own hospital)
   */
  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateHospitalDto: UpdateHospitalDto,
    @Request() req: any,
  ) {
    const userId = req.user.id; // Changed from req.user.userId
    // TODO: Add check for Hospital Admin to only update their own hospital
    return this.hospitalsService.update(id, updateHospitalDto, userId);
  }

  /**
   * DELETE /hospitals/:id
   * Soft delete hospital (Super Admin only)
   */
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.id; // Changed from req.user.userId
    return this.hospitalsService.remove(id, userId);
  }

  /**
   * GET /hospitals/:id/users
   * Get all users for a specific hospital
   */
  @Get(':id/users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async findHospitalUsers(
    @Param('id') id: string,
    @Query('role') role?: UserRole,
    @Query('departmentId') departmentId?: string,
    @Query('subDepartmentId') subDepartmentId?: string,
  ) {
    return this.hospitalsService.findHospitalUsers(id, {
      role,
      departmentId,
      subDepartmentId,
    });
  }

  /**
   * POST /hospitals/:id/users
   * Add a new user to a hospital (Super Admin and Hospital Admin)
   */
  @Post(':id/users')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  async addUser(
    @Param('id') id: string,
    @Body() createUserDto: CreateHospitalUserDto,
    @Request() req: any,
  ) {
    const createdByUserId = req.user.id;
    return this.hospitalsService.addUser(id, createUserDto, createdByUserId);
  }

  /**
   * POST /hospitals/:id/assign-admin
   * Assign Hospital Admin to a hospital (Super Admin only)
   */
  @Post(':id/assign-admin')
  @Roles(UserRole.SUPER_ADMIN)
  async assignAdmin(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Request() req: any,
  ) {
    const assignedByUserId = req.user.id; // Changed from req.user.userId
    return this.hospitalsService.assignAdmin(id, userId, assignedByUserId);
  }
}
