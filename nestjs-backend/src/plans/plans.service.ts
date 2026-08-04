import { Injectable, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HttpService } from '@nestjs/axios';
import { ExecutePlanDto } from './dto/execute-plan.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly httpService: HttpService,
  ) {}

  async executePlan(userId: string, dto: ExecutePlanDto) {
    // 1. Fetch target truck
    const truckRes = await this.db.query('SELECT * FROM trucks WHERE id = $1', [dto.truck_id]);
    if (truckRes.rows.length === 0) {
      throw new NotFoundException('Target truck not found');
    }
    const truck = truckRes.rows[0];

    // 2. Fetch all available trucks for alternative recommendations
    const allTrucksRes = await this.db.query('SELECT * FROM trucks');
    const allTrucks = allTrucksRes.rows;

    // 3. Fetch item metadata details
    const itemsPayload: any[] = [];
    const itemCache = new Map<string, any>();

    for (const itemDto of dto.items) {
      const itemRes = await this.db.query('SELECT * FROM items WHERE id = $1', [itemDto.item_id]);
      if (itemRes.rows.length === 0) {
        throw new NotFoundException(`Item with ID ${itemDto.item_id} not found`);
      }
      const item = itemRes.rows[0];
      itemCache.set(item.id, item);

      itemsPayload.push({
        id: item.id,
        code: item.code,
        name: item.name,
        length_cm: parseFloat(item.length_cm),
        width_cm: parseFloat(item.width_cm),
        height_cm: parseFloat(item.height_cm),
        weight_kg: parseFloat(item.weight_kg),
        category: item.category,
        quantity: itemDto.quantity,
      });
    }

    // 4. Construct payload and send POST to Python FastAPI microservice
    const aiEngineUrl = process.env.PYTHON_AI_ENGINE_URL || 'http://python-ai-engine:8000';
    const payload = {
      truck: {
        id: truck.id,
        name: truck.name,
        plate_number: truck.plate_number,
        length_cm: parseFloat(truck.length_cm),
        width_cm: parseFloat(truck.width_cm),
        height_cm: parseFloat(truck.height_cm),
        max_weight_kg: parseFloat(truck.max_weight_kg),
        max_volume_cbm: parseFloat(truck.max_volume_cbm),
      },
      items: itemsPayload,
      all_trucks: allTrucks.map((t: any) => ({
        id: t.id,
        name: t.name,
        plate_number: t.plate_number,
        length_cm: parseFloat(t.length_cm),
        width_cm: parseFloat(t.width_cm),
        height_cm: parseFloat(t.height_cm),
        max_weight_kg: parseFloat(t.max_weight_kg),
        max_volume_cbm: parseFloat(t.max_volume_cbm),
      })),
    };

    let aiResponse;
    try {
      this.logger.log(`Forwarding payload to Python AI engine at ${aiEngineUrl}/plans/calculate`);
      const response = await firstValueFrom(
        this.httpService.post(`${aiEngineUrl}/plans/calculate`, payload)
      );
      aiResponse = response.data;
    } catch (error: any) {
      this.logger.error(`Error connecting to Python AI engine: ${error.message}`);
      throw new InternalServerErrorException('AI calculations engine connection failed');
    }

    const { utilization, center_of_gravity, odol_risk, truck_recommendation, packed_items, unpacked_items } = aiResponse;

    // 5. Database Save Operations (within a single client connection context)
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      const totalItemsCount = packed_items.length;
      const status = 'calculated';
      const riskDetailsJson = JSON.stringify({
        messages: odol_risk.messages,
        is_overweight: odol_risk.is_overweight,
        is_overdimension: odol_risk.is_overdimension,
        recommendation: truck_recommendation,
      });

      // Insert plan main record
      const planInsertQuery = `
        INSERT INTO load_plans (
          user_id, truck_id, status, total_items, total_weight_kg, total_volume_cbm, 
          weight_utilization_pct, volume_utilization_pct, cog_x, cog_y, cog_z, 
          odol_risk_status, odol_risk_details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;
      const planParams = [
        userId,
        truck.id,
        status,
        totalItemsCount,
        utilization.total_weight_kg,
        utilization.total_volume_cbm,
        utilization.weight_pct,
        utilization.volume_pct,
        center_of_gravity.cog_x,
        center_of_gravity.cog_y,
        center_of_gravity.cog_z,
        odol_risk.status,
        riskDetailsJson
      ];
      const planRes = await client.query(planInsertQuery, planParams);
      const planId = planRes.rows[0].id;

      // Update QR code payload using generated Plan ID
      const qrPayload = `MUATIN-MANIFEST-${planId}`;
      await client.query('UPDATE load_plans SET qr_code_payload = $1 WHERE id = $2', [qrPayload, planId]);

      // Insert packed items coordinates
      for (let seq = 0; seq < packed_items.length; seq++) {
        const item = packed_items[seq];
        const itemInsertQuery = `
          INSERT INTO load_plan_items (
            load_plan_id, item_id, sequence_no, x_pos, y_pos, z_pos, rotation_state, is_placed, weight_category
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(itemInsertQuery, [
          planId,
          item.item_id,
          seq + 1,
          item.x_pos,
          item.y_pos,
          item.z_pos,
          item.rotation_state,
          true,
          item.weight_category
        ]);
      }

      // Insert unpacked items coordinates (for audit log)
      let seqIndex = packed_items.length + 1;
      for (const item of unpacked_items) {
        const itemInsertQuery = `
          INSERT INTO load_plan_items (
            load_plan_id, item_id, sequence_no, x_pos, y_pos, z_pos, rotation_state, is_placed, weight_category
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await client.query(itemInsertQuery, [
          planId,
          item.item_id,
          seqIndex++,
          0.00,
          0.00,
          0.00,
          0,
          false,
          item.weight_category
        ]);
      }

      await client.query('COMMIT');

      // Return unified calculated plan details
      return {
        plan_id: planId,
        status,
        utilization,
        center_of_gravity,
        odol_risk,
        truck_recommendation,
        packed_items: packed_items.map((pi: any) => ({
          ...pi,
          item_id: pi.item_id,
        })),
        unpacked_items,
        qr_code_payload: qrPayload
      };
    } catch (dbError) {
      await client.query('ROLLBACK');
      this.logger.error(`Database Transaction Rollback: ${(dbError as Error).message}`);
      throw dbError;
    } finally {
      client.release();
    }
  }

  async getManifest(planId: string) {
    // Fetch plan metadata
    const planQuery = `
      SELECT lp.*, t.name as truck_name, t.plate_number as truck_plate, u.name as dispatcher_name 
      FROM load_plans lp 
      JOIN trucks t ON lp.truck_id = t.id 
      LEFT JOIN users u ON lp.user_id = u.id 
      WHERE lp.id = $1
    `;
    const planRes = await this.db.query(planQuery, [planId]);
    if (planRes.rows.length === 0) {
      throw new NotFoundException('Manifest plan not found');
    }
    const plan = planRes.rows[0];

    // Fetch associated items
    const itemsQuery = `
      SELECT lpi.*, i.name as item_name, i.code as item_code, i.weight_kg as item_weight
      FROM load_plan_items lpi 
      JOIN items i ON lpi.item_id = i.id 
      WHERE lpi.load_plan_id = $1
    `;
    const itemsRes = await this.db.query(itemsQuery, [planId]);
    const itemsList = itemsRes.rows;

    // Summarize list elements (group by item code)
    const groupedItemsMap = new Map<string, any>();
    for (const item of itemsList) {
      const key = item.item_code;
      if (!groupedItemsMap.has(key)) {
        groupedItemsMap.set(key, {
          code: item.item_code,
          name: item.item_name,
          weight_kg: parseFloat(item.item_weight),
          quantity: 0,
          packed: 0,
          unpacked: 0
        });
      }
      const groupObj = groupedItemsMap.get(key);
      groupObj.quantity += 1;
      if (item.is_placed) {
        groupObj.packed += 1;
      } else {
        groupObj.unpacked += 1;
      }
    }

    return {
      manifest_id: plan.id,
      created_at: plan.created_at,
      status: plan.status,
      dispatcher: plan.dispatcher_name || 'System Operator',
      truck: {
        name: plan.truck_name,
        plate_number: plan.truck_plate,
      },
      summary: {
        total_items: plan.total_items,
        total_weight_kg: parseFloat(plan.total_weight_kg),
        total_volume_cbm: parseFloat(plan.total_volume_cbm),
        weight_utilization_pct: parseFloat(plan.weight_utilization_pct),
        volume_utilization_pct: parseFloat(plan.volume_utilization_pct),
      },
      center_of_gravity: {
        cog_x: parseFloat(plan.cog_x),
        cog_y: parseFloat(plan.cog_y),
        cog_z: parseFloat(plan.cog_z),
      },
      odol_risk: {
        status: plan.odol_risk_status,
        details: plan.odol_risk_details,
      },
      qr_code_payload: plan.qr_code_payload,
      items_summary: Array.from(groupedItemsMap.values()),
      detailed_placements: itemsList.filter((item: any) => item.is_placed).map((item: any) => ({
        sequence_no: item.sequence_no,
        item_id: item.item_id,
        code: item.item_code,
        name: item.item_name,
        position: {
          x: parseFloat(item.x_pos),
          y: parseFloat(item.y_pos),
          z: parseFloat(item.z_pos),
        },
        rotation_state: item.rotation_state,
        weight_category: item.weight_category
      }))
    };
  }
}
