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

@Controller('lab-orders')
@UseGuards(JwtAuthGuard)
export class LabOrdersController {
  constructor(
    private readonly labOrdersService: LabOrdersService,
    private readonly labResultPdfService: LabResultPdfService,
  ) {}

  @Post()
  create(@Body() createLabOrderDto: CreateLabOrderDto) {
    return this.labOrdersService.create(createLabOrderDto);
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
   * Claim the one print a slip is allowed. Returns 403 when the slip has been
   * printed already and the caller is not a manager or an admin, so the client
   * must call this before it opens the print dialog.
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
