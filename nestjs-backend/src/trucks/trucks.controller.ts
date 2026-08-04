import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TrucksService } from './trucks.service';
import { CreateTruckDto } from './dto/create-truck.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Trucks Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trucks')
export class TrucksController {
  constructor(private readonly trucksService: TrucksService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of all trucks' })
  @ApiResponse({ status: 200, description: 'Returns all trucks' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll() {
    return this.trucksService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Add a new truck configuration' })
  @ApiResponse({ status: 201, description: 'Truck successfully added' })
  @ApiResponse({ status: 400, description: 'Bad request validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createTruckDto: CreateTruckDto) {
    return this.trucksService.create(createTruckDto);
  }
}
