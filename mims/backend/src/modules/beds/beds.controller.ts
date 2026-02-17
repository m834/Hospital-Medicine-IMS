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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BedsService } from './beds.service';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { BedQueryDto } from './dto/bed-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BedStatus } from '@prisma/client';

@ApiTags('Beds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('beds')
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  @Post()
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Create a new bed' })
  @ApiResponse({ status: 201, description: 'Bed created successfully' })
  @ApiResponse({ status: 409, description: 'Bed number already exists' })
  create(@Body() createBedDto: CreateBedDto) {
    return this.bedsService.create(createBedDto);
  }

  @Get()
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get all beds with filters and pagination' })
  @ApiResponse({ status: 200, description: 'List of beds retrieved successfully' })
  findAll(@Query() query: BedQueryDto) {
    return this.bedsService.findAll(query);
  }

  @Get('available/:hospitalId')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get available beds for a hospital' })
  @ApiResponse({ status: 200, description: 'Available beds retrieved successfully' })
  findAvailable(
    @Param('hospitalId') hospitalId: string,
    @Query('roomId') roomId?: string,
    @Query('bedType') bedType?: string,
  ) {
    return this.bedsService.findAvailable(hospitalId, roomId, bedType);
  }

  @Get(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Get a bed by ID' })
  @ApiResponse({ status: 200, description: 'Bed retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Bed not found' })
  findOne(@Param('id') id: string) {
    return this.bedsService.findOne(id);
  }

  @Patch(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Update a bed' })
  @ApiResponse({ status: 200, description: 'Bed updated successfully' })
  @ApiResponse({ status: 404, description: 'Bed not found' })
  update(@Param('id') id: string, @Body() updateBedDto: UpdateBedDto) {
    return this.bedsService.update(id, updateBedDto);
  }

  @Patch(':id/status')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Update bed status' })
  @ApiResponse({ status: 200, description: 'Bed status updated successfully' })
  updateStatus(@Param('id') id: string, @Body('status') status: BedStatus) {
    return this.bedsService.updateStatus(id, status);
  }

  @Delete(':id')
  // @Roles - TODO: Add proper role checking
  @ApiOperation({ summary: 'Delete a bed' })
  @ApiResponse({ status: 200, description: 'Bed deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bed not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete bed with active admissions',
  })
  remove(@Param('id') id: string) {
    return this.bedsService.remove(id);
  }
}
