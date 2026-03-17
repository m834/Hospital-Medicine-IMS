import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OperationsService } from './operations.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationQueryDto } from './dto/operation-query.dto';
import { UpdateOperationStatusDto } from './dto/update-operation-status.dto';
import { RescheduleOperationDto } from './dto/reschedule-operation.dto';
import { CreateOperationTheatreDto } from './dto/create-theatre.dto';
import { UpdateOperationTheatreDto } from './dto/update-theatre.dto';
import { OperationTheatreQueryDto } from './dto/theatre-query.dto';
import { OperationTheatreAvailabilityQueryDto } from './dto/theatre-availability-query.dto';

@ApiTags('Operations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly operationsService: OperationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new operation' })
  @ApiResponse({ status: 201, description: 'Operation created successfully' })
  create(@Body() createOperationDto: CreateOperationDto, @Request() req: any) {
    return this.operationsService.create(createOperationDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get operations with filters' })
  @ApiResponse({ status: 200, description: 'Operations retrieved successfully' })
  findAll(@Query() query: OperationQueryDto) {
    return this.operationsService.findAll(query);
  }

  @Get('theatres/availability')
  @ApiOperation({ summary: 'Get theatre availability for a date' })
  @ApiResponse({ status: 200, description: 'Theatre availability retrieved successfully' })
  getTheatreAvailability(@Query() query: OperationTheatreAvailabilityQueryDto) {
    return this.operationsService.getTheatreAvailability(query);
  }

  @Post('theatres')
  @ApiOperation({ summary: 'Create an operation theatre' })
  @ApiResponse({ status: 201, description: 'Operation theatre created successfully' })
  createTheatre(@Body() createDto: CreateOperationTheatreDto) {
    return this.operationsService.createTheatre(createDto);
  }

  @Get('theatres')
  @ApiOperation({ summary: 'Get operation theatres with filters' })
  @ApiResponse({ status: 200, description: 'Operation theatres retrieved successfully' })
  findTheatres(@Query() query: OperationTheatreQueryDto) {
    return this.operationsService.findTheatres(query);
  }

  @Get('theatres/:id')
  @ApiOperation({ summary: 'Get operation theatre by ID' })
  @ApiResponse({ status: 200, description: 'Operation theatre retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Operation theatre not found' })
  findTheatre(@Param('id') id: string) {
    return this.operationsService.findTheatre(id);
  }

  @Patch('theatres/:id')
  @ApiOperation({ summary: 'Update operation theatre' })
  @ApiResponse({ status: 200, description: 'Operation theatre updated successfully' })
  @ApiResponse({ status: 404, description: 'Operation theatre not found' })
  updateTheatre(
    @Param('id') id: string,
    @Body() updateDto: UpdateOperationTheatreDto,
  ) {
    return this.operationsService.updateTheatre(id, updateDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get operation by ID' })
  @ApiResponse({ status: 200, description: 'Operation retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Operation not found' })
  findOne(@Param('id') id: string) {
    return this.operationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update operation details' })
  @ApiResponse({ status: 200, description: 'Operation updated successfully' })
  @ApiResponse({ status: 404, description: 'Operation not found' })
  update(@Param('id') id: string, @Body() updateDto: UpdateOperationDto) {
    return this.operationsService.update(id, updateDto);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Update operation status' })
  @ApiResponse({ status: 200, description: 'Operation status updated successfully' })
  @ApiResponse({ status: 404, description: 'Operation not found' })
  updateStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateOperationStatusDto,
  ) {
    return this.operationsService.updateStatus(id, statusDto);
  }

  @Post(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule an operation' })
  @ApiResponse({ status: 200, description: 'Operation rescheduled successfully' })
  @ApiResponse({ status: 404, description: 'Operation not found' })
  reschedule(
    @Param('id') id: string,
    @Body() rescheduleDto: RescheduleOperationDto,
  ) {
    return this.operationsService.reschedule(id, rescheduleDto);
  }
}
