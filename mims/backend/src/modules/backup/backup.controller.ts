import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BackupService } from './backup.service';

/**
 * A dump is the entire database in one file — every patient record in the
 * system, unredacted. Restricted to the two roles that administer the whole
 * platform, and the download is audited like a write, because copying the
 * database out is at least as sensitive as changing a row in it.
 */
@ApiTags('Backups')
@ApiBearerAuth('access-token')
@Controller('backups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.MASTER_ADMIN)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  @ApiOperation({ summary: 'Take a full database backup' })
  create(@Request() req: any) {
    return this.backupService.create({
      id: req.user.id,
      fullName: req.user.fullName,
      email: req.user.email,
      role: req.user.role,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List backups, newest first' })
  list() {
    return this.backupService.list();
  }

  @Get(':filename/download')
  @ApiOperation({ summary: 'Download a backup file' })
  async download(@Param('filename') filename: string, @Res() res: Response) {
    const { path, size } = await this.backupService.getForDownload(filename);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Streamed, so a large dump never has to sit in memory
    this.backupService.createReadStream(path).pipe(res);
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete a backup file' })
  remove(@Param('filename') filename: string) {
    return this.backupService.remove(filename);
  }
}
