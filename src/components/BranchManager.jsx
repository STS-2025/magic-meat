import React, { useState } from 'react';
import { Store, Plus, MapPin, Phone, CheckCircle2, X } from 'lucide-react';
import { createBranchRecord } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';

export default function BranchManager({ branches, onBranchAdded }) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    phone: ''
  });

  async function handleAddBranch(e) {
    e.preventDefault();
    if (!formData.name) return;

    const res = await createBranchRecord({
      code: formData.code || `BR00${(branches?.length || 0) + 1}`,
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      is_active: true
    });

    if (res.success) {
      setShowModal(false);
      setFormData({ code: '', name: '', address: '', phone: '' });
      if (onBranchAdded) onBranchAdded();
      toast('Branch created successfully.');
    } else {
      toast('Could not save branch: ' + (res.error || 'Unknown error'), 'error');
    }
  }

  return (
    <div className="admin-container">
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Retail Outlets & Branches</h1>
          <p className="admin-subtitle">Manage cloud connected Magic Meat branch stores</p>
        </div>

        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add New Branch
        </button>
      </div>

      <div className="branches-grid mt-4">
        {branches?.map(b => (
          <div key={b.id} className="branch-card">
            <div className="branch-card-header">
              <div className="branch-icon-wrap">
                <Store size={22} color="#10b981" />
              </div>
              <div>
                <h3 className="branch-card-title">{b.name}</h3>
                <span className="branch-card-code">{b.code}</span>
              </div>
            </div>

            <div className="branch-card-body">
              <div className="branch-info-line">
                <MapPin size={16} className="text-muted" />
                <span>{b.address || 'Address not configured'}</span>
              </div>
              <div className="branch-info-line">
                <Phone size={16} className="text-muted" />
                <span>{b.phone || 'Phone not configured'}</span>
              </div>
            </div>

            <div className="branch-card-footer">
              <span className="badge-pill pill-green">
                <CheckCircle2 size={12} /> Active Cloud Outlet
              </span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Open New Branch Store</h2>
              <button className="icon-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddBranch}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Branch Code (e.g. BR004) *</label>
                  <input
                    type="text"
                    required
                    placeholder="BR004"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Branch Outlet Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Branch 4 - Adyar Depot"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Address / Street Location</label>
                  <input
                    type="text"
                    placeholder="e.g. LB Road, Adyar, Chennai - 600020"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Store Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98404 55667"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Branch Outlet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
