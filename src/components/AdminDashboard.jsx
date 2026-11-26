import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Store,
  DollarSign,
  Package,
  Calendar,
  Filter,
  Download,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Layers,
  Sparkles
} from 'lucide-react';
import { fetchAllSales, fetchProducts, fetchBranchStock, fetchStockMovements } from '../services/supabase.js';
import ReceiptModal from './ReceiptModal.jsx';
import { useToast } from './ToastProvider.jsx';

export default function AdminDashboard({ branches, profile, branch }) {
  const navigate = useNavigate();
  const toast = useToast();
  const isOwner = profile?.role === 'owner';
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchStock, setBranchStock] = useState({});
  const [stockMovements, setStockMovements] = useState([]);
  const [dateRange, setDateRange] = useState('today');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [salesError, setSalesError] = useState('');
  const [salesSource, setSalesSource] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [invoicePage, setInvoicePage] = useState(1);

  const INVOICES_PER_PAGE = 20;

  const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  useEffect(() => {
    loadData(true);
    const interval = window.setInterval(() => loadData(), 15000);
    return () => window.clearInterval(interval);
  }, [isOwner, branch?.id]);

  async function loadData(initialLoad = false) {
    if (initialLoad) setLoading(true);
    else setRefreshing(false);

    if (!isOwner && !branch?.id) {
      setSales([]);
      setProducts([]);
      setBranchStock({});
      setStockMovements([]);
      setLoading(false);
      return;
    }

    try {
      const [salesRes, prodRes, stockRes, movementsRes] = await Promise.all([
        fetchAllSales(isOwner ? {} : { branchId: branch.id }),
        fetchProducts(isOwner ? undefined : branch.id),
        isOwner ? Promise.resolve({ data: {} }) : fetchBranchStock(branch.id),
        fetchStockMovements(isOwner ? {} : { branchId: branch.id })
      ]);
      setSales(salesRes.data || []);
      setSalesError(salesRes.error || '');
      setSalesSource(salesRes.source || '');
      setProducts(prodRes.data || []);
      setBranchStock(stockRes.data || {});
      setStockMovements(movementsRes.data || []);
      if (salesRes.error) {
        toast(`Could not load sales: ${salesRes.error}`, 'error');
      } else if (!initialLoad) {
        toast('');
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unable to load sales.';
      setSalesError(errMsg);
      toast(`Sales data error: ${errMsg}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Filter sales based on date range and branch
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
      const matchesDate = dateRange === 'yesterday'
        ? saleDate >= cutoff && saleDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : saleDate >= cutoff;
      const matchesBranch = !isOwner || selectedBranchFilter === 'all' || s.branch_id === selectedBranchFilter;
      return matchesDate && matchesBranch;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [sales, dateRange, selectedBranchFilter, isOwner]);

  const filteredStockMovements = useMemo(() => {
    const now = new Date();
    let cutoff = new Date(0);
    if (dateRange === 'today') cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (dateRange === 'yesterday') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return stockMovements.filter(m => {
        const date = new Date(m.created_at);
        return date >= cutoff && date < end && (!isOwner || selectedBranchFilter === 'all' || m.branch_id === selectedBranchFilter);
      });
    } else if (dateRange === '7d') cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (dateRange === 'month') cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    return stockMovements.filter(m =>
      new Date(m.created_at) >= cutoff &&
      (!isOwner || selectedBranchFilter === 'all' || m.branch_id === selectedBranchFilter)
    );
  }, [stockMovements, dateRange, selectedBranchFilter, isOwner]);

  const stockInGrams = filteredStockMovements.filter(m => Number(m.qty_grams) > 0)
    .reduce((sum, m) => sum + Number(m.qty_grams), 0);
  const invoicePageCount = Math.max(1, Math.ceil(filteredSales.length / INVOICES_PER_PAGE));
  const visibleInvoicePage = Math.min(invoicePage, invoicePageCount);
  const paginatedSales = useMemo(() => {
    const start = (visibleInvoicePage - 1) * INVOICES_PER_PAGE;
    return filteredSales.slice(start, start + INVOICES_PER_PAGE);
  }, [filteredSales, visibleInvoicePage]);

  useEffect(() => {
    setInvoicePage(1);
  }, [dateRange, selectedBranchFilter, branch?.id]);

  useEffect(() => {
    setInvoicePage(currentPage => Math.min(currentPage, invoicePageCount));
  }, [invoicePageCount]);

  // Aggregate Metrics
  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const totalBills = filteredSales.length;
  const avgBillValue = totalBills > 0 ? totalRevenue / totalBills : 0;

  // Total weight sold
  const totalGramsSold = filteredSales.reduce((acc, s) => {
    const itemsWeight = (s.items || []).reduce((sum, it) => sum + (Number(it.qty_grams) || 0), 0);
    return acc + itemsWeight;
  }, 0);
  const totalKgSold = (totalGramsSold / 1000).toFixed(1);
  const totalStorageKg = Object.values(branchStock)
    .reduce((sum, grams) => sum + (Number(grams) || 0), 0) / 1000;

  function scrollToSection(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Branch-wise aggregation
  const branchStats = useMemo(() => {
    if (!branches) return [];
    return branches.map(b => {
      const bSales = filteredSales.filter(s => s.branch_id === b.id);
      const bTotal = bSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      const bGrams = bSales.reduce(
        (acc, s) => acc + (s.items || []).reduce((sum, it) => sum + (Number(it.qty_grams) || 0), 0),
        0
      );
      const share = totalRevenue > 0 ? (bTotal / totalRevenue) * 100 : 0;
      const bCash = bSales
        .filter(s => s.payment_method === 'cash')
        .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      const bUpi = bSales
        .filter(s => s.payment_method === 'upi')
        .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
      const bCard = bSales
        .filter(s => s.payment_method === 'card')
        .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);

      return {
        ...b,
        bills: bSales.length,
        total: bTotal,
        kgSold: (bGrams / 1000).toFixed(1),
        share: share.toFixed(1),
        cash: bCash,
        upi: bUpi,
        card: bCard
      };
    });
  }, [branches, filteredSales, totalRevenue]);

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const map = { cash: 0, upi: 0, card: 0, credit: 0 };
    filteredSales.forEach(s => {
      const mode = s.payment_method || 'cash';
      map[mode] = (map[mode] || 0) + Number(s.total_amount || 0);
    });
    return map;
  }, [filteredSales]);

  // CSV Export
  function exportCSV() {
    const headers = ['Record Type', 'Reference', 'Branch', 'Date & Time', 'Customer', 'Phone', 'Payment', 'Product', 'SKU', 'Category', 'Cut Style', 'Quantity (KG)', 'Unit Price (INR/KG)', 'Amount (INR)', 'Movement', 'Notes'];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const salesRows = filteredSales.flatMap(s => (s.items?.length ? s.items : [{}]).map(item => [
      'Sale', s.invoice_code || s.invoice_no, s.branch_name, new Date(s.created_at).toLocaleString('en-IN'),
      s.customer_name || 'Walk-in', s.customer_phone, s.payment_method,
      item.product_name || products.find(p => p.id === item.product_id)?.name,
      item.product_sku || products.find(p => p.id === item.product_id)?.sku,
      item.category || products.find(p => p.id === item.product_id)?.category,
      item.cutting_style, (Number(item.qty_grams || 0) / 1000).toFixed(3), item.price_per_kg,
      item.line_total ?? s.total_amount, '', ''
    ]));
    const movementRows = filteredStockMovements.map(m => [
      'Stock Movement', m.reference_id || '', m.branch_name, new Date(m.created_at).toLocaleString('en-IN'),
      '', '', '', m.product_name, m.product_sku, m.category, '', (Math.abs(Number(m.qty_grams || 0)) / 1000).toFixed(3),
      '', '', Number(m.qty_grams) >= 0 ? 'Stock In' : 'Stock Out', m.notes
    ]);
    const csvContent = '\uFEFF' + [headers, ...salesRows, ...movementRows].map(row => row.map(quote).join(',')).join('\r\n');
    const encodedUri = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `magic_meat_sales_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(encodedUri);
    toast('Sales report CSV downloaded successfully.');
  }

  return (
    <div className="admin-container">
      {/* Top Controls & Filters */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">
            {isOwner ? 'Executive Sales Overview' : `${branch?.name || 'Branch'} Process Dashboard`}
          </h1>
          <p className="admin-subtitle">
            {isOwner
              ? 'Live analytics across all Magic Meat retail outlets'
              : `Live sales and operations for ${branch?.name || 'your assigned branch'}${branch?.code ? ` · ${branch.code}` : ''}`}
          </p>
        </div>

        <div className={`admin-actions-bar dashboard-actions-bar ${isOwner ? '' : 'branch-dashboard-actions-bar'}`}>
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

          {isOwner && (
            <div className="filter-group">
              <Store size={16} className="filter-icon" />
              <select
                value={selectedBranchFilter}
                onChange={e => setSelectedBranchFilter(e.target.value)}
              >
                <option value="all">All Branches ({branches?.length || 0})</option>
                {branches?.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className="btn-secondary btn-sm" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
          
        </div>
      </div>

      {/* KPI Cards */}
      <div className={`kpi-grid ${isOwner ? '' : 'branch-kpi-grid'}`}>
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">{isOwner ? 'Total Revenue' : 'Branch Revenue'}</span>
            <div className="kpi-icon-wrap bg-emerald">
              <TrendingUp size={20} color="#10b981" />
            </div>
          </div>
          <div className="kpi-value">{money(totalRevenue)}</div>
          <div className="kpi-footer text-emerald">
            <ArrowUpRight size={14} /> Active Period Sales
          </div>
        </div>

        <button type="button" className="kpi-card kpi-card-action" onClick={() => scrollToSection('sales-ledger')}>
          <div className="kpi-top">
            <span className="kpi-label">Bills Count</span>
            <div className="kpi-icon-wrap bg-blue">
              <DollarSign size={20} color="#3b82f6" />
            </div>
          </div>
          <div className="kpi-value">{totalBills}</div>
          <div className="kpi-footer">Avg. {money(avgBillValue)} / bill</div>
        </button>

        <button type="button" className="kpi-card kpi-card-action" onClick={() => navigate('/inventory?view=out')}>
          <div className="kpi-top">
            <span className="kpi-label">Total Meat Sold</span>
            <div className="kpi-icon-wrap bg-amber">
              <Package size={20} color="#f59e0b" />
            </div>
          </div>
          <div className="kpi-value">{totalKgSold} kg</div>
          <div className="kpi-footer">Across all fresh cuts</div>
        </button>

        {!isOwner && <button type="button" className="kpi-card kpi-card-action" onClick={() => navigate('/inventory')}>
          <div className="kpi-top">
            <span className="kpi-label">Total in Storage</span>
            <div className="kpi-icon-wrap bg-blue">
              <Package size={20} color="#3b82f6" />
            </div>
          </div>
          <div className="kpi-value">{totalStorageKg.toFixed(1)} kg</div>
          <div className="kpi-footer">Current stock across all cuts</div>
        </button>}

        {isOwner && <button type="button" className="kpi-card kpi-card-action" onClick={() => navigate('/inventory?view=in')}>
          <div className="kpi-top">
            <span className="kpi-label">Total Stock In</span>
            <div className="kpi-icon-wrap bg-blue">
              <Layers size={20} color="#3b82f6" />
            </div>
          </div>
          <div className="kpi-value">{(stockInGrams / 1000).toFixed(1)} kg</div>
          <div className="kpi-footer">Received in active period</div>
        </button>}

        {isOwner && <button type="button" className="kpi-card kpi-card-action" onClick={() => navigate('/branches')}>
          <div className="kpi-top">
            <span className="kpi-label">Active Branches</span>
            <div className="kpi-icon-wrap bg-purple">
              <Store size={20} color="#a855f7" />
            </div>
          </div>
          <div className="kpi-value">{branches?.filter(b => b.is_active).length || 0}</div>
          <div className="kpi-footer">Tamil Nadu Network</div>
        </button>}
      </div>

      {/* Each Branch Live Process & Operations Tracker */}
      {isOwner && (
      <div className="admin-panel mb-6">
        <div className="panel-header-row">
          <div>
            <h2 className="panel-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Store size={18} color="#10b981" />
              <span>Each Branch Live Process & Operations</span>
            </h2>
            <p className="admin-subtitle" style={{ marginTop: '4px' }}>
              Real-time sales, order throughput, and cash flow across each retail branch
            </p>
          </div>
          {selectedBranchFilter !== 'all' && (
            <button
              className="btn-secondary btn-sm"
              onClick={() => setSelectedBranchFilter('all')}
            >
              Show All Branches
            </button>
          )}
        </div>

        <div className="branch-process-grid mt-4">
          {branchStats.map(b => {
            const isSelected = selectedBranchFilter === b.id;
            return (
              <div
                key={b.id}
                className={`branch-process-card ${isSelected ? 'active-filter' : ''}`}
              >
                <div className="branch-process-header">
                  <div>
                    <div className="branch-process-title">
                      <Store size={18} color="#10b981" />
                      <span>{b.name}</span>
                      <span className="branch-code-tag">{b.code}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {b.address || 'Retail Outlet'}
                    </span>
                  </div>
                  <span className="branch-process-status">
                    <span className="pos-dot" style={{ width: 8, height: 8 }}></span>
                    Live Counter
                  </span>
                </div>

                <div className="branch-process-metrics">
                  <div className="process-metric-item">
                    <span className="process-metric-label">Sales</span>
                    <strong className="process-metric-val">{money(b.total)}</strong>
                  </div>
                  <div className="process-metric-item">
                    <span className="process-metric-label">Bills</span>
                    <strong className="process-metric-val">{b.bills}</strong>
                  </div>
                  <div className="process-metric-item">
                    <span className="process-metric-label">Meat Sold</span>
                    <strong className="process-metric-val">{b.kgSold} kg</strong>
                  </div>
                </div>

                {/* Progress bar of revenue share */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                    <span>Network Revenue Share</span>
                    <strong>{b.share}%</strong>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.max(5, Number(b.share))}%` }}
                    ></div>
                  </div>
                </div>

                {/* Payment breakdown for this branch */}
                <div className="branch-process-payments">
                  <span className="branch-pay-tag">💵 Cash: {money(b.cash)}</span>
                  <span className="branch-pay-tag">📱 UPI: {money(b.upi)}</span>
                  <span className="branch-pay-tag">💳 Card: {money(b.card)}</span>
                </div>

                <div className="branch-process-footer">
                  <button
                    className={`btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setSelectedBranchFilter(isSelected ? 'all' : b.id)}
                  >
                    {isSelected ? '✓ Showing This Branch (Reset)' : `View ${b.name} Process Invoices`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Split Row: Branch Sales & Payment Channels */}
      <div className={isOwner ? 'admin-split-grid' : ''}>
        {/* Branch-wise breakdown */}
        {isOwner && (
        <div className="admin-panel">
          <h2 className="panel-title">Branch-wise Sales Performance</h2>
          <div className="branch-bars-list">
            {branchStats.map(b => (
              <div key={b.id} className="branch-stat-item">
                <div className="stat-item-header">
                  <div>
                    <strong>{b.name}</strong>
                    <span className="branch-code-tag">{b.code}</span>
                  </div>
                  <div className="stat-amounts">
                    <strong>{money(b.total)}</strong>
                    <span className="stat-bills-count">({b.bills} bills · {b.kgSold} kg)</span>
                  </div>
                </div>

                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.max(5, Number(b.share))}%` }}
                  ></div>
                </div>
                <div className="share-text">{b.share}% of network sales</div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Payment Channels & Closing Summary */}
        <div className="admin-panel">
          <h2 className="panel-title">{isOwner ? 'Payment Collection Breakdown' : `Branch Payment Collections (${dateRange})`}</h2>
          <div className="payment-breakdown-grid">
            <div className="payment-tile">
              <span className="pay-tile-label">💵 Cash Collected</span>
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

          <div className="closing-banner">
            <Sparkles size={18} color="#10b981" />
            <div>
              <strong>Instant Daily Cash Drawer Closing</strong>
              <p>{isOwner ? 'Physical cash to collect at counters today:' : 'Physical cash in this branch register:'} <b>{money(paymentBreakdown.cash)}</b></p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales Ledger Table */}
      <div id="sales-ledger" className="admin-panel mt-4">
        <div className="panel-header-row">
          <h2 className="panel-title">Recent Invoices & Sales Ledger</h2>
          <span className="record-count">{filteredSales.length} Transactions</span>
        </div>

        <div className="custom-table-wrap">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Branch</th>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Items & Cuts</th>
                <th>Payment</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.map(s => (
                <tr key={s.id}>
                  <td className="font-mono font-bold text-emerald">
                    {s.invoice_code || `MM-${s.invoice_no}`}
                  </td>
                  <td>{s.branch_name || 'Branch'}</td>
                  <td>
                    {new Date(s.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>{s.customer_name || 'Walk-in Customer'}</td>
                  <td>
                    <span className="items-summary-badge">
                      {(s.items || []).length} items (
                      {(
                        (s.items || []).reduce((acc, it) => acc + (Number(it.qty_grams) || 0), 0) /
                        1000
                      ).toFixed(1)}{' '}
                      kg)
                    </span>
                  </td>
                  <td>
                    <span className={`payment-pill pill-${s.payment_method}`}>
                      {s.payment_method}
                    </span>
                  </td>
                  <td className="font-bold">{money(s.total_amount)}</td>
                  <td>
                    <button
                      className="btn-icon-subtle"
                      title="View & Reprint Receipt"
                      onClick={() => setSelectedReceipt(s)}
                    >
                      <Eye size={15} /> Receipt
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan="8" className="text-center py-6 text-muted">
                    No sales recorded for the selected period.
                  </td>
                </tr>
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

      {/* Receipt Modal for any selected sale */}
      {selectedReceipt && (
        <ReceiptModal
          isOpen={true}
          onClose={() => setSelectedReceipt(null)}
          sale={selectedReceipt}
          branch={branches?.find(b => b.id === selectedReceipt.branch_id)}
        />
      )}
    </div>
  );
}
