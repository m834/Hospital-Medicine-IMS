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
import { VisitsService } from './visits.service';
import { CreateVisitDto, UpdateVisitDto, VisitQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole, PaymentMethod } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Visits')
@ApiBearerAuth()
@Controller('visits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  /**
   * POST /visits
    * Create a new visit
   */
  @Post()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Create a new visit' })
  @ApiResponse({ status: 201, description: 'Visit created' })
  async create(@Body() createVisitDto: CreateVisitDto) {
    return this.visitsService.create(createVisitDto);
  }

  /**
   * GET /visits
   * Get all visits with filters
   */
  @Get()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get all visits with filters' })
  @ApiResponse({ status: 200, description: 'List of visits' })
  async findAll(@Query() query: VisitQueryDto) {
    return this.visitsService.findAll(query);
  }

  /**
   * GET /visits/today
   * Get today's visits
   */
  @Get('today')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get today visits' })
  async findToday(@Query('clinicId') clinicId: string) {
    return this.visitsService.findTodayByClinic(clinicId);
  }

  /**
   * GET /visits/patient/:patientId
   * Get patient visit history
   */
  @Get('patient/:patientId')
  @Roles(
    UserRole.MASTER_ADMIN,
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
    return this.visitsService.findByPatient(patientId, limit);
  }

  /**
   * GET /visits/clinic/:clinicId
   * Get clinic queue (today's visits)
   */
  @Get('clinic/:clinicId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get clinic queue for today' })
  @ApiParam({ name: 'clinicId', description: 'Clinic ID' })
  async findByClinic(@Param('clinicId') clinicId: string) {
    return this.visitsService.findTodayByClinic(clinicId);
  }

  /**
   * GET /visits/:id
   * Get visit details
   */
  @Get(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get visit details' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }

  /**
   * PUT /visits/:id
   * Update visit (consultation)
   */
  @Put(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Update visit consultation details' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async update(
    @Param('id') id: string,
    @Body() updateVisitDto: UpdateVisitDto,
    @Request() req: any,
  ) {
    return this.visitsService.update(id, updateVisitDto, req.user.id);
  }

  /**
   * POST /visits/:id/start
   * Start consultation
   */
  @Post(':id/start')
  @Roles(UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start consultation for a visit' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async startConsultation(@Param('id') id: string, @Request() req: any) {
    return this.visitsService.startConsultation(id, req.user.id);
  }

  /**
   * POST /visits/:id/complete
   * Mark visit as complete
   */
  @Post(':id/complete')
  @Roles(UserRole.MASTER_ADMIN, UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark visit as complete' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async complete(@Param('id') id: string) {
    return this.visitsService.complete(id);
  }

  /**
   * POST /visits/call-next/:clinicId
   * Call next patient in queue
   */
  @Post('call-next/:clinicId')
  @Roles(UserRole.MASTER_ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Call next patient in queue' })
  @ApiParam({ name: 'clinicId', description: 'Clinic ID' })
  async callNext(@Param('clinicId') clinicId: string) {
    return this.visitsService.callNext(clinicId);
  }

  /**
   * POST /visits/:id/receipt
   * Generate receipt for visit
   */
  @Post(':id/receipt')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate receipt for visit' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async generateReceipt(@Param('id') id: string, @Request() req: any) {
    return this.visitsService.generateReceipt(id, req.user.id);
  }

  /**
   * POST /visits/:id/pay
   * Mark visit as paid
   */
  @Post(':id/pay')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark visit as paid' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async markAsPaid(
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod?: PaymentMethod,
  ) {
    return this.visitsService.markAsPaid(id, paymentMethod);
  }

  /**
   * DELETE /visits/:id
   * Cancel a visit
   */
  @Delete(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a visit' })
  @ApiParam({ name: 'id', description: 'Visit ID' })
  async cancel(@Param('id') id: string) {
    return this.visitsService.cancel(id);
  }
}
