import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'budisantoso@gmail.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString()
  @MinLength(6)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'Budi Santoso', description: 'User display name' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'budisantoso@gmail.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', description: 'User password (min 6 characters)' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'dispatcher', description: 'User role', required: false, enum: ['admin', 'dispatcher', 'driver'] })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'dispatcher', 'driver'])
  role?: string;
}
