import jsPDF from 'jspdf';
import { EmailQueue, Invoice } from '../types/database';

interface QuoteCategory {
  categoryName: string;
  grandTotal: number;
  securityDeposit: number;
  advancePayment: number;
  available: boolean;
}

interface QuotePDFData {
  quoteReference: string;
  clientName: string;
  startDate: string;
  endDate: string;
  duration: string;
  pickupLocation: string;
  dropoffLocation: string;
  rentalType: string;
  categories: QuoteCategory[];
}

export function generateEmailPDF(email: EmailQueue): void {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Email Message', margin, yPosition);
  yPosition += 15;

  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Recipient Information', margin, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.setFont('helvetica', 'bold');
  doc.text('Name:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(email.recipient_name, margin + 30, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Email:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(email.recipient_email, margin + 30, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Type:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(email.email_type.replace(/_/g, ' ').toUpperCase(), margin + 30, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Status:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(email.status.toUpperCase(), margin + 30, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Scheduled:', margin, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(email.scheduled_for).toLocaleString(), margin + 30, yPosition);
  yPosition += 12;

  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Subject', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const subjectLines = doc.splitTextToSize(email.subject, contentWidth);
  doc.text(subjectLines, margin, yPosition);
  yPosition += (subjectLines.length * 6) + 8;

  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Message Body', margin, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const bodyLines = doc.splitTextToSize(email.body, contentWidth);

  for (let i = 0; i < bodyLines.length; i++) {
    if (yPosition > pageHeight - margin - 10) {
      doc.addPage();
      yPosition = margin;
    }
    doc.text(bodyLines[i], margin, yPosition);
    yPosition += 6;
  }

  yPosition += 10;
  if (yPosition > pageHeight - margin - 20) {
    doc.addPage();
    yPosition = margin;
  }

  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, yPosition);
  doc.text(`Email ID: ${email.id}`, pageWidth - margin - 60, yPosition);

  const fileName = `email_${email.recipient_name.replace(/\s+/g, '_')}_${email.email_type}_${Date.now()}.pdf`;
  doc.save(fileName);
}

export function generateBulkEmailsPDF(emails: EmailQueue[]): void {
  if (emails.length === 0) {
    throw new Error('No emails to download');
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  emails.forEach((email, index) => {
    if (index > 0) {
      doc.addPage();
    }

    let yPosition = margin;

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Email ${index + 1} of ${emails.length}`, margin, yPosition);
    yPosition += 15;

    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Recipient Information', margin, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    doc.setFont('helvetica', 'bold');
    doc.text('Name:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(email.recipient_name, margin + 30, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Email:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(email.recipient_email, margin + 30, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Type:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(email.email_type.replace(/_/g, ' ').toUpperCase(), margin + 30, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Status:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(email.status.toUpperCase(), margin + 30, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Scheduled:', margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(email.scheduled_for).toLocaleString(), margin + 30, yPosition);
    yPosition += 12;

    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Subject', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const subjectLines = doc.splitTextToSize(email.subject, contentWidth);
    doc.text(subjectLines, margin, yPosition);
    yPosition += (subjectLines.length * 6) + 8;

    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Message Body', margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const bodyLines = doc.splitTextToSize(email.body, contentWidth);

    for (let i = 0; i < bodyLines.length; i++) {
      if (yPosition > pageHeight - margin - 10) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(bodyLines[i], margin, yPosition);
      yPosition += 6;
    }

    yPosition += 10;
    if (yPosition > pageHeight - margin - 20) {
      doc.addPage();
      yPosition = margin;
    }

    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, yPosition);
    doc.text(`Email ID: ${email.id}`, pageWidth - margin - 60, yPosition);
  });

  const fileName = `emails_bulk_${emails.length}_${Date.now()}.pdf`;
  doc.save(fileName);
}

export function generateQuotePDFBase64(data: QuotePDFData): string {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Rent A Car In Kenya', margin, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Vehicle Rental Quote', margin, 32);

  yPosition = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Quotation', margin, yPosition);
  yPosition += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.setFillColor(249, 250, 251);
  doc.rect(margin, yPosition, contentWidth, 50, 'F');

  yPosition += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Reference:', margin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.quoteReference, margin + 40, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', margin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientName, margin + 40, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Period:', margin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.startDate} to ${data.endDate}`, margin + 40, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Duration:', margin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.duration, margin + 40, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Pickup:', margin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.pickupLocation, margin + 40, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Drop-off:', margin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.dropoffLocation, margin + 40, yPosition);

  yPosition += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Type:', margin + 5, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.rentalType, margin + 40, yPosition);

  yPosition += 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Pricing Options', margin, yPosition);
  yPosition += 10;

  data.categories.forEach((category, index) => {
    doc.setFillColor(245, 247, 250);
    doc.rect(margin, yPosition, contentWidth, 28, 'F');

    yPosition += 8;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${category.categoryName}`, margin + 5, yPosition);

    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total: ${formatCurrency(category.grandTotal)}`, margin + 10, yPosition);

    yPosition += 6;
    doc.text(`25% Advance Required: ${formatCurrency(category.advancePayment)}`, margin + 10, yPosition);

    if (!data.rentalType.includes('Chauffeur') && category.securityDeposit > 0) {
      yPosition += 6;
      doc.text(`Security Deposit: ${formatCurrency(category.securityDeposit)} (Refundable)`, margin + 10, yPosition);
    }

    const statusX = pageWidth - margin - 50;
    yPosition -= (!data.rentalType.includes('Chauffeur') && category.securityDeposit > 0 ? 12 : 6);
    doc.setFont('helvetica', 'bold');
    if (category.available) {
      doc.setTextColor(0, 128, 0);
      doc.text('Available', statusX, yPosition);
    } else {
      doc.setTextColor(200, 100, 0);
      doc.text('Subject to Availability', statusX, yPosition);
    }
    doc.setTextColor(0, 0, 0);

    yPosition += 22;
  });

  yPosition += 10;
  doc.setFillColor(254, 243, 199);
  doc.rect(margin, yPosition, contentWidth, 15, 'F');
  yPosition += 10;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Terms & Conditions Apply - Please contact us for booking or inquiries', margin + 5, yPosition);

  yPosition += 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Rent A Car In Kenya | Premium Vehicle Rentals', margin, yPosition);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, yPosition);

  return doc.output('datauristring').split(',')[1];
}

export function generateInvoicePDF(invoice: Invoice): void {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', margin, yPosition + 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Rent A Car In Kenya', margin, yPosition + 22);
  doc.text('Premium Vehicle Rentals', margin, yPosition + 28);

  yPosition = 50;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Invoice #: ${invoice.invoice_reference}`, pageWidth - margin - 60, yPosition);
  yPosition += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, pageWidth - margin - 60, yPosition);
  yPosition += 6;
  doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, pageWidth - margin - 60, yPosition);

  yPosition = 50;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', margin, yPosition);
  yPosition += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.client_name, margin, yPosition);
  if (invoice.client_email) {
    yPosition += 6;
    doc.text(invoice.client_email, margin, yPosition);
  }

  yPosition += 20;
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  doc.setFillColor(245, 247, 250);
  doc.rect(margin, yPosition, contentWidth, 10, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 5, yPosition + 7);
  doc.text('Amount', pageWidth - margin - 35, yPosition + 7);
  yPosition += 15;

  invoice.selected_categories.forEach((category) => {
    const startY = yPosition;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(category.categoryName, margin + 5, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(category.breakdown, margin + 10, yPosition);
    yPosition += 6;

    doc.setTextColor(0, 0, 0);
    if (category.rentalFee > 0) {
      doc.text(`Rental Fee: ${formatCurrency(category.rentalFee)}`, margin + 10, yPosition);
      yPosition += 5;
    }
    if (category.chauffeurFee > 0) {
      doc.text(`Chauffeur Fee: ${formatCurrency(category.chauffeurFee)}`, margin + 10, yPosition);
      yPosition += 5;
    }
    if (category.otherFees > 0) {
      doc.text(`Other Fees: ${formatCurrency(category.otherFees)}`, margin + 10, yPosition);
      yPosition += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(category.total), pageWidth - margin - 35, startY);

    yPosition += 8;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin + 5, yPosition, pageWidth - margin - 5, yPosition);
    yPosition += 8;
  });

  yPosition += 5;
  const totalsStartX = pageWidth - margin - 80;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Subtotal:', totalsStartX, yPosition);
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin - 35, yPosition);
  yPosition += 7;

  doc.text('VAT (16%):', totalsStartX, yPosition);
  doc.text(formatCurrency(invoice.vat), pageWidth - margin - 35, yPosition);
  yPosition += 10;

  doc.setLineWidth(1);
  doc.setDrawColor(37, 99, 235);
  doc.line(totalsStartX - 5, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', totalsStartX, yPosition);
  doc.text(formatCurrency(invoice.total_amount), pageWidth - margin - 35, yPosition);

  if (invoice.deposit_amount && invoice.deposit_amount > 0) {
    yPosition += 12;
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(totalsStartX - 5, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text('Deposit Required (25%):', totalsStartX, yPosition);
    doc.text(formatCurrency(invoice.deposit_amount), pageWidth - margin - 35, yPosition);
    yPosition += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    if (invoice.amount_paid && invoice.amount_paid > 0) {
      doc.text('Amount Paid:', totalsStartX, yPosition);
      doc.text(formatCurrency(invoice.amount_paid), pageWidth - margin - 35, yPosition);
      yPosition += 7;
    }

    if (invoice.balance_due && invoice.balance_due > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Balance Due:', totalsStartX, yPosition);
      doc.text(formatCurrency(invoice.balance_due), pageWidth - margin - 35, yPosition);
    }
  }

  if (invoice.payment_status === 'Paid') {
    yPosition += 15;
    doc.setFillColor(34, 197, 94);
    doc.rect(margin, yPosition, contentWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const paidText = `PAID - ${invoice.payment_method || 'Payment Received'}`;
    doc.text(paidText, margin + 5, yPosition + 8);
    if (invoice.payment_date) {
      doc.text(`on ${new Date(invoice.payment_date).toLocaleDateString()}`, pageWidth - margin - 50, yPosition + 8);
    }
    doc.setTextColor(0, 0, 0);
    yPosition += 17;
  } else {
    yPosition += 15;
  }

  if (invoice.notes) {
    yPosition += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes:', margin, yPosition);
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(invoice.notes, contentWidth - 10);
    doc.text(notesLines, margin + 5, yPosition);
    yPosition += (notesLines.length * 5) + 10;
  }

  yPosition += 10;
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, yPosition, contentWidth, 30, 'F');
  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Payment Information', margin + 5, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Bank: Example Bank Kenya', margin + 5, yPosition);
  yPosition += 5;
  doc.text('Account: 1234567890', margin + 5, yPosition);
  yPosition += 5;
  doc.text('M-Pesa Till: 123456', margin + 5, yPosition);
  yPosition += 5;
  doc.text('Reference: ' + invoice.invoice_reference, margin + 5, yPosition);

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Rent A Car In Kenya | Premium Vehicle Rentals', margin, footerY);
  doc.text('Email: info@rentacarinkenya.com | Tel: +254 XXX XXX XXX', margin, footerY + 5);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, footerY);

  doc.save(`Invoice_${invoice.invoice_reference}.pdf`);
}

export function generateInvoicePDFBase64(invoice: Invoice): string {
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('INVOICE', margin, yPosition + 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Rent A Car In Kenya', margin, yPosition + 22);
  doc.text('Premium Vehicle Rentals', margin, yPosition + 28);

  yPosition = 50;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Invoice #: ${invoice.invoice_reference}`, pageWidth - margin - 60, yPosition);
  yPosition += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, pageWidth - margin - 60, yPosition);
  yPosition += 6;
  doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, pageWidth - margin - 60, yPosition);

  yPosition = 50;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', margin, yPosition);
  yPosition += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.client_name, margin, yPosition);
  if (invoice.client_email) {
    yPosition += 6;
    doc.text(invoice.client_email, margin, yPosition);
  }

  yPosition += 20;
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  doc.setFillColor(245, 247, 250);
  doc.rect(margin, yPosition, contentWidth, 10, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', margin + 5, yPosition + 7);
  doc.text('Amount', pageWidth - margin - 35, yPosition + 7);
  yPosition += 15;

  invoice.selected_categories.forEach((category) => {
    const startY = yPosition;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(category.categoryName, margin + 5, yPosition);
    yPosition += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(category.breakdown, margin + 10, yPosition);
    yPosition += 6;

    doc.setTextColor(0, 0, 0);
    if (category.rentalFee > 0) {
      doc.text(`Rental Fee: ${formatCurrency(category.rentalFee)}`, margin + 10, yPosition);
      yPosition += 5;
    }
    if (category.chauffeurFee > 0) {
      doc.text(`Chauffeur Fee: ${formatCurrency(category.chauffeurFee)}`, margin + 10, yPosition);
      yPosition += 5;
    }
    if (category.otherFees > 0) {
      doc.text(`Other Fees: ${formatCurrency(category.otherFees)}`, margin + 10, yPosition);
      yPosition += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(category.total), pageWidth - margin - 35, startY);

    yPosition += 8;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin + 5, yPosition, pageWidth - margin - 5, yPosition);
    yPosition += 8;
  });

  yPosition += 5;
  const totalsStartX = pageWidth - margin - 80;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Subtotal:', totalsStartX, yPosition);
  doc.text(formatCurrency(invoice.subtotal), pageWidth - margin - 35, yPosition);
  yPosition += 7;

  doc.text('VAT (16%):', totalsStartX, yPosition);
  doc.text(formatCurrency(invoice.vat), pageWidth - margin - 35, yPosition);
  yPosition += 10;

  doc.setLineWidth(1);
  doc.setDrawColor(37, 99, 235);
  doc.line(totalsStartX - 5, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', totalsStartX, yPosition);
  doc.text(formatCurrency(invoice.total_amount), pageWidth - margin - 35, yPosition);

  if (invoice.deposit_amount && invoice.deposit_amount > 0) {
    yPosition += 12;
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(totalsStartX - 5, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(37, 99, 235);
    doc.text('Deposit Required (25%):', totalsStartX, yPosition);
    doc.text(formatCurrency(invoice.deposit_amount), pageWidth - margin - 35, yPosition);
    yPosition += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    if (invoice.amount_paid && invoice.amount_paid > 0) {
      doc.text('Amount Paid:', totalsStartX, yPosition);
      doc.text(formatCurrency(invoice.amount_paid), pageWidth - margin - 35, yPosition);
      yPosition += 7;
    }

    if (invoice.balance_due && invoice.balance_due > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Balance Due:', totalsStartX, yPosition);
      doc.text(formatCurrency(invoice.balance_due), pageWidth - margin - 35, yPosition);
    }
  }

  if (invoice.payment_status === 'Paid') {
    yPosition += 15;
    doc.setFillColor(34, 197, 94);
    doc.rect(margin, yPosition, contentWidth, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const paidText = `PAID - ${invoice.payment_method || 'Payment Received'}`;
    doc.text(paidText, margin + 5, yPosition + 8);
    if (invoice.payment_date) {
      doc.text(`on ${new Date(invoice.payment_date).toLocaleDateString()}`, pageWidth - margin - 50, yPosition + 8);
    }
    doc.setTextColor(0, 0, 0);
    yPosition += 17;
  } else {
    yPosition += 15;
  }

  if (invoice.notes) {
    yPosition += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes:', margin, yPosition);
    yPosition += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(invoice.notes, contentWidth - 10);
    doc.text(notesLines, margin + 5, yPosition);
    yPosition += (notesLines.length * 5) + 10;
  }

  yPosition += 10;
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, yPosition, contentWidth, 30, 'F');
  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Payment Information', margin + 5, yPosition);
  yPosition += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Bank: Example Bank Kenya', margin + 5, yPosition);
  yPosition += 5;
  doc.text('Account: 1234567890', margin + 5, yPosition);
  yPosition += 5;
  doc.text('M-Pesa Till: 123456', margin + 5, yPosition);
  yPosition += 5;
  doc.text('Reference: ' + invoice.invoice_reference, margin + 5, yPosition);

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Rent A Car In Kenya | Premium Vehicle Rentals', margin, footerY);
  doc.text('Email: info@rentacarinkenya.com | Tel: +254 XXX XXX XXX', margin, footerY + 5);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 50, footerY);

  return doc.output('datauristring').split(',')[1];
}
