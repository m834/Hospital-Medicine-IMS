import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferRequestDto } from './dto/create-transfer-request.dto';
import { SearchTransferRequestDto } from './dto/search-transfer-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  async create(@Body() createDto: CreateTransferRequestDto, @Request() req) {
    // Get hospitalId from pharmacy if not available from user
    let hospitalId = req.user.hospitalId;
    
    if (!hospitalId) {
      // For Super Admin, get hospitalId from the pharmacy
      const pharmacy = await this.transfersService['prisma'].pharmacy.findUnique({
        where: { id: createDto.fromPharmacyId },
        select: { hospitalId: true },
      });
      hospitalId = pharmacy?.hospitalId;
    }

    if (!hospitalId) {
      throw new Error('Hospital ID not found');
    }

    return this.transfersService.create(createDto, hospitalId);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  async findAll(@Query() searchDto: SearchTransferRequestDto, @Request() req) {
    let hospitalId = req.user.hospitalId;

    // For Super Admin, get hospitalId from pharmacy filter if available
    if (!hospitalId && (searchDto.fromPharmacyId || searchDto.toPharmacyId)) {
      const pharmacyId = searchDto.fromPharmacyId || searchDto.toPharmacyId;
      const pharmacy = await this.transfersService['prisma'].pharmacy.findUnique({
        where: { id: pharmacyId },
        select: { hospitalId: true },
      });
      hospitalId = pharmacy?.hospitalId;
    }

    return this.transfersService.findAll(searchDto, hospitalId);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  async findOne(@Param('id') id: string, @Request() req) {
    let hospitalId = req.user.hospitalId;

    // For Super Admin without hospitalId, get it from the transfer request
    if (!hospitalId) {
      const transfer = await this.transfersService['prisma'].transferRequest.findUnique({
        where: { id },
        select: { hospitalId: true },
      });
      hospitalId = transfer?.hospitalId;
    }

    return this.transfersService.findOne(id, hospitalId);
  }

  @Post(':id/approve')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
  )
  async approve(
    @Param('id') id: string,
    @Body() approvalData: { items: Array<{ id: string; qtyApproved: number }>; approvedBy: string },
    @Request() req,
  ) {
    return this.transfersService.approve(id, approvalData, req.user.id);
  }

  @Post(':id/reject')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
  )
  async reject(
    @Param('id') id: string,
    @Body() rejectionData: { rejectionReason: string; rejectedBy: string },
    @Request() req,
  ) {
    return this.transfersService.reject(id, rejectionData, req.user.id);
  }

  @Post(':id/dispatch')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.MAIN_PHARMACY_MANAGER,
  )
  async dispatch(
    @Param('id') id: string,
    @Body() dispatchData: {
      items: Array<{
        itemId: string;
        batches: Array<{ batchId: string; quantity: number }>;
      }>;
      dispatchedBy: string;
    },
    @Request() req,
  ) {
    return this.transfersService.dispatch(id, dispatchData, req.user.id);
  }

  @Post(':id/receive')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SUB_PHARMACY_MANAGER,
  )
  async receive(
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.transfersService.receive(id, req.user.id);
  }
}
