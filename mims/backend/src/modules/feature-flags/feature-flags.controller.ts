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
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  create(@Body() createFeatureFlagDto: CreateFeatureFlagDto) {
    return this.featureFlagsService.create(createFeatureFlagDto);
  }

  @Get()
  findAll(@Query('hospitalId') hospitalId?: string) {
    return this.featureFlagsService.findAll(hospitalId);
  }

  @Get('check/:key')
  async checkFlag(@Param('key') key: string, @Query('hospitalId') hospitalId?: string) {
    const enabled = await this.featureFlagsService.isEnabled(key, hospitalId);
    return { key, enabled };
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  findOne(@Param('id') id: string) {
    return this.featureFlagsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  update(@Param('id') id: string, @Body() updateFeatureFlagDto: UpdateFeatureFlagDto) {
    return this.featureFlagsService.update(id, updateFeatureFlagDto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  remove(@Param('id') id: string) {
    return this.featureFlagsService.remove(id);
  }
}
