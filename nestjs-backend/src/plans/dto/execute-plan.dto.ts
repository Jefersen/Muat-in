import { IsUUID, IsArray, ValidateNested, IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class PlanItemDto {
  @ApiProperty({ example: '5e2f7b88-12cd-42ee-b01a-65392df27001', description: 'Item UUID reference' })
  @IsUUID()
  item_id!: string;

  @ApiProperty({ example: 5, description: 'Selected quantity of the item' })
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class ExecutePlanDto {
  @ApiProperty({ example: '1a1796c9-e74c-4e89-9831-29e8c464bf01', description: 'Target vehicle truck UUID' })
  @IsUUID()
  truck_id!: string;

  @ApiProperty({ type: [PlanItemDto], description: 'List of items to pack with their quantities' })
  @IsArray()
  @ValidateNested({ generosity: true, each: true })
  @Type(() => PlanItemDto)
  items!: PlanItemDto[];
}
