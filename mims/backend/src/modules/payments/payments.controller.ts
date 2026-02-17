import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('patient/:patientId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.DOCTOR,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get consolidated payment summary for a patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  @ApiResponse({ status: 200, description: 'Patient payment summary' })
  async getPatientSummary(@Param('patientId') patientId: string) {
    return this.paymentsService.getPatientSummary(patientId);
  }

  @Get('visit/:visitId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.DOCTOR,
    UserRole.NURSE,
  )
  @ApiOperation({ summary: 'Get consolidated payment summary for a visit' })
  @ApiParam({ name: 'visitId', description: 'Visit ID' })
  @ApiResponse({ status: 200, description: 'Visit payment summary' })
  async getVisitSummary(@Param('visitId') visitId: string) {
    return this.paymentsService.getVisitSummary(visitId);
  }
}
