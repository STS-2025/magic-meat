import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, CheckCircle, X, Download, Share2 } from 'lucide-react';
import JsBarcode from 'jsbarcode';

export default function ReceiptModal({ isOpen, onClose, sale, branch }) {
  const barcodeRef = useRef(null);
  const invoiceBarcode = sale ? String(sale.invoice_code || sale.invoice_no || '') : '';

  useEffect(() => {
    if (!isOpen || !invoiceBarcode || !barcodeRef.current) return;

    JsBarcode(barcodeRef.current, invoiceBarcode, {
      format: 'CODE128',
      lineColor: '#000000',
      background: '#ffffff',
      width: 1.25,
      height: 42,
      displayValue: false,
      margin: 0
    });
  }, [isOpen, invoiceBarcode]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  const formatWeight = grams => {
    const g = Number(grams) || 0;
    if (g >= 1000) {
      return (g / 1000).toFixed(g % 1000 === 0 ? 1 : 2) + ' kg';
    }
    return g + ' g';
  };

  const branchAddress = branch?.address || 'Chennai, Tamil Nadu';
  const branchPhone = branch?.phone || '+91 98401 22334';
  const branchName = branch?.name || sale.branch_name || 'Main Branch';

  const dateDisplay = sale.created_at
    ? new Date(sale.created_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return createPortal(
    <div className="modal-backdrop receipt-modal-backdrop">
      <div className="modal-content receipt-modal-content">
        <div className="receipt-actions-top no-print">
          <div className="receipt-status-badge">
            <CheckCircle size={18} className="text-emerald" />
            <span>Bill Generated Successfully</span>
          </div>
          <div className="receipt-btns">
            <button className="btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> Print Receipt
            </button>
            <button className="icon-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt (Formatted specifically for 80mm thermal roll printers) */}
        <div className="thermal-receipt" id="printable-receipt">
          <div className="receipt-header">
            <div className="receipt-logo">
              <img src="/magic-meat-logo.png" alt="" />
              <span>MAGIC MEAT</span>
            </div>
            <div className="receipt-tagline">Tender · Fresh · Hygienic Cuts</div>
            <div className="receipt-branch-name">{branchName}</div>
            <div className="receipt-meta-line">{branchAddress}</div>
            <div className="receipt-meta-line">Tel: {branchPhone}</div>
            <div className="receipt-meta-line">FSSAI Lic: 12423001000542</div>
          </div>

          <div className="receipt-divider">--------------------------------</div>

          <div className="receipt-info-grid">
            <div className="info-row">
              <span>Invoice:</span>
              <strong>{sale.invoice_code || `MM-${sale.invoice_no}`}</strong>
            </div>
            <div className="info-row">
              <span>Date & Time:</span>
              <span>{dateDisplay}</span>
            </div>
            <div className="info-row">
              <span>Cashier:</span>
              <span>{sale.cashier_name || 'Staff'}</span>
            </div>
            {sale.customer_name && (
              <div className="info-row">
                <span>Customer:</span>
                <span>{sale.customer_name} {sale.customer_phone ? `(${sale.customer_phone})` : ''}</span>
              </div>
            )}
          </div>

          <div className="receipt-divider">--------------------------------</div>

          <table className="receipt-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Item / Cut</th>
                <th style={{ textAlign: 'center' }}>Weight</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(sale.items || []).map((it, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="receipt-item-name">{it.product_name}</div>
                    {it.cutting_style && (
                      <div className="receipt-item-cut">[{it.cutting_style}]</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>{formatWeight(it.qty_grams)}</td>
                  <td style={{ textAlign: 'right' }}>₹{it.price_per_kg}</td>
                  <td style={{ textAlign: 'right' }}>{money(it.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-divider">--------------------------------</div>

          <div className="receipt-totals">
            <div className="total-row">
              <span>Total Items:</span>
              <span>{(sale.items || []).length} items</span>
            </div>
            <div className="total-row">
              <span>Subtotal:</span>
              <span>{money(sale.subtotal || sale.total_amount)}</span>
            </div>
            <div className="total-row">
              <span>GST (0% Exempted Meat):</span>
              <span>₹0.00</span>
            </div>
            <div className="total-row grand-total">
              <span>NET TOTAL:</span>
              <strong>{money(sale.total_amount)}</strong>
            </div>
          </div>

          <div className="receipt-divider">--------------------------------</div>

          <div className="receipt-payment-info">
            <div className="info-row">
              <span>Payment Mode:</span>
              <strong className="text-uppercase">{sale.payment_method}</strong>
            </div>
            {sale.payment_method === 'cash' && (
              <>
                <div className="info-row">
                  <span>Cash Received:</span>
                  <span>{money(sale.tendered_amount || sale.total_amount)}</span>
                </div>
                <div className="info-row">
                  <span>Change Given:</span>
                  <span>{money(sale.change_amount || 0)}</span>
                </div>
              </>
            )}
          </div>
          <div className="receipt-divider">--------------------------------</div>

          <div className="receipt-footer">
            <p>Thank You For Choosing MAGIC MEAT!</p>
            <p className="visit-again">★ VISIT AGAIN ★</p>
          </div>
        </div>

        <div className="receipt-actions-bottom no-print">
          <button className="btn-secondary" onClick={onClose}>
            Close & Start Next Bill
          </button>
          <button className="btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print Thermal Bill
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
