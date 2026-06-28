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
  Request,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto';
import { BulkCreateStockBatchDto } from './dto/create-stock-batch-bulk.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';
import { SearchStockBatchDto } from './dto/search-stock-batch.dto';
import { DispenseBatchDto } from './dto/dispense-batch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('batches')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  async create(@Body() createStockBatchDto: CreateStockBatchDto, @Request() req) {
    // For Super Admin, get hospitalId from the pharmacy
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && createStockBatchDto.pharmacyId) {
      const pharmacy = await this.inventoryService.getPharmacyHospital(
        createStockBatchDto.pharmacyId,
      );
      hospitalId = pharmacy.hospitalId;
    }
    return this.inventoryService.create(createStockBatchDto, hospitalId);
  }

  @Post('batches/bulk')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
  )
  async bulkCreate(@Body() bulkDto: BulkCreateStockBatchDto, @Request() req) {
    const hospitalId = req.user.hospitalId || bulkDto.hospitalId;
    return this.inventoryService.bulkCreate(bulkDto.batches, hospitalId);
  }

  @Get('batches')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
  )
  async findAll(@Query() searchDto: SearchStockBatchDto, @Request() req) {
    // For Super Admin, get hospitalId from pharmacy if available
    let hospitalId = req.user.hospitalId;
    if (!hospitalId && searchDto.pharmacyId) {
      const pharmacy = await this.inventoryService.getPharmacyHospital(searchDto.pharmacyId);
      hospitalId = pharmacy.hospitalId;
    }
    return this.inventoryService.findAll(searchDto, hospitalId);
  }

  @Get('batches/fifo/:medicineId/:pharmacyId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  async getAvailableBatchesFIFO(
    @Param('medicineId') medicineId: string,
    @Param('pharmacyId') pharmacyId: string,
    @Request() req,
  ) {
    let hospitalId = req.user.hospitalId;

    // For Super Admin without hospitalId, get it from the pharmacy
    if (!hospitalId) {
      const pharmacy = await this.inventoryService['prisma'].pharmacy.findUnique({
        where: { id: pharmacyId },
        select: { hospitalId: true },
      });
      hospitalId = pharmacy?.hospitalId;
    }

    return this.inventoryService.getAvailableBatchesFIFO(
      medicineId,
      pharmacyId,
      hospitalId,
    );
  }

  @Get('batches/available/:medicineId/:pharmacyId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  async getAvailableBatches(
    @Param('medicineId') medicineId: string,
    @Param('pharmacyId') pharmacyId: string,
    @Query('category') category: 'NORMAL' | 'LP' | undefined,
    @Request() req,
  ) {
    let hospitalId = req.user.hospitalId;

    // For Super Admin without hospitalId, get it from the pharmacy
    if (!hospitalId) {
      const pharmacy = await this.inventoryService['prisma'].pharmacy.findUnique({
        where: { id: pharmacyId },
        select: { hospitalId: true },
      });
      hospitalId = pharmacy?.hospitalId;
    }

    return this.inventoryService.getAvailableBatchesFIFO(
      medicineId,
      pharmacyId,
      hospitalId,
      category,
    );
  }

  @Get('batches/stock-level/:medicineId/:pharmacyId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.DOCTOR,
  )
  async getTotalAvailableStock(
    @Param('medicineId') medicineId: string,
    @Param('pharmacyId') pharmacyId: string,
    @Request() req,
  ) {
    let hospitalId = req.user.hospitalId;

    // For Super Admin without hospitalId, get it from the pharmacy
    if (!hospitalId) {
      const pharmacy = await this.inventoryService['prisma'].pharmacy.findUnique({
        where: { id: pharmacyId },
        select: { hospitalId: true },
      });
      hospitalId = pharmacy?.hospitalId;
    }

    const stockByCategory = await this.inventoryService.getStockByCategory(
      medicineId,
      pharmacyId,
      hospitalId,
    );
    return { medicineId, pharmacyId, ...stockByCategory };
  }

  @Get('availability/:pharmacyId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
    UserRole.DOCTOR,
    UserRole.DOCTOR_ASSISTANT,
  )
  async getPharmacyAvailability(
    @Param('pharmacyId') pharmacyId: string,
    @Request() req,
  ) {
    let hospitalId = req.user.hospitalId;
    if (!hospitalId) {
      const pharmacy = await this.inventoryService['prisma'].pharmacy.findUnique({
        where: { id: pharmacyId },
        select: { hospitalId: true },
      });
      hospitalId = pharmacy?.hospitalId;
    }
    return this.inventoryService.getPharmacyAvailability(pharmacyId, hospitalId);
  }

  @Get('alerts/low-stock')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  getLowStockAlerts(
    @Query('pharmacyId') pharmacyId: string,
    @Query('threshold') threshold: number,
    @Request() req,
  ) {
    return this.inventoryService.getLowStockAlerts(
      req.user.hospitalId,
      pharmacyId,
      threshold || 10,
    );
  }

  @Get('alerts/expiring')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  getExpiringBatches(@Query('days') days: number, @Request() req) {
    return this.inventoryService.getExpiringBatches(req.user.hospitalId, days || 30);
  }

  @Get('stats')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  async getStats(
    @Query('pharmacyId') pharmacyId: string,
    @Query('hospitalId') queryHospitalId: string,
    @Request() req,
  ) {
    // Use req.user.hospitalId if available, otherwise fall back to query param (Super Admin)
    let hospitalId = req.user.hospitalId || queryHospitalId;
    if (!hospitalId && pharmacyId) {
      const pharmacy = await this.inventoryService.getPharmacyHospital(pharmacyId);
      hospitalId = pharmacy.hospitalId;
    }
    return this.inventoryService.getStats(hospitalId, pharmacyId);
  }

  @Post('batches/dispense')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  async dispenseBatch(@Body() dispenseDto: DispenseBatchDto, @Request() req) {
    let hospitalId = req.user.hospitalId;

    // For Super Admin, get hospitalId from the batch
    if (!hospitalId) {
      const batch = await this.inventoryService['prisma'].stockBatch.findUnique({
        where: { id: dispenseDto.batchId },
        select: { hospitalId: true },
      });
      hospitalId = batch?.hospitalId;
    }

    return this.inventoryService.dispenseBatch(
      dispenseDto.batchId,
      dispenseDto.dispensingQty,
      hospitalId,
    );
  }

  @Get('batches/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
    UserRole.PHARMACY_STAFF,
  )
  findOne(@Param('id') id: string, @Request() req) {
    return this.inventoryService.findOne(id, req.user.hospitalId);
  }

  @Patch('batches/:id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  update(
    @Param('id') id: string,
    @Body() updateStockBatchDto: UpdateStockBatchDto,
    @Request() req,
  ) {
    return this.inventoryService.update(id, updateStockBatchDto, req.user.hospitalId);
  }

  @Delete('batches/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.MAIN_PHARMACY_MANAGER)
  remove(@Param('id') id: string, @Request() req) {
    return this.inventoryService.remove(id, req.user.hospitalId);
  }
}
