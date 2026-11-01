import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  PayloadTooLargeException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClientErrorsService } from './client-errors.service';
import { CreateClientErrorDto } from './dto/create-client-error.dto';
import { ClientErrorQueryDto } from './dto/client-error-query.dto';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

/** The largest report accepted, in bytes. Fields are also cut individually. */
const MAX_REPORT_BYTES = 32 * 1024;

@Controller('client-errors')
export class ClientErrorsController {
  constructor(private readonly clientErrorsService: ClientErrorsService) {}

  /**
   * Browsers report their errors here. Open to signed-out browsers too (an
   * error on the login screen still counts), so it is rate-limited per address
   * and size-capped, and it answers with nothing a caller could use.
   */
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async report(@Body() dto: CreateClientErrorDto, @Req() req: any) {
    const size = Number(req.headers?.['content-length'] ?? 0);
    if (size > MAX_REPORT_BYTES) {
      throw new PayloadTooLargeException('Error report is too large');
    }

    const forwarded = String(req.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
    await this.clientErrorsService.record(dto, {
      userId: req.user?.id ?? null,
      hospitalId: req.user?.hospitalId ?? null,
      ipAddress: forwarded || req.ip || null,
    });
  }

  /** The stored reports, newest first. Super Admin only. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  findAll(@Query() query: ClientErrorQueryDto) {
    return this.clientErrorsService.findAll(query);
  }
}
