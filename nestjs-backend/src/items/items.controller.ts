import { Controller, Get, Post, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Items Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of items with search filter and pagination' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Filter by item code or name' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'Returns list of items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.itemsService.findAll(search, page, limit);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new master item' })
  @ApiResponse({ status: 201, description: 'Item successfully added' })
  @ApiResponse({ status: 400, description: 'Bad request validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createItemDto: CreateItemDto) {
    return this.itemsService.create(createItemDto);
  }
}
