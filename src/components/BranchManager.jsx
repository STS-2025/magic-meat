import React, { useState } from 'react';
import { Store, Plus, MapPin, Phone, CheckCircle2, X, Pencil, Smartphone } from 'lucide-react';
import { createBranchRecord, updateBranchRecord } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';

export default function BranchManager({ branches, onBranchAdded }) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    upi_id: ''
  });

  async function handleSaveBranch(e) {
    e.preventDefault();
    if (!formData.name) return;

    const payload = {
      code: formData.code,
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      upi_id: formData.upi_id.trim() || null,
      is_active: editingBranch?.is_active ?? true
    };

    const res = editingBranch
      ? await updateBranchRecord(editingBranch.id, payload)
      : await createBranchRecord({
          ...payload,
          code: formData.code || `BR00${(branches?.length || 0) + 1}`
        });

    if (res.success) {
      closeModal();
      setFormData({ code: '', name: '', address: '', phone: '', upi_id: '' });
      if (onBranchAdded) onBranchAdded();
      toast(editingBranch ? 'Branch updated successfully.' : 'Branch created successfully.');
    } else {
      toast('Could not save branch: ' + (res.error || 'Unknown error'), 'error');
    }
  }

  function openAddModal() {
    setEditingBranch(null);
    setFormData({ code: '', name: '', address: '', phone: '', upi_id: '' });
    setShowModal(true);
  }

  function openEditModal(branch) {
    setEditingBranch(branch);
    setFormData({
      code: branch.code || '',
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      upi_id: branch.upi_id || ''
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingBranch(null);
  }

  return (
    <div className="admin-container">
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Retail Outlets & Branches</h1>
          <p className="admin-subtitle">Manage cloud connected Magic Meat branch stores</p>
        </div>

        <button className="btn-primary" onClick={() => openAddModal()}>
          <Plus size={16} /> Add New Branch
        </button>
      </div>

      <div className="branches-grid mt-4">
        {branches?.map(b => (
          <div key={b.id} className="branch-card">
            <div className="branch-card-header">
              <div className="branch-card-header-main">
                <div className="branch-icon-wrap">
                  <Store size={22} color="#10b981" />
                </div>
                <div className="branch-card-title-group">
                  <h3 className="branch-card-title">{b.name}</h3>
                  <span className="branch-card-code">{b.code}</span>
                </div>
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
              {b.upi_id && (
                <div className="branch-info-line">
                  <Smartphone size={16} className="text-muted" />
                  <span>{b.upi_id}</span>
                </div>
              )}
            </div>

            <div className="branch-card-footer">
              <span className="badge-pill pill-green">
                <CheckCircle2 size={12} /> Active Cloud Outlet
              </span>
              <button type="button" className="btn-secondary branch-edit-btn" onClick={() => openEditModal(b)}>
                <Pencil size={14} /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingBranch ? 'Edit Branch Store' : 'Open New Branch Store'}</h2>
              <button className="icon-btn" onClick={() => closeModal()}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveBranch}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Branch Code (e.g. BR004) *</label>
                  <input
                    type="text"
                    required
                    placeholder="BR004"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    disabled={!!editingBranch}
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

                <div className="form-group">
                  <label>UPI ID</label>
                  <input
                    type="text"
                    placeholder="e.g. magicmeat@upi"
                    value={formData.upi_id}
                    onChange={e => setFormData({ ...formData, upi_id: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => closeModal()}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingBranch ? 'Update Branch Outlet' : 'Create Branch Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
