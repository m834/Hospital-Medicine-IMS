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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';
import { ExpenditureService } from './expenditure.service';
import { CreateExpenditureDto, UpdateExpenditureDto, ExpenditureFilterDto } from './dto/expenditure.dto';

@ApiTags('Expenditure')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('expenditure')
export class ExpenditureController {
  constructor(private readonly expenditureService: ExpenditureService) {}

  @ApiOperation({ summary: 'Create a new expenditure record' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentHospital() hospitalId: string,
    @Req() req: any,
    @Body() dto: CreateExpenditureDto,
  ) {
    return this.expenditureService.create(hospitalId, req.user.id, dto);
  }

  @ApiOperation({ summary: 'List all expenditure records with optional filters' })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @CurrentHospital() hospitalId: string,
    @Query() filter: ExpenditureFilterDto,
  ) {
    return this.expenditureService.findAll(hospitalId, filter);
  }

  @ApiOperation({ summary: 'Get day/month/year totals for a specific date' })
  @Get('totals')
  @HttpCode(HttpStatus.OK)
  getTotals(
    @CurrentHospital() hospitalId: string,
    @Query('date') date?: string,
  ) {
    return this.expenditureService.getTotalsByPeriod(hospitalId, date);
  }

  @ApiOperation({ summary: 'Get a single expenditure record' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
  ) {
    return this.expenditureService.findOne(id, hospitalId);
  }

  @ApiOperation({ summary: 'Update an expenditure record' })
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenditureDto,
  ) {
    return this.expenditureService.update(id, hospitalId, dto);
  }

  @ApiOperation({ summary: 'Delete an expenditure record' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentHospital() hospitalId: string,
    @Param('id') id: string,
  ) {
    return this.expenditureService.remove(id, hospitalId);
  }
}
