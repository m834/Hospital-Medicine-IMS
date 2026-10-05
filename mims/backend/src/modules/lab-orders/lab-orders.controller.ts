import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { LabOrdersService } from './lab-orders.service';
import { LabResultPdfService } from './lab-result-pdf.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderDto } from './dto/update-lab-order.dto';
import { CollectSampleDto } from './dto/collect-sample.dto';
import { EnterResultDto } from './dto/enter-result.dto';
import { ApproveResultDto } from './dto/approve-result.dto';
import { PrintSlipDto } from './dto/print-slip.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LabOrderStatus, TestPriority } from '@prisma/client';
import { isUuid } from '../../common/utils/mrn.util';

@Controller('lab-orders')
@UseGuards(JwtAuthGuard)
export class LabOrdersController {
  constructor(
    private readonly labOrdersService: LabOrdersService,
    private readonly labResultPdfService: LabResultPdfService,
  ) {}

  /**
   * The current user is passed through for `orderedAt`: booking an order on a
   * past date is a manager's call, decided by the token rather than the body.
   */
  @Post()
  create(@Body() createLabOrderDto: CreateLabOrderDto, @CurrentUser() user: any) {
    return this.labOrdersService.create(createLabOrderDto, user);
  }

  /**
   * The current user is passed through because the list is scoped by role:
   * registration staff see only the orders they placed, everyone else sees the
   * hospital's. An orderedById in the query is honoured only for the latter.
   */
  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('hospitalId') hospitalId: string,
    @Query('patientId') patientId?: string,
    @Query('visitId') visitId?: string,
    @Query('status') status?: LabOrderStatus,
    @Query('priority') priority?: TestPriority,
    @Query('orderedById') orderedById?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.labOrdersService.findAll(
      hospitalId,
      {
        patientId,
        visitId,
        status,
        priority,
        orderedById,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
      user,
    );
  }

  @Get('pending')
  getPendingOrders(@Query('hospitalId') hospitalId: string) {
    return this.labOrdersService.getPendingOrders(hospitalId);
  }

  /**
   * Lab revenue for a date range, grouped by category. Registration staff get
   * the same report scoped to their own orders, exactly as the list above is.
   */
  @Get('revenue')
  getRevenueReport(
    @Query('hospitalId') hospitalId: string,
    @CurrentUser() user: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.labOrdersService.getRevenueReport(
      hospitalId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      user,
    );
  }

  @Get('statistics')
  getStatistics(
    @Query('hospitalId') hospitalId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.labOrdersService.getStatistics(
      hospitalId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * May these slips be printed? Read-only — nothing is counted. Returns 403 for
   * a slip already printed when the caller is not a manager or an admin, so the
   * client asks here first and a refusal never reaches the printer.
   *
   * orderIds is a comma-separated list, the same ids print-slip takes.
   */
  @Get('print-slip/check')
  checkSlipPrints(@Query('orderIds') orderIds: string, @CurrentUser() user: any) {
    const ids = String(orderIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      throw new BadRequestException('No lab orders given to print');
    }
    if (ids.length > 100 || ids.some((id) => !isUuid(id))) {
      throw new BadRequestException('orderIds must be up to 100 lab order ids');
    }

    return this.labOrdersService.checkSlipPrints(ids, user);
  }

  /**
   * Count slips as printed, once the browser has actually started the print.
   * Applies the same rules as the check and refuses the same slips.
   */
  @Post('print-slip')
  recordSlipPrints(@Body() printSlipDto: PrintSlipDto, @CurrentUser() user: any) {
    return this.labOrdersService.recordSlipPrints(printSlipDto.orderIds, user);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.labOrdersService.findByPatient(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.labOrdersService.findOne(id);
  }

  @Post(':id/collect-sample')
  collectSample(
    @Param('id') id: string,
    @Body() collectSampleDto: CollectSampleDto,
  ) {
    return this.labOrdersService.collectSample(id, collectSampleDto);
  }

  @Post(':id/enter-result')
  enterResult(
    @Param('id') id: string,
    @Body() enterResultDto: EnterResultDto,
  ) {
    return this.labOrdersService.enterResult(id, enterResultDto);
  }

  @Post(':id/approve-result')
  approveResult(
    @Param('id') id: string,
    @Body() approveResultDto: ApproveResultDto,
  ) {
    return this.labOrdersService.approveResult(id, approveResultDto);
  }

  @Post(':id/cancel')
  cancelOrder(@Param('id') id: string) {
    return this.labOrdersService.cancelOrder(id);
  }

  @Patch(':id/payment')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body('paymentStatus') paymentStatus: string,
    @Body('amountPaid') amountPaid: number,
  ) {
    return this.labOrdersService.updatePaymentStatus(id, paymentStatus, amountPaid);
  }

  @Get(':id/pdf')
  async generatePdf(@Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.labResultPdfService.generateResultPdf(id);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=lab-result-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLabOrderDto: UpdateLabOrderDto) {
    return this.labOrdersService.update(id, updateLabOrderDto);
  }
}
