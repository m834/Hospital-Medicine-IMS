import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TokensService } from './tokens.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Tokens')
@ApiBearerAuth()
@Controller('tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  /**
   * GET /tokens/clinic/:clinicId/today
   * Get today's tokens for a clinic
   */
  @Get('clinic/:clinicId/today')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get today tokens for a clinic' })
  @ApiParam({ name: 'clinicId', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Today tokens with stats' })
  async findTodayByClinic(@Param('clinicId') clinicId: string) {
    return this.tokensService.findTodayByClinic(clinicId);
  }

  /**
   * GET /tokens/clinic/:clinicId/current
   * Get current token for a clinic
   */
  @Get('clinic/:clinicId/current')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get current token for a clinic' })
  @ApiParam({ name: 'clinicId', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Current token or null' })
  async getCurrentToken(@Param('clinicId') clinicId: string) {
    return this.tokensService.getCurrentToken(clinicId);
  }

  /**
   * GET /tokens/clinic/:clinicId/waiting
   * Get waiting tokens for a clinic
   */
  @Get('clinic/:clinicId/waiting')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get waiting tokens for a clinic' })
  @ApiParam({ name: 'clinicId', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'List of waiting tokens' })
  async getWaitingTokens(@Param('clinicId') clinicId: string) {
    return this.tokensService.getWaitingTokens(clinicId);
  }

  /**
   * GET /tokens/clinic/:clinicId/display
   * Get display data for token display screens
   */
  @Get('clinic/:clinicId/display')
  @ApiOperation({ summary: 'Get display data for token screens' })
  @ApiParam({ name: 'clinicId', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Display data with current and upcoming tokens' })
  async getDisplayData(@Param('clinicId') clinicId: string) {
    return this.tokensService.getDisplayData(clinicId);
  }

  /**
   * POST /tokens/:id/call
   * Call a specific token
   */
  @Post(':id/call')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.DOCTOR,
    UserRole.RECEPTIONIST,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Call a specific token' })
  @ApiParam({ name: 'id', description: 'Token ID' })
  @ApiResponse({ status: 200, description: 'Token called successfully' })
  async callToken(@Param('id') id: string) {
    return this.tokensService.callToken(id);
  }

  /**
   * GET /tokens/clinic/:clinicId/next-number
   * Get next token number for a clinic
   */
  @Get('clinic/:clinicId/next-number')
  @Roles(
    UserRole.MASTER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.RECEPTIONIST,
    UserRole.REGISTRATION_STAFF,
  )
  @ApiOperation({ summary: 'Get next token number for a clinic' })
  @ApiParam({ name: 'clinicId', description: 'Clinic ID' })
  @ApiResponse({ status: 200, description: 'Next token number' })
  async getNextTokenNumber(@Param('clinicId') clinicId: string) {
    const nextNumber = await this.tokensService.getNextTokenNumber(clinicId);
    return { nextTokenNumber: nextNumber };
  }
}
