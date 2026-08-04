import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(private readonly db: DatabaseService) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let dataQuery = 'SELECT * FROM items';
    let countQuery = 'SELECT COUNT(*) FROM items';
    const params: any[] = [];

    if (search) {
      const searchPattern = `%${search}%`;
      dataQuery += ' WHERE code ILIKE $1 OR name ILIKE $1 ORDER BY name ASC LIMIT $2 OFFSET $3';
      countQuery += ' WHERE code ILIKE $1 OR name ILIKE $1';
      params.push(searchPattern);
      
      const countRes = await this.db.query(countQuery, [searchPattern]);
      const total = parseInt(countRes.rows[0].count, 10);
      
      const dataRes = await this.db.query(dataQuery, [searchPattern, limit, offset]);
      
      return {
        data: dataRes.rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } else {
      dataQuery += ' ORDER BY name ASC LIMIT $1 OFFSET $2';
      
      const countRes = await this.db.query(countQuery);
      const total = parseInt(countRes.rows[0].count, 10);
      
      const dataRes = await this.db.query(dataQuery, [limit, offset]);
      
      return {
        data: dataRes.rows,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  }

  async create(createItemDto: CreateItemDto) {
    const { code, name, length_cm, width_cm, height_cm, weight_kg, category, description } = createItemDto;
    
    const result = await this.db.query(
      `INSERT INTO items (code, name, length_cm, width_cm, height_cm, weight_kg, category, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [code, name, length_cm, width_cm, height_cm, weight_kg, category, description || null],
    );
    
    return result.rows[0];
  }
}
