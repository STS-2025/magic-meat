import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Check, X, Search, Sparkles, Tag } from 'lucide-react';
import { fetchProducts, createProductRecord, updateProductPriceRecord } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';

export default function ProductManager({ branches, activeBranch }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(activeBranch?.id || '');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    tamil_name: '',
    category: 'Chicken',
    unit: 'kg',
    price_per_kg: ''
  });

  const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  useEffect(() => {
    if (activeBranch?.id) setSelectedBranchId(activeBranch.id);
  }, [activeBranch?.id]);

  useEffect(() => {
    loadProducts(selectedBranchId);
  }, [selectedBranchId]);

  async function loadProducts(branchId = selectedBranchId) {
    setLoading(true);
    const res = await fetchProducts(branchId);
    setProducts(res.data || []);
    setLoading(false);
  }

  async function handlePriceSave(productId) {
    if (!newPrice || isNaN(newPrice) || Number(newPrice) <= 0) return;
    const res = await updateProductPriceRecord(productId, Number(newPrice));
    if (!res.success) {
      toast('Could not save product price: ' + (res.error || 'Unknown error'), 'error');
      return;
    }
    setEditingId(null);
    setNewPrice('');
    loadProducts();
    toast('Product price updated.');
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    if (!formData.name || !formData.price_per_kg) return;

    const res = await createProductRecord({
      sku: formData.sku || `MM-${Date.now().toString().slice(-4)}`,
      name: formData.name,
      tamil_name: formData.tamil_name,
      category: formData.category,
      unit: formData.unit || 'kg',
      price_per_kg: Number(formData.price_per_kg),
      branch_id: selectedBranchId || null,
      is_active: true
    });
    if (!res.success) {
      toast('Could not save product: ' + (res.error || 'Unknown error'), 'error');
      return;
    }

    setShowAddModal(false);
    setFormData({
      sku: '',
      name: '',
      tamil_name: '',
      category: 'Chicken',
      unit: 'kg',
      price_per_kg: ''
    });
    loadProducts();
    toast('Product created successfully.');
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.tamil_name && p.tamil_name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-container">
      <div className="admin-header-row product-header-row">
        <div className="product-heading">
          <h1 className="admin-page-title">Meat Catalogue & Daily Market Rates</h1>
          <p className="admin-subtitle">Update chicken, mutton, and seafood rates per KG</p>
        </div>

        <div className="admin-actions-bar product-actions-bar">
          <div className="product-header-controls">
            <div className="filter-group">
              <Package size={16} className="filter-icon" />
              <select
                aria-label="Product branch"
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
              >
                {branches?.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Add Meat Product
            </button>
          </div>
          <div className="search-bar-wrap product-header-search">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="admin-panel mt-4">
        <div className="custom-table-wrap">
          <table className="custom-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name & Cut</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Price / KG</th>
                <th>Status</th>
                <th>Quick Rate Update</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-muted">{p.sku || '-'}</td>
                  <td>
                    <strong>{p.name}</strong>
                    {p.tamil_name && <span className="tamil-sub">{p.tamil_name}</span>}
                  </td>
                  <td>
                    <span className="cat-badge">{p.category}</span>
                  </td>
                  <td>{p.unit || 'kg'}</td>
                  <td className="font-bold text-emerald">{money(p.price_per_kg)}</td>
                  <td>
                    <span className="badge-pill pill-green">Active</span>
                  </td>
                  <td>
                    {editingId === p.id ? (
                      <div className="inline-edit-group">
                        <span>₹</span>
                        <input
                          type="number"
                          autoFocus
                          value={newPrice}
                          onChange={e => setNewPrice(e.target.value)}
                          placeholder={p.price_per_kg}
                          className="inline-rate-input"
                        />
                        <button
                          className="btn-icon-save"
                          onClick={() => handlePriceSave(p.id)}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="btn-icon-cancel"
                          onClick={() => setEditingId(null)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn-outline btn-sm"
                        onClick={() => {
                          setEditingId(p.id);
                          setNewPrice(String(p.price_per_kg));
                        }}
                      >
                        <Edit2 size={13} /> Change Rate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="modal-backdrop product-modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add New Meat Product</h2>
              <button className="icon-btn" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddProduct}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Product Name (English) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Country Chicken Biryani Cut"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Tamil Name (தமிழ் பெயர்)</label>
                  <input
                    type="text"
                    placeholder="e.g. நாட்டுக்கோழி பிரியாணி கட்"
                    value={formData.tamil_name}
                    onChange={e => setFormData({ ...formData, tamil_name: e.target.value })}
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Chicken">Chicken</option>
                      <option value="Mutton">Mutton</option>
                      <option value="Fish & Seafood">Fish & Seafood</option>
                      <option value="Eggs & Marinades">Eggs & Marinades</option>
                      <option value="Specialty">Specialty Cuts</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price per KG (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 580"
                      value={formData.price_per_kg}
                      onChange={e =>
                        setFormData({ ...formData, price_per_kg: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>SKU / Item Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CH-005"
                      value={formData.sku}
                      onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Billing Unit</label>
                    <select
                      value={formData.unit}
                      onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    >
                      <option value="kg">kg (weight based)</option>
                      <option value="pack">pack</option>
                      <option value="piece">piece</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
