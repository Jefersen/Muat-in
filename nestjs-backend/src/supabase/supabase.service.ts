import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly logger = new Logger(SupabaseService.name);
  private readonly bucketName: string;

  constructor() {
    const url = process.env.SUPABASE_URL?.replace('/rest/v1/', '') || '';
    const key = process.env.SUPABASE_ANON_KEY || '';
    this.bucketName = process.env.SUPABASE_MANIFEST_BUCKET || 'manifests';

    if (!url || !key) {
      this.logger.warn('Supabase URL or Anon Key not set — storage uploads will be skipped');
    }

    this.client = createClient(url, key);
  }

  async uploadManifestPdf(planId: string, pdfBuffer: Buffer): Promise<string | null> {
    try {
      const fileName = `manifest-${planId}.pdf`;

      const { data, error } = await this.client.storage
        .from(this.bucketName)
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (error) {
        this.logger.error(`Supabase upload failed: ${error.message}`);
        return null;
      }

      // Get the public URL
      const { data: urlData } = this.client.storage
        .from(this.bucketName)
        .getPublicUrl(fileName);

      this.logger.log(`Manifest PDF uploaded: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (err: any) {
      this.logger.error(`Storage upload exception: ${err.message}`);
      return null;
    }
  }
}
