import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTruckDto {
  @ApiProperty({ example: 'Truck only', description: 'Name of the truck model/type' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'B 9001 TKO', description: 'License plate number' })
  @IsString()
  @IsNotEmpty()
  plate_number!: string;

  @ApiProperty({ example: 400.0, description: 'Internal truck bed length in cm' })
  @IsNumber()
  @IsPositive()
  length_cm!: number;

  @ApiProperty({ example: 300.0, description: 'Internal truck bed width in cm' })
  @IsNumber()
  @IsPositive()
  width_cm!: number;

  @ApiProperty({ example: 300.0, description: 'Internal truck bed height in cm' })
  @IsNumber()
  @IsPositive()
  height_cm!: number;

  @ApiProperty({ example: 1000.0, description: 'Maximum payload weight capacity in kg' })
  @IsNumber()
  @IsPositive()
  max_weight_kg!: number;

  @ApiProperty({ example: 36.0, description: 'Maximum volume capacity in Cubic Meters (CBM)' })
  @IsNumber()
  @IsPositive()
  max_volume_cbm!: number;
}
