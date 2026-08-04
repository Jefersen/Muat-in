import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateManifestPdf(manifest: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // ─── HEADER ─────────────────────────────────────────────
        doc
          .fontSize(22)
          .font('Helvetica-Bold')
          .fillColor('#1a1a2e')
          .text('MUAT-IN', { align: 'center' });

        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#555')
          .text('Digital Cargo Manifest', { align: 'center' });

        doc.moveDown(0.5);
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor('#1a1a2e')
          .lineWidth(2)
          .stroke();
        doc.moveDown(0.8);

        // ─── MANIFEST META INFO ──────────────────────────────────
        const dateStr = new Date(manifest.created_at).toLocaleString('id-ID', {
          dateStyle: 'long',
          timeStyle: 'short',
        });

        this.twoColRow(doc, 'Manifest ID:', manifest.manifest_id);
        this.twoColRow(doc, 'Tanggal:', dateStr);
        this.twoColRow(doc, 'Dispatcher:', manifest.dispatcher);
        this.twoColRow(doc, 'Status:', manifest.status.toUpperCase());

        doc.moveDown(0.8);

        // ─── TRUCK INFO ──────────────────────────────────────────
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#1a1a2e')
          .text('INFORMASI ARMADA');
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor('#ccc')
          .lineWidth(1)
          .stroke();
        doc.moveDown(0.4);

        this.twoColRow(doc, 'Nama Truk:', manifest.truck.name);
        this.twoColRow(doc, 'Plat Nomor:', manifest.truck.plate_number);

        doc.moveDown(0.8);

        // ─── SUMMARY ─────────────────────────────────────────────
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#1a1a2e')
          .text('RINGKASAN MUATAN');
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor('#ccc')
          .lineWidth(1)
          .stroke();
        doc.moveDown(0.4);

        this.twoColRow(doc, 'Total Item:', `${manifest.summary.total_items} pcs`);
        this.twoColRow(doc, 'Total Berat:', `${manifest.summary.total_weight_kg} kg`);
        this.twoColRow(doc, 'Total Volume:', `${manifest.summary.total_volume_cbm} CBM`);
        this.twoColRow(doc, 'Utilisasi Berat:', `${manifest.summary.weight_utilization_pct}%`);
        this.twoColRow(doc, 'Utilisasi Volume:', `${manifest.summary.volume_utilization_pct}%`);

        doc.moveDown(0.4);
        this.twoColRow(doc, 'Center of Gravity X:', `${manifest.center_of_gravity.cog_x} cm`);
        this.twoColRow(doc, 'Center of Gravity Y:', `${manifest.center_of_gravity.cog_y} cm`);
        this.twoColRow(doc, 'Center of Gravity Z:', `${manifest.center_of_gravity.cog_z} cm`);

        doc.moveDown(0.8);

        // ─── ODOL RISK BOX ────────────────────────────────────────
        const riskStatus = manifest.odol_risk.status;
        const riskColor =
          riskStatus === 'SAFE' ? '#d4edda' :
          riskStatus === 'WARNING' ? '#fff3cd' : '#f8d7da';
        const riskBorder =
          riskStatus === 'SAFE' ? '#28a745' :
          riskStatus === 'WARNING' ? '#ffc107' : '#dc3545';
        const riskText =
          riskStatus === 'SAFE' ? '#155724' :
          riskStatus === 'WARNING' ? '#856404' : '#721c24';

        const boxY = doc.y;
        doc
          .rect(50, boxY, 495, 50)
          .fillAndStroke(riskColor, riskBorder);

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(riskText)
          .text(`STATUS ODOL: ${riskStatus}`, 60, boxY + 8);

        const messages: string[] = manifest.odol_risk?.details?.messages || [];
        const msgText = messages.join(' | ');
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(riskText)
          .text(msgText, 60, boxY + 28, { width: 475 });

        doc.moveDown(3);

        // ─── ITEMS TABLE ─────────────────────────────────────────
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor('#1a1a2e')
          .text('RINCIAN POSISI MUATAN');
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor('#ccc')
          .lineWidth(1)
          .stroke();
        doc.moveDown(0.4);

        // Table header
        const tableTop = doc.y;
        const colNo = 50, colCode = 80, colName = 155, colPos = 330, colCat = 460;

        doc
          .rect(50, tableTop, 495, 18)
          .fill('#1a1a2e');

        doc
          .fontSize(8)
          .font('Helvetica-Bold')
          .fillColor('#ffffff');
        doc.text('No', colNo, tableTop + 5, { width: 25, align: 'left' });
        doc.text('Kode', colCode, tableTop + 5, { width: 70, align: 'left' });
        doc.text('Nama Barang', colName, tableTop + 5, { width: 165, align: 'left' });
        doc.text('Posisi (X,Y,Z cm)', colPos, tableTop + 5, { width: 120, align: 'left' });
        doc.text('Kategori', colCat, tableTop + 5, { width: 80, align: 'left' });

        // Table rows
        const placements = manifest.detailed_placements || [];
        let rowY = tableTop + 18;

        placements.forEach((item: any, idx: number) => {
          if (rowY > 750) {
            doc.addPage();
            rowY = 50;
          }

          const rowColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
          doc.rect(50, rowY, 495, 16).fill(rowColor);

          const catColor =
            item.weight_category === 'heavy_red' ? '#dc3545' :
            item.weight_category === 'medium_yellow' ? '#ffc107' : '#28a745';

          doc
            .fontSize(7.5)
            .font('Helvetica')
            .fillColor('#333');

          doc.text(String(item.sequence_no), colNo, rowY + 4, { width: 25 });
          doc.text(item.code || '-', colCode, rowY + 4, { width: 70 });
          doc.text(item.name || '-', colName, rowY + 4, { width: 165 });
          doc.text(
            `(${item.position.x}, ${item.position.y}, ${item.position.z})`,
            colPos, rowY + 4, { width: 120 }
          );

          // Colored category badge dot
          doc.circle(colCat + 4, rowY + 8, 4).fill(catColor);
          doc
            .fillColor('#333')
            .text(
              item.weight_category === 'heavy_red' ? 'Berat' :
              item.weight_category === 'medium_yellow' ? 'Sedang' : 'Ringan',
              colCat + 12, rowY + 4, { width: 70 }
            );

          rowY += 16;
        });

        doc.moveDown(2);

        // ─── QR CODE PAYLOAD TEXT ────────────────────────────────
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .strokeColor('#ccc')
          .lineWidth(1)
          .stroke();
        doc.moveDown(0.5);
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#555')
          .text(`QR Code Payload: ${manifest.qr_code_payload}`, { align: 'center' });
        doc
          .fontSize(8)
          .fillColor('#aaa')
          .text('Dokumen ini dibuat secara otomatis oleh Sistem Muat-In.', { align: 'center' });

        doc.end();
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private twoColRow(doc: any, label: string, value: string) {
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#333')
      .text(label, 50, doc.y, { continued: true, width: 180 });
    doc
      .font('Helvetica')
      .fillColor('#555')
      .text(value, { width: 300 });
  }
}
