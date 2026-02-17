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
import { LabTestsService } from './lab-tests.service';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LabTestStatus } from '@prisma/client';

@Controller('lab-tests')
@UseGuards(JwtAuthGuard)
export class LabTestsController {
  constructor(private readonly labTestsService: LabTestsService) {}

  @Post()
  create(@Body() createLabTestDto: CreateLabTestDto) {
    return this.labTestsService.create(createLabTestDto);
  }

  @Get()
  findAll(
    @Query('hospitalId') hospitalId: string,
    @Query('departmentId') departmentId?: string,
    @Query('subDepartmentId') subDepartmentId?: string,
    @Query('testCategory') testCategory?: string,
    @Query('status') status?: LabTestStatus,
  ) {
    return this.labTestsService.findAll(hospitalId, {
      departmentId,
      subDepartmentId,
      testCategory,
      status,
    });
  }

  @Get('categories')
  getCategories(@Query('hospitalId') hospitalId: string) {
    return this.labTestsService.getCategories(hospitalId);
  }

  @Get('department/:departmentId')
  findByDepartment(@Param('departmentId') departmentId: string) {
    return this.labTestsService.findByDepartment(departmentId);
  }

  @Get('category/:hospitalId/:category')
  findByCategory(
    @Param('hospitalId') hospitalId: string,
    @Param('category') category: string,
  ) {
    return this.labTestsService.findByCategory(hospitalId, category);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.labTestsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLabTestDto: UpdateLabTestDto) {
    return this.labTestsService.update(id, updateLabTestDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: LabTestStatus,
  ) {
    return this.labTestsService.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.labTestsService.remove(id);
  }
}
