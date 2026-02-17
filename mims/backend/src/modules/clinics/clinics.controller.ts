import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto, UpdateClinicDto, ClinicQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Clinics')
@ApiBearerAuth()
@Controller('clinics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /**
   * POST /clinics
   * Create a new clinic
   */
  @Post()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
  )
  @ApiOperation({ summary: 'Create a new clinic' })
  @ApiResponse({ status: 201, description: 'Clinic created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Clinic already exists' })
  async create(@Body() createClinicDto: CreateClinicDto) {
    return this.clinicsService.create(createClinicDto);
  }

  /**
   * GET /clinics
   * Get all clinics with filters
   */
  @Get()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get all clinics with filters' })
  @ApiResponse({ status: 200, description: 'List of clinics' })
  async findAll(@Query() query: ClinicQueryDto) {
    return this.clinicsService.findAll(query);
  }

  /**
   * GET /clinics/available
   * Get available clinics for today (for OPD registration)
   */
  @Get('available')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get available clinics for today' })
  @ApiQuery({ name: 'hospitalId', required: true })
  @ApiQuery({ name: 'departmentId', required: false })
  @ApiResponse({ status: 200, description: 'List of available clinics' })
  async findAvailable(
    @Query('hospitalId') hospitalId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.clinicsService.findAvailable(hospitalId, departmentId);
  }

  /**
   * GET /clinics/doctor/:doctorId
   * Get clinics by doctor
   */
  @Get('doctor/:doctorId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get clinics by doctor' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID' })
  @ApiResponse({ status: 200, description: 'List of doctor clinics' })
  async findByDoctor(@Param('doctorId') doctorId: string) {
    return this.clinicsService.findByDoctor(doctorId);
  }

  /**
   * GET /clinics/department/:departmentId
   * Get clinics by department
   */
  @Get('department/:departmentId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get clinics by department' })
  @ApiParam({ name: 'departmentId', description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'List of department clinics' })
  async findByDepartment(@Param('departmentId') departmentId: string) {
    return this.clinicsService.findByDepartment(departmentId);
  }

  /**
   * GET /clinics/:id
   * Get a single clinic by ID
   */
  @Get(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get clinic details' })
  @ApiParam({ name: 'id', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Clinic details' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async findOne(@Param('id') id: string) {
    return this.clinicsService.findOne(id);
  }

  /**
   * GET /clinics/:id/stats
   * Get today's statistics for a clinic
   */
  @Get(':id/stats')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
  )
  @ApiOperation({ summary: 'Get clinic statistics for today' })
  @ApiParam({ name: 'id', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Clinic statistics' })
  async getStats(@Param('id') id: string) {
    return this.clinicsService.getClinicStats(id);
  }

  /**
   * GET /clinics/doctors/hospital/:hospitalId
   * Get doctors for a hospital (for clinic creation dropdown)
   */
  @Get('doctors/hospital/:hospitalId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
  )
  @ApiOperation({ summary: 'Get doctors for hospital' })
  @ApiParam({ name: 'hospitalId', description: 'Hospital ID' })
  @ApiResponse({ status: 200, description: 'List of doctors' })
  async getDoctors(@Param('hospitalId') hospitalId: string) {
    return this.clinicsService.getDoctors(hospitalId);
  }

  /**
   * PUT /clinics/:id
   * Update a clinic
   */
  @Put(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
  )
  @ApiOperation({ summary: 'Update clinic' })
  @ApiParam({ name: 'id', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Clinic updated successfully' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async update(
    @Param('id') id: string,
    @Body() updateClinicDto: UpdateClinicDto,
  ) {
    return this.clinicsService.update(id, updateClinicDto);
  }

  /**
   * DELETE /clinics/:id
   * Delete a clinic
   */
  @Delete(':id')
  @Roles(UserRole.MASTER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete clinic' })
  @ApiParam({ name: 'id', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Clinic deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete clinic with visits' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async remove(@Param('id') id: string) {
    return this.clinicsService.remove(id);
  }
}
