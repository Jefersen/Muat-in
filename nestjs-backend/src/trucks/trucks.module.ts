import { Module } from '@nestjs/common';
import { TrucksService } from './trucks.service';
import { TrucksController } from './trucks.controller';

@Module({
  providers: [TrucksService],
  controllers: [TrucksController],
  exports: [TrucksService],
})
export class TrucksModule {}
