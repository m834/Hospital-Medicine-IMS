import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class LabResultPdfService {
  constructor(private prisma: PrismaService) {}

  async generateResultPdf(labOrderId: string): Promise<Buffer> {
    // Fetch lab order with all details
    const labOrder = await this.prisma.labOrder.findUnique({
      where: { id: labOrderId },
      include: {
        hospital: true,
        patient: true,
        labTest: true,
        orderedBy: { select: { fullName: true, role: true } },
        resultsApprovedBy: { select: { fullName: true, role: true } },
      },
    });

    if (!labOrder) {
      throw new Error('Lab order not found');
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(labOrder.hospital.name, { align: 'center' })
          .fontSize(10)
          .font('Helvetica')
          .text(labOrder.hospital.address || '', { align: 'center' })
          .text(`Phone: ${labOrder.hospital.phone || 'N/A'}`, { align: 'center' })
          .moveDown(1);

        // Title
        doc
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('LABORATORY TEST REPORT', { align: 'center', underline: true })
          .moveDown(1);

        // Order Details
        const leftColumn = 70;
        const rightColumn = 320;
        let yPosition = doc.y;

        doc.fontSize(10).font('Helvetica');

        // Left side - Patient Info
        doc
          .font('Helvetica-Bold')
          .text('Patient Information:', leftColumn, yPosition)
          .font('Helvetica')
          .moveDown(0.3)
          .text(`MRN: ${labOrder.patient.nrNumber}`, leftColumn)
          .text(`Name: ${labOrder.patient.fullName}`, leftColumn)
          .text(`Gender: ${labOrder.patient.gender}`, leftColumn)
          .text(
            `Age: ${labOrder.patient.dob ? this.calculateAge(labOrder.patient.dob) : 'N/A'}`,
            leftColumn,
          )
          .text(`Mobile: ${labOrder.patient.mobile}`, leftColumn);

        // Right side - Order Info
        yPosition = doc.y - 90; // Align with patient info
        doc
          .font('Helvetica-Bold')
          .text('Order Information:', rightColumn, yPosition)
          .font('Helvetica')
          .moveDown(0.3)
          .text(`Order No: ${labOrder.orderNumber}`, rightColumn)
          .text(
            `Order Date: ${this.formatDate(labOrder.createdAt)}`,
            rightColumn,
          )
          .text(
            `Sample Collected: ${labOrder.sampleCollectedAt ? this.formatDate(labOrder.sampleCollectedAt) : 'N/A'}`,
            rightColumn,
          )
          .text(
            `Report Date: ${labOrder.resultsApprovedAt ? this.formatDate(labOrder.resultsApprovedAt) : this.formatDate(new Date())}`,
            rightColumn,
          )
          .text(`Priority: ${labOrder.priority}`, rightColumn);

        doc.moveDown(2);

        // Test Details
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Test Details', { underline: true })
          .moveDown(0.5);

        doc
          .fontSize(10)
          .font('Helvetica')
          .text(`Test Name: ${labOrder.labTest.testName}`)
          .text(`Test Code: ${labOrder.labTest.testCode}`)
          .text(`Category: ${labOrder.labTest.testCategory}`)
          .moveDown(1);

        if (labOrder.clinicalNotes) {
          doc
            .font('Helvetica-Bold')
            .text('Clinical Notes:')
            .font('Helvetica')
            .text(labOrder.clinicalNotes)
            .moveDown(1);
        }

        // Results Section
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Test Results', { underline: true })
          .moveDown(0.5);

        if (labOrder.results && typeof labOrder.results === 'object') {
          // Table header
          const tableTop = doc.y;
          const col1 = leftColumn;
          const col2 = 250;
          const col3 = 370;
          const col4 = 470;

          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('Parameter', col1, tableTop)
            .text('Result', col2, tableTop)
            .text('Unit', col3, tableTop)
            .text('Reference', col4, tableTop);

          doc
            .moveTo(leftColumn, tableTop + 15)
            .lineTo(550, tableTop + 15)
            .stroke();

          let y = tableTop + 25;
          doc.font('Helvetica');

          // Render results
          const results = Array.isArray(labOrder.results)
            ? labOrder.results
            : [labOrder.results];

          for (const result of results) {
            if (y > 700) {
              // Add new page if needed
              doc.addPage();
              y = 50;
            }

            const resultObj = result as any;
            doc
              .text(resultObj.parameter || 'N/A', col1, y, { width: 170 })
              .text(resultObj.value || resultObj.result || 'N/A', col2, y, {
                width: 110,
              })
              .text(resultObj.unit || '', col3, y, { width: 90 })
              .text(resultObj.normalRange || resultObj.reference || 'N/A', col4, y, {
                width: 80,
              });

            y += 25;
          }

          doc.moveDown(2);
        } else if (labOrder.results) {
          doc.font('Helvetica').text(JSON.stringify(labOrder.results, null, 2));
        } else {
          doc.font('Helvetica').text('No results available');
        }

        if (labOrder.resultNotes) {
          doc
            .moveDown(1)
            .font('Helvetica-Bold')
            .text('Notes:')
            .font('Helvetica')
            .text(labOrder.resultNotes);
        }

        // Footer - Signatures
        const footerY = 680;
        doc.moveTo(leftColumn, footerY).lineTo(550, footerY).stroke();

        doc.moveDown(2);
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(`Ordered By: ${labOrder.orderedBy.fullName}`, leftColumn, footerY + 20)
          .font('Helvetica')
          .text(`Role: ${labOrder.orderedBy.role}`, leftColumn);

        if (labOrder.resultsApprovedBy) {
          doc
            .font('Helvetica-Bold')
            .text(
              `Approved By: ${labOrder.resultsApprovedBy.fullName}`,
              rightColumn,
              footerY + 20,
            )
            .font('Helvetica')
            .text(`Role: ${labOrder.resultsApprovedBy.role}`, rightColumn)
            .text(
              `Date: ${this.formatDate(labOrder.resultsApprovedAt!)}`,
              rightColumn,
            );
        }

        // Disclaimer
        doc
          .fontSize(8)
          .font('Helvetica')
          .text(
            'This is a computer-generated report and does not require a signature.',
            50,
            750,
            { align: 'center' },
          );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private calculateAge(dob: Date): string {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return `${age} years`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
