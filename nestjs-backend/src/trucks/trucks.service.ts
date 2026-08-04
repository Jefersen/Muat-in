import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateTruckDto } from './dto/create-truck.dto';

@Injectable()
export class TrucksService {
  private readonly logger = new Logger(TrucksService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    const result = await this.db.query('SELECT * FROM trucks ORDER BY name ASC');
    return result.rows;
  }

  async findOne(id: string) {
    const result = await this.db.query('SELECT * FROM trucks WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async create(createTruckDto: CreateTruckDto) {
    const { name, plate_number, length_cm, width_cm, height_cm, max_weight_kg, max_volume_cbm } = createTruckDto;
    
    const result = await this.db.query(
      `INSERT INTO trucks (name, plate_number, length_cm, width_cm, height_cm, max_weight_kg, max_volume_cbm) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [name, plate_number, length_cm, width_cm, height_cm, max_weight_kg, max_volume_cbm],
    );
    
    return result.rows[0];
  }
}
