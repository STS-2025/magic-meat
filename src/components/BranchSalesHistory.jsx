import React, { useEffect, useState, useMemo } from 'react';
import {
  Eye,
  RefreshCw,
  Store,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Calendar,
  Download,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { fetchAllSales, fetchBranchStock, fetchStockMovements } from '../services/supabase.js';
import ReceiptModal from './ReceiptModal.jsx';
import { useToast } from './ToastProvider.jsx';

const INVOICES_PER_PAGE = 20;

export default function BranchSalesHistory({ branch }) {
  const toast = useToast();
  const [sales, setSales] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [stockMovements, setStockMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [invoicePage, setInvoicePage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const money = amount =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(Number(amount || 0));

  useEffect(() => {
    loadData();
  }, [branch?.id]);

  async function loadData() {
    if (!branch?.id) {
      setSales([]);
      setStockMap({});
      setStockMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [salesRes, stockRes, movementsRes] = await Promise.all([
      fetchAllSales({ branchId: branch.id }),
      fetchBranchStock(branch.id),
      fetchStockMovements({ branchId: branch.id })
    ]);
    setSales(salesRes.data || []);
    setError(salesRes.error || '');
    setStockMap(stockRes.data || {});
    setStockMovements(movementsRes.data || []);
    if (salesRes.error) {
      toast(`Could not load branch sales: ${salesRes.error}`, 'error');
    }
    setLoading(false);
  }

  // Filter sales based on date range
  const filteredSales = useMemo(() => {
    const now = new Date();
    let cutoff = new Date(0);

    if (dateRange === 'today') {
      cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
    } else if (dateRange === 'yesterday') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 1);
      cutoff.setHours(0, 0, 0, 0);
    } else if (dateRange === '7d') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
    } else if (dateRange === 'month') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return sales
      .filter(s => {
        const saleDate = new Date(s.created_at);
      if (dateRange === 'yesterday') {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        return saleDate >= cutoff && saleDate < end;
      }
      return saleDate >= cutoff;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [sales, dateRange]);

  const filteredStockMovements = useMemo(() => {
    const now = new Date();
    let cutoff = new Date(0);
    if (dateRange === 'today') cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (dateRange === 'yesterday') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return stockMovements.filter(m => new Date(m.created_at) >= cutoff && new Date(m.created_at) < end);
    } else if (dateRange === '7d') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === 'month') cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    return stockMovements.filter(m => new Date(m.created_at) >= cutoff);
  }, [stockMovements, dateRange]);
  const stockInGrams = filteredStockMovements.filter(m => Number(m.qty_grams) > 0).reduce((sum, m) => sum + Number(m.qty_grams), 0);
  const stockOutGrams = filteredStockMovements.filter(m => Number(m.qty_grams) < 0).reduce((sum, m) => sum + Math.abs(Number(m.qty_grams)), 0);

  const invoicePageCount = Math.max(1, Math.ceil(filteredSales.length / INVOICES_PER_PAGE));
  const visibleInvoicePage = Math.min(invoicePage, invoicePageCount);
  const paginatedSales = useMemo(() => {
    const start = (visibleInvoicePage - 1) * INVOICES_PER_PAGE;
    return filteredSales.slice(start, start + INVOICES_PER_PAGE);
  }, [filteredSales, visibleInvoicePage]);

  useEffect(() => {
    setInvoicePage(1);
  }, [dateRange, branch?.id]);

  useEffect(() => {
    setInvoicePage(currentPage => Math.min(currentPage, invoicePageCount));
  }, [invoicePageCount]);

  // Aggregate Metrics for this branch
  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const totalBills = filteredSales.length;
  const avgBillValue = totalBills > 0 ? (totalRevenue / totalBills).toFixed(0) : 0;

  const totalGramsSold = filteredSales.reduce((acc, s) => {
    const itemsWeight = (s.items || []).reduce((sum, it) => sum + (Number(it.qty_grams) || 0), 0);
    return acc + itemsWeight;
  }, 0);
  const totalKgSold = (totalGramsSold / 1000).toFixed(1);

  // Total Stock in Cold Storage
  const totalStockKg = Object.values(stockMap).reduce((acc, g) => acc + (Number(g) || 0), 0) / 1000;
  const lowStockCount = Object.values(stockMap).filter(g => Number(g) < 5000).length;

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const map = { cash: 0, upi: 0, card: 0, credit: 0 };
    filteredSales.forEach(s => {
      const mode = s.payment_method || 'cash';
      map[mode] = (map[mode] || 0) + Number(s.total_amount || 0);
    });
    return map;
  }, [filteredSales]);

  // CSV Export for this branch
  function exportCSV() {
    const headers = ['Record Type', 'Reference', 'Branch', 'Date & Time', 'Customer', 'Phone', 'Payment', 'Product', 'SKU', 'Category', 'Cut Style', 'Quantity (KG)', 'Unit Price (INR/KG)', 'Amount (INR)', 'Movement', 'Notes'];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const saleRows = filteredSales.flatMap(s => (s.items?.length ? s.items : [{}]).map(item => [
      'Sale', s.invoice_code || s.invoice_no, branch?.name || s.branch_name,
      new Date(s.created_at).toLocaleString('en-IN'), s.customer_name || 'Walk-in', s.customer_phone,
      s.payment_method, item.product_name, item.product_sku, item.category, item.cutting_style,
      (Number(item.qty_grams || 0) / 1000).toFixed(3), item.price_per_kg, item.line_total ?? s.total_amount, '', ''
    ]));
    const movementRows = filteredStockMovements.map(m => [
      'Stock Movement', m.reference_id || '', branch?.name || m.branch_name,
      new Date(m.created_at).toLocaleString('en-IN'), '', '', '', m.product_name, m.product_sku,
      m.category, '', (Math.abs(Number(m.qty_grams || 0)) / 1000).toFixed(3), '', '',
      Number(m.qty_grams) >= 0 ? 'Stock In' : 'Stock Out', m.notes
    ]);
    const csvContent = '\uFEFF' + [headers, ...saleRows, ...movementRows].map(row => row.map(quote).join(',')).join('\r\n');
    const encodedUri = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(branch?.name || 'branch').toLowerCase()}_sales_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
    toast('Branch sales report CSV downloaded.');
  }

  const rangeLabels = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7d': 'Last 7 Days',
    month: 'This Month',
    all: 'All Time'
  };

  return (
    <div className="admin-container branch-sales-history-page">
      {/* Top Header & Actions */}
      <div className="admin-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="admin-page-title">{branch?.name || 'Branch'} Process Dashboard</h1>
            <span className="badge-pill pill-green">
              <span className="pos-dot" style={{ width: 8, height: 8 }}></span> Live Counter
            </span>
          </div>
          <p className="admin-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <Store size={14} /> Branch Code: <strong>{branch?.code}</strong> · {branch?.address || 'Tamil Nadu'}
          </p>
        </div>

        <div className="admin-actions-bar history-actions-bar">
          <div className="filter-group">
            <Calendar size={16} className="filter-icon" />
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <button className="btn-secondary btn-sm" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>

          <button className="btn-secondary btn-sm" onClick={() => { loadData(); toast('Branch dashboard refreshed.'); }} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards for This Branch */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Branch Revenue</span>
            <div className="kpi-icon-wrap bg-emerald">
              <TrendingUp size={20} color="#10b981" />
            </div>
          </div>
          <div className="kpi-value">{money(totalRevenue)}</div>
          <div className="kpi-footer text-emerald">
            <ArrowUpRight size={14} /> {rangeLabels[dateRange]} Sales
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Bills Processed</span>
            <div className="kpi-icon-wrap bg-blue">
              <DollarSign size={20} color="#3b82f6" />
            </div>
          </div>
          <div className="kpi-value">{totalBills}</div>
          <div className="kpi-footer">Avg. {money(avgBillValue)} / bill</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Meat Dispatched</span>
            <div className="kpi-icon-wrap bg-amber">
              <Package size={20} color="#f59e0b" />
            </div>
          </div>
          <div className="kpi-value">{totalKgSold} kg</div>
          <div className="kpi-footer">Fresh butchery cuts</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Cold Storage Stock</span>
            <div className="kpi-icon-wrap bg-purple">
              <Layers size={20} color="#a855f7" />
            </div>
          </div>
          <div className="kpi-value">{totalStockKg.toFixed(1)} kg</div>
          <div className="kpi-footer">
            {lowStockCount > 0 ? (
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{lowStockCount} cuts low stock</span>
            ) : (
              'Live stock healthy'
            )}
          </div>
        </div>
      </div>

      <div className="admin-panel mt-4">
        <div className="panel-header-row">
          <div>
            <h2 className="panel-title">Stock In & Stock Out ({rangeLabels[dateRange]})</h2>
            <p className="admin-subtitle">Received stock and quantities deducted by sales</p>
          </div>
          <div className="record-count">In {(stockInGrams / 1000).toFixed(1)} kg · Out {(stockOutGrams / 1000).toFixed(1)} kg</div>
        </div>
        <div className="custom-table-wrap">
          <table className="custom-table">
            <thead><tr><th>Date & Time</th><th>Product</th><th>Movement</th><th>Quantity</th><th>Reference / Notes</th></tr></thead>
            <tbody>
              {filteredStockMovements.slice(0, 20).map(m => (
                <tr key={m.id}>
                  <td>{new Date(m.created_at).toLocaleString('en-IN')}</td>
                  <td>{m.product_name || 'Product'}</td>
                  <td><span className={`badge-pill ${Number(m.qty_grams) >= 0 ? 'pill-green' : 'pill-amber'}`}>{Number(m.qty_grams) >= 0 ? 'Stock In' : 'Stock Out'}</span></td>
                  <td>{(Math.abs(Number(m.qty_grams || 0)) / 1000).toFixed(3)} kg</td>
                  <td>{m.notes || m.reference_id || '—'}</td>
                </tr>
              ))}
              {!filteredStockMovements.length && <tr><td colSpan="5" className="text-center py-6 text-muted">No stock movements recorded for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branch Process Breakdown: Payment Collection & Cash Drawer Closing */}
      <div className="admin-split-grid">
        <div className="admin-panel">
          <h2 className="panel-title">Branch Payment Collections ({rangeLabels[dateRange]})</h2>
          <div className="payment-breakdown-grid">
            <div className="payment-tile">
              <span className="pay-tile-label">💵 Physical Cash</span>
              <div className="pay-tile-amount">{money(paymentBreakdown.cash)}</div>
              <small>{totalRevenue ? ((paymentBreakdown.cash / totalRevenue) * 100).toFixed(0) : 0}% of sales</small>
            </div>
            <div className="payment-tile">
              <span className="pay-tile-label">📱 UPI / QR Scans</span>
              <div className="pay-tile-amount">{money(paymentBreakdown.upi)}</div>
              <small>{totalRevenue ? ((paymentBreakdown.upi / totalRevenue) * 100).toFixed(0) : 0}% of sales</small>
            </div>
            <div className="payment-tile">
              <span className="pay-tile-label">💳 Card Swipes</span>
              <div className="pay-tile-amount">{money(paymentBreakdown.card)}</div>
              <small>{totalRevenue ? ((paymentBreakdown.card / totalRevenue) * 100).toFixed(0) : 0}% of sales</small>
            </div>
          </div>
        </div>

        <div className="admin-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 className="panel-title">Shift Cash Drawer Closing ({rangeLabels[dateRange]})</h2>
            <div className="closing-banner" style={{ margin: 0 }}>
              <Sparkles size={20} color="#10b981" />
              <div>
                <strong>Physical Cash in Register: {money(paymentBreakdown.cash)}</strong>
                <p>Verify physical cash counted in the drawer against this tally before closing the shift.</p>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '16px', fontSize: '12px', color: '#64748b' }}>
            <span>Active Counter: <strong>{branch?.name} ({branch?.code})</strong></span>
          </div>
        </div>
      </div>

      {/* Invoices & Sales Ledger Table */}
      <div className="admin-panel mt-4">
        <div className="panel-header-row">
          <div>
            <h2 className="panel-title">Invoices & Sales Ledger ({rangeLabels[dateRange]})</h2>
            <p className="admin-subtitle">Showing {filteredSales.length} bills processed at {branch?.name}</p>
          </div>
          <span className="record-count">{filteredSales.length} Transactions</span>
        </div>
        <div className="custom-table-wrap">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Items & Cuts</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.map(sale => (
                <tr key={sale.id}>
                  <td className="font-mono font-bold text-emerald">
                    {sale.invoice_code || `MM-${sale.invoice_no}`}
                  </td>
                  <td>{new Date(sale.created_at).toLocaleString('en-IN')}</td>
                  <td>
                    <div>
                      <strong>{sale.customer_name || 'Walk-in Customer'}</strong>
                      {sale.customer_phone && (
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                          {sale.customer_phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span>{(sale.items || []).length} items</span>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px' }}>
                      {(sale.items || []).map(i => i.product_name).slice(0, 2).join(', ')}
                      {(sale.items || []).length > 2 ? '…' : ''}
                    </small>
                  </td>
                  <td><span className={`payment-pill pill-${sale.payment_method}`}>{sale.payment_method}</span></td>
                  <td className="font-bold">{money(sale.total_amount)}</td>
                  <td>
                    <button className="btn-icon-subtle" onClick={() => setSelectedReceipt(sale)}>
                      <Eye size={15} /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredSales.length === 0 && !error && (
                <tr>
                  <td colSpan="7" className="text-center py-6 text-muted">
                    No sales recorded for this branch in the selected period.
                  </td>
                </tr>
              )}
              {loading && (
                <tr><td colSpan="7" className="text-center py-6 text-muted">Loading branch sales…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredSales.length > 0 && (
          <div className="invoice-pagination" aria-label="Invoice pagination">
            <span className="invoice-pagination-count">
              Showing {(visibleInvoicePage - 1) * INVOICES_PER_PAGE + 1}-{Math.min(visibleInvoicePage * INVOICES_PER_PAGE, filteredSales.length)} of {filteredSales.length} transactions
            </span>
            <div className="invoice-pagination-controls">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setInvoicePage(page => Math.max(1, page - 1))}
                disabled={visibleInvoicePage === 1}
              >
                Previous
              </button>
              <span className="invoice-pagination-page">Page {visibleInvoicePage} of {invoicePageCount}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setInvoicePage(page => Math.min(invoicePageCount, page + 1))}
                disabled={visibleInvoicePage === invoicePageCount}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedReceipt && (
        <ReceiptModal
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
          sale={selectedReceipt}
          branch={branch}
        />
      )}
    </div>
  );
}
