import { Module } from '@nestjs/common';
import { BedsController } from './beds.controller';
import { BedsService } from './beds.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BedsController],
  providers: [BedsService],
  exports: [BedsService],
})
export class BedsModule {}
