import { IsString, IsNotEmpty, IsNumber, IsPositive, IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateItemDto {
  @ApiProperty({ example: 'PS-X2-440', description: 'Unique SKU code of the item' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Panel Surya Modul X2', description: 'Name of the item' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 40.0, description: 'Length of the item in cm' })
  @IsNumber()
  @IsPositive()
  length_cm!: number;

  @ApiProperty({ example: 30.0, description: 'Width of the item in cm' })
  @IsNumber()
  @IsPositive()
  width_cm!: number;

  @ApiProperty({ example: 30.0, description: 'Height of the item in cm' })
  @IsNumber()
  @IsPositive()
  height_cm!: number;

  @ApiProperty({ example: 12.0, description: 'Weight of the item in kg' })
  @IsNumber()
  @IsPositive()
  weight_kg!: number;

  @ApiProperty({ example: 'LIGHT', enum: ['HEAVY', 'MEDIUM', 'LIGHT'], description: 'Category grouping' })
  @IsString()
  @IsIn(['HEAVY', 'MEDIUM', 'LIGHT'])
  category!: 'HEAVY' | 'MEDIUM' | 'LIGHT';

  @ApiProperty({ example: 'Panel surya modul hemat energi X2', description: 'Detailed item description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
