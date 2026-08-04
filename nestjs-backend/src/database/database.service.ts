import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private readonly logger = new Logger(DatabaseService.name);

  onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      this.logger.error('DATABASE_URL is not set in environment variables');
      throw new Error('DATABASE_URL is missing');
    }

    this.logger.log('Initializing PostgreSQL Connection Pool...');
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('supabase.co') || connectionString.includes('supabase.com') || connectionString.includes('pooler.supabase.com')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  async onModuleDestroy() {
    this.logger.log('Closing PostgreSQL Connection Pool...');
    await this.pool.end();
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      this.logger.debug(`Executed query: ${text} | Duration: ${duration}ms`);
      return res;
    } catch (error: any) {
      this.logger.error(`Database Query Error: ${error.message} (Query: ${text})`);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }
}
