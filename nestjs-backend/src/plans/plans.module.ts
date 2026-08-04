import { Module } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';
import { HttpModule } from '@nestjs/axios';
import { PdfService } from './pdf.service';

@Module({
  imports: [HttpModule],
  providers: [PlansService, PdfService],
  controllers: [PlansController],
  exports: [PlansService],
})
export class PlansModule {}
