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
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PatientVisitsService } from './patient-visits.service';
import { CreateVisitDto, UpdateVisitDto, VisitQueryDto } from './dto';
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
} from '@nestjs/swagger';

@ApiTags('Patient Visits')
@ApiBearerAuth()
@Controller('patient-visits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientVisitsController {
  constructor(private readonly patientVisitsService: PatientVisitsService) {}

  /**
   * POST /patient-visits
   * Create a new visit
   */
  @Post()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Create a new patient visit' })
  @ApiResponse({ status: 201, description: 'Patient visit created' })
  async create(@Body() createVisitDto: CreateVisitDto) {
    return this.patientVisitsService.create(createVisitDto);
  }

  /**
   * GET /patient-visits
   * List visits with filters
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
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'List patient visits with filters' })
  @ApiResponse({ status: 200, description: 'List of visits' })
  async findAll(@Query() query: VisitQueryDto) {
    return this.patientVisitsService.findAll(query);
  }

  /**
   * GET /patient-visits/patient/:patientId
   * Get patient visit history
   */
  @Get('patient/:patientId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get patient visit history' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  async findByPatient(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: number,
  ) {
    return this.patientVisitsService.findByPatient(patientId, limit);
  }

  /**
   * GET /patient-visits/:id
   * Get visit details
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
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get patient visit details' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async findOne(@Param('id') id: string) {
    return this.patientVisitsService.findOne(id);
  }

  /**
   * PUT /patient-visits/:id
   * Update visit (consultation)
   */
  @Put(':id')
  @Roles(UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.NURSE)
  @ApiOperation({ summary: 'Update visit consultation details' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async update(
    @Param('id') id: string,
    @Body() updateVisitDto: UpdateVisitDto,
    @Request() req: any,
  ) {
    return this.patientVisitsService.update(id, updateVisitDto, req.user.id);
  }

  /**
   * DELETE /patient-visits/:id
   * Cancel a visit
   */
  @Delete(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a patient visit' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async cancel(@Param('id') id: string) {
    return this.patientVisitsService.cancel(id);
  }
}
