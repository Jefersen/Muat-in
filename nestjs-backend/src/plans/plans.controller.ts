import { Controller, Post, Get, Body, Param, UseGuards, Request, HttpCode, HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { PlansService } from './plans.service';
import { ExecutePlanDto } from './dto/execute-plan.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Load Planning & ODOL Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post('execute')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Calculate 3D Bin Packing loading layout, CoG, and ODOL risks' })
  @ApiResponse({ status: 201, description: 'Calculation completed and saved successfully' })
  @ApiResponse({ status: 400, description: 'Bad request validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal AI Engine connection failure' })
  async executePlan(@Request() req: any, @Body() executePlanDto: ExecutePlanDto) {
    const userId = req.user.userId;
    return this.plansService.executePlan(userId, executePlanDto);
  }

  @Get(':id/manifest')
  @ApiOperation({ summary: 'Generate and retrieve a digital manifest for a load plan' })
  @ApiResponse({ status: 200, description: 'Returns digital manifest' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getManifest(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.plansService.getManifest(id);
  }
}
