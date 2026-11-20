import React, { useState, useEffect } from 'react';
import { Package, Plus, AlertTriangle, ArrowDownLeft, Store, RefreshCw } from 'lucide-react';
import { fetchProducts, fetchBranchStock, addStockRecord } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';

export default function InventoryManager({ branches }) {
  const toast = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState(branches?.[0]?.id || '');
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showInwardModal, setShowInwardModal] = useState(false);

  // Inward form
  const [inwardProduct, setInwardProduct] = useState('');
  const [inwardKg, setInwardKg] = useState('');
  const [inwardNotes, setInwardNotes] = useState('Farm/Vendor Delivery');

  const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches]);

  useEffect(() => {
    if (selectedBranchId) {
      loadInventory();
    }
  }, [selectedBranchId]);

  async function loadInventory() {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      fetchProducts(selectedBranchId),
      fetchBranchStock(selectedBranchId)
    ]);
    setProducts(pRes.data || []);
    setStockMap(sRes.data || {});
    setLoading(false);
  }

  async function handleInwardStock(e) {
    e.preventDefault();
    if (!selectedBranchId || !inwardProduct || !inwardKg) return;

    const qtyGrams = Math.round(Number(inwardKg) * 1000);
    const res = await addStockRecord({
      branchId: selectedBranchId,
      productId: inwardProduct,
      qtyGrams,
      notes: inwardNotes
    });

    if (res.success) {
      setShowInwardModal(false);
      setInwardKg('');
      setInwardNotes('Farm/Vendor Delivery');
      loadInventory();
      toast(`Successfully added ${inwardKg} kg stock inward!`);
    } else {
      toast('Could not save stock: ' + (res.error || 'Unknown error'), 'error');
    }
  }

  const selectedBranch = branches?.find(b => b.id === selectedBranchId) || branches?.[0];

  // Total stock calculation
  const totalStockKg = Object.values(stockMap).reduce((acc, g) => acc + (Number(g) || 0), 0) / 1000;

  return (
    <div className="admin-container">
      <div className="admin-header-row inventory-header-row">
        <div>
          <h1 className="admin-page-title">Branch Stock & Meat Inventory</h1>
          <p className="admin-subtitle">Live weighment inventory and farm inward records</p>
        </div>

        <div className="admin-actions-bar inventory-actions-bar">
          <div className="filter-group">
            <Store size={16} className="filter-icon" />
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
            >
              {branches?.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <button className="btn-primary" onClick={() => setShowInwardModal(true)}>
            <ArrowDownLeft size={16} /> Inward Stock (+KG)
          </button>
        </div>
      </div>

      {/* Stock summary cards */}
      <div className="kpi-grid mt-4">
        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Active Branch Counter</span>
            <div className="kpi-icon-wrap bg-emerald">
              <Store size={20} color="#10b981" />
            </div>
          </div>
          <div className="kpi-value text-emerald">{selectedBranch?.name}</div>
          <div className="kpi-footer">{selectedBranch?.address}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Total Cold-Storage Stock</span>
            <div className="kpi-icon-wrap bg-amber">
              <Package size={20} color="#f59e0b" />
            </div>
          </div>
          <div className="kpi-value">{totalStockKg.toFixed(1)} kg</div>
          <div className="kpi-footer">Across all cut varieties</div>
        </div>
      </div>

      {/* Inventory table */}
      <div className="admin-panel mt-4">
        <div className="panel-header-row inventory-panel-header">
          <h2 className="panel-title">Stock Matrix · {selectedBranch?.name}</h2>
          <button className="btn-secondary btn-sm" onClick={loadInventory}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="custom-table-wrap">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Product SKU</th>
                <th>Meat Variety & Cut</th>
                <th>Category</th>
                <th>Price / KG</th>
                <th>Current Stock (KG)</th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const grams = stockMap[p.id] || 0;
                const kg = (grams / 1000).toFixed(2);
                const isLow = grams < 5000;
                const isOut = grams <= 0;

                return (
                  <tr key={p.id}>
                    <td className="font-mono text-muted">{p.sku}</td>
                    <td>
                      <strong>{p.name}</strong>
                      {p.tamil_name && <span className="tamil-sub">{p.tamil_name}</span>}
                    </td>
                    <td>
                      <span className="cat-badge">{p.category}</span>
                    </td>
                    <td>{money(p.price_per_kg)}</td>
                    <td className="font-bold font-mono">
                      <span className={isLow ? 'text-red font-bold' : 'text-emerald'}>
                        {kg} kg
                      </span>
                    </td>
                    <td>
                      {isOut ? (
                        <span className="badge-pill pill-red">Out of Stock</span>
                      ) : isLow ? (
                        <span className="badge-pill pill-amber">
                          <AlertTriangle size={12} /> Low Stock (&lt;5kg)
                        </span>
                      ) : (
                        <span className="badge-pill pill-green">In Stock</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn-outline btn-sm"
                        onClick={() => {
                          setInwardProduct(p.id);
                          setShowInwardModal(true);
                        }}
                      >
                        + Add Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inward Modal */}
      {showInwardModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Inward Stock Received at Branch</h2>
              <button className="icon-btn" onClick={() => setShowInwardModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleInwardStock}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Receiving Branch *</label>
                  <select
                    value={selectedBranchId}
                    onChange={e => setSelectedBranchId(e.target.value)}
                  >
                    {branches?.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Select Meat Product *</label>
                  <select
                    required
                    value={inwardProduct}
                    onChange={e => setInwardProduct(e.target.value)}
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category}) - ₹{p.price_per_kg}/kg
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Received Weight (in KG) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="e.g. 50.0 (adds 50,000 grams)"
                    value={inwardKg}
                    onChange={e => setInwardKg(e.target.value)}
                  />
                  <small className="form-hint">
                    1 KG = 1,000 grams automatically converted in database.
                  </small>
                </div>

                <div className="form-group">
                  <label>Supplier / Delivery Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Namakkal Poultry Delivery #104"
                    value={inwardNotes}
                    onChange={e => setInwardNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowInwardModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Inward & Add Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
