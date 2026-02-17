import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto, ReceiptQueryDto, UpdateReceiptPaymentDto } from './dto';
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
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Receipts')
@ApiBearerAuth()
@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /**
   * POST /receipts
   * Generate a new receipt
   */
  @Post()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.PHARMACY_STAFF,
  )
  @ApiOperation({ summary: 'Generate a new receipt' })
  @ApiResponse({ status: 201, description: 'Receipt created successfully' })
  async create(@Body() createReceiptDto: CreateReceiptDto) {
    return this.receiptsService.create(createReceiptDto);
  }

  /**
   * GET /receipts
   * Get all receipts with filters
   */
  @Get()
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.BILLING_STAFF,
    UserRole.RECEPTIONIST,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: 'Get all receipts with filters' })
  @ApiResponse({ status: 200, description: 'List of receipts' })
  async findAll(@Query() query: ReceiptQueryDto) {
    return this.receiptsService.findAll(query);
  }

  /**
   * GET /receipts/daily-revenue
   * Get daily revenue summary
   */
  @Get('daily-revenue')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.BILLING_STAFF,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: 'Get daily revenue summary' })
  @ApiQuery({ name: 'hospitalId', required: true })
  @ApiQuery({ name: 'date', required: false })
  async getDailyRevenue(
    @Query('hospitalId') hospitalId: string,
    @Query('date') date?: string,
  ) {
    return this.receiptsService.getDailyRevenue(
      hospitalId,
      date ? new Date(date) : undefined,
    );
  }

  /**
   * GET /receipts/patient/:patientId
   * Get receipts by patient
   */
  @Get('patient/:patientId')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get receipts by patient' })
  @ApiParam({ name: 'patientId', description: 'Patient ID' })
  async findByPatient(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: number,
  ) {
    return this.receiptsService.findByPatient(patientId, limit);
  }

  /**
   * GET /receipts/number/:receiptNumber
   * Get receipt by number
   */
  @Get('number/:receiptNumber')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: 'Get receipt by number' })
  @ApiParam({ name: 'receiptNumber', description: 'Receipt Number' })
  async findByReceiptNumber(@Param('receiptNumber') receiptNumber: string) {
    return this.receiptsService.findByReceiptNumber(receiptNumber);
  }

  /**
   * GET /receipts/:id
   * Get receipt details
   */
  @Get(':id')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.AUDITOR,
  )
  @ApiOperation({ summary: 'Get receipt details' })
  @ApiParam({ name: 'id', description: 'Receipt ID' })
  async findOne(@Param('id') id: string) {
    return this.receiptsService.findOne(id);
  }

  /**
   * GET /receipts/:id/print
   * Get receipt data for printing
   */
  @Get(':id/print')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
  )
  @ApiOperation({ summary: 'Get receipt data for printing' })
  @ApiParam({ name: 'id', description: 'Receipt ID' })
  async getPrintData(@Param('id') id: string) {
    return this.receiptsService.getPrintData(id);
  }

  /**
   * POST /receipts/:id/pay
   * Mark receipt as paid
   */
  @Post(':id/pay')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark receipt as paid' })
  @ApiParam({ name: 'id', description: 'Receipt ID' })
  async markAsPaid(
    @Param('id') id: string,
    @Body('paymentMethod') paymentMethod?: PaymentMethod,
  ) {
    return this.receiptsService.markAsPaid(id, paymentMethod);
  }

  /**
   * PATCH /receipts/:id/payment
   * Update receipt payment (partial/full)
   */
  @Post(':id/payment')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DEPARTMENT_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.BILLING_STAFF,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update receipt payment (partial/full)' })
  @ApiParam({ name: 'id', description: 'Receipt ID' })
  async updatePayment(
    @Param('id') id: string,
    @Body() body: UpdateReceiptPaymentDto,
  ) {
    return this.receiptsService.updatePayment(id, body.paidAmount, body.paymentMethod);
  }

  /**
   * POST /receipts/:id/refund
   * Refund a receipt
   */
  @Post(':id/refund')
  @Roles(UserRole.MASTER_ADMIN, UserRole.HOSPITAL_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund a receipt' })
  @ApiParam({ name: 'id', description: 'Receipt ID' })
  async refund(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.receiptsService.refund(id, reason);
  }
}
