import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BackupService } from './backup.service';
import { RestoreService } from './restore.service';

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
  constructor(
    private readonly backupService: BackupService,
    private readonly restoreService: RestoreService,
  ) {}

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

  /**
   * Upload a backup and merge in what is missing.
   *
   * Defaults to a preview: nothing is written unless apply=true is passed
   * explicitly, so the obvious call is the safe one and changing the database
   * has to be asked for.
   */
  @Post('restore')
  @ApiOperation({ summary: 'Merge missing records from an uploaded backup' })
  @UseInterceptors(
    FileInterceptor('file', {
      // Straight to disk, never buffered in memory — a dump of a real database
      // would not fit comfortably, and psql reads it from disk anyway.
      storage: diskStorage({ destination: '/tmp' }),
      limits: { fileSize: 2 * 1024 * 1024 * 1024 },
      // A dump may arrive gzipped from this app, or plain from pg_dump run by
      // hand on another server. Both are accepted; the service sniffs the
      // file's magic bytes rather than trusting the extension.
      fileFilter: (_req, file, cb) => {
        if (!/\.(sql|sql\.gz|gz|dump)$/i.test(file.originalname)) {
          return cb(
            new BadRequestException(
              'Upload a database dump — a .sql or .sql.gz file.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  restore(
    @UploadedFile() file: { path: string; originalname: string } | undefined,
    @Query('apply') apply: string | undefined,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('No backup file was uploaded.');

    return this.restoreService.restore(
      file.path,
      file.originalname,
      apply !== 'true',
      {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
      },
    );
  }
}
