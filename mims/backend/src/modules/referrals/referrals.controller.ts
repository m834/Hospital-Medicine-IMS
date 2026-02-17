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
import { ReferralsService } from './referrals.service';
import { CreateReferralDto, UpdateReferralDto, ReferralQueryDto } from './dto';
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

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  /**
   * POST /referrals
   * Create a new referral
   */
  @Post()
  @Roles(UserRole.MASTER_ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Create a new referral' })
  @ApiResponse({ status: 201, description: 'Referral created successfully' })
  async create(@Body() createReferralDto: CreateReferralDto) {
    return this.referralsService.create(createReferralDto);
  }

  /**
   * GET /referrals
   * Get all referrals with filters
   */
  @Get()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get all referrals with filters' })
  @ApiResponse({ status: 200, description: 'List of referrals' })
  async findAll(@Query() query: ReferralQueryDto) {
    return this.referralsService.findAll(query);
  }

  /**
   * GET /referrals/department/:departmentId/pending
   * Get pending referrals for a department
   */
  @Get('department/:departmentId/pending')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
  )
  @ApiOperation({ summary: 'Get pending referrals for a department' })
  @ApiParam({ name: 'departmentId', description: 'Department ID' })
  async findPendingByDepartment(@Param('departmentId') departmentId: string) {
    return this.referralsService.findPendingByDepartment(departmentId);
  }

  /**
   * GET /referrals/referrer/:referrerId
   * Get referrals made by a doctor
   */
  @Get('referrer/:referrerId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get referrals made by a doctor' })
  @ApiParam({ name: 'referrerId', description: 'Referrer (Doctor) ID' })
  async findByReferrer(@Param('referrerId') referrerId: string) {
    return this.referralsService.findByReferrer(referrerId);
  }

  /**
   * GET /referrals/stats
   * Get referral statistics
   */
  @Get('stats')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
  )
  @ApiOperation({ summary: 'Get referral statistics' })
  async getStats(
    @Query('hospitalId') hospitalId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.referralsService.getStats(hospitalId, departmentId);
  }

  /**
   * GET /referrals/:id
   * Get referral details
   */
  @Get(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get referral details' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  async findOne(@Param('id') id: string) {
    return this.referralsService.findOne(id);
  }

  /**
   * PUT /referrals/:id
   * Update a referral
   */
  @Put(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
  )
  @ApiOperation({ summary: 'Update a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  async update(
    @Param('id') id: string,
    @Body() updateReferralDto: UpdateReferralDto,
  ) {
    return this.referralsService.update(id, updateReferralDto);
  }

  /**
   * POST /referrals/:id/accept
   * Accept a referral
   */
  @Post(':id/accept')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  async accept(@Param('id') id: string) {
    return this.referralsService.accept(id);
  }

  /**
   * POST /referrals/:id/start
   * Start working on a referral
   */
  @Post(':id/start')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start working on a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  async startWork(@Param('id') id: string) {
    return this.referralsService.startWork(id);
  }

  /**
   * POST /referrals/:id/complete
   * Complete a referral
   */
  @Post(':id/complete')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.DOCTOR,
    UserRole.LAB_TECHNICIAN,
    UserRole.RADIOLOGIST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  async complete(@Param('id') id: string, @Body('notes') notes?: string) {
    return this.referralsService.complete(id, notes);
  }

  /**
   * DELETE /referrals/:id
   * Cancel a referral
   */
  @Delete(':id')
  @Roles(UserRole.MASTER_ADMIN, UserRole.DOCTOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a referral' })
  @ApiParam({ name: 'id', description: 'Referral ID' })
  async cancel(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.referralsService.cancel(id, reason);
  }
}
