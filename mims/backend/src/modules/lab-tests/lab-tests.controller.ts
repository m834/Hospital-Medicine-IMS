import {
  BadRequestException,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LabTestStatus } from '@prisma/client';

/**
 * The hospital a request operates on.
 *
 * Only a SUPER_ADMIN (who belongs to no hospital) may name a hospital via the
 * request; every other user is pinned to their own. Trusting the caller-supplied
 * id for ordinary users let a stale hospital selection in the browser both hide
 * a hospital's own tests and file newly created ones under a different hospital.
 */
function resolveHospitalId(user: any, requested?: string): string {
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' && !user?.hospitalId;
  const hospitalId = isSuperAdmin ? requested : user?.hospitalId;

  if (!hospitalId) {
    throw new BadRequestException('Hospital ID is required');
  }

  return hospitalId;
}

@Controller('lab-tests')
@UseGuards(JwtAuthGuard)
export class LabTestsController {
  constructor(private readonly labTestsService: LabTestsService) {}

  @Post()
  create(@Body() createLabTestDto: CreateLabTestDto, @CurrentUser() user: any) {
    return this.labTestsService.create({
      ...createLabTestDto,
      hospitalId: resolveHospitalId(user, createLabTestDto.hospitalId),
    });
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query('hospitalId') hospitalId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('subDepartmentId') subDepartmentId?: string,
    @Query('testCategory') testCategory?: string,
    @Query('status') status?: LabTestStatus,
  ) {
    return this.labTestsService.findAll(resolveHospitalId(user, hospitalId), {
      departmentId,
      subDepartmentId,
      testCategory,
      status,
    });
  }

  @Get('categories')
  getCategories(@CurrentUser() user: any, @Query('hospitalId') hospitalId?: string) {
    return this.labTestsService.getCategories(resolveHospitalId(user, hospitalId));
  }

  @Get('department/:departmentId')
  findByDepartment(@Param('departmentId') departmentId: string) {
    return this.labTestsService.findByDepartment(departmentId);
  }

  @Get('category/:hospitalId/:category')
  findByCategory(
    @Param('hospitalId') hospitalId: string,
    @Param('category') category: string,
    @CurrentUser() user: any,
  ) {
    return this.labTestsService.findByCategory(
      resolveHospitalId(user, hospitalId),
      category,
    );
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
