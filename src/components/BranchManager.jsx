import React, { useState } from 'react';
import { Store, Plus, MapPin, Phone, CheckCircle2, X, Pencil, Smartphone } from 'lucide-react';
import { createBranchRecord, updateBranchRecord, saveBranchLogin, isConfigured } from '../services/supabase.js';
import { useToast } from './ToastProvider.jsx';

export default function BranchManager({ branches, onBranchAdded }) {
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    address: '',
    phone: '',
    upi_id: '',
    password: ''
  });

  async function handleSaveBranch(e) {
    e.preventDefault();
    if (!formData.name || saving) return;
    if (isConfigured && !editingBranch && formData.password.length < 8) {
      toast('Set a branch manager password with at least 8 characters.', 'error');
      return;
    }
    if (formData.password && !isConfigured) {
      toast('Connect Supabase before setting a branch login password.', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      code: formData.code,
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      upi_id: formData.upi_id.trim() || null,
      is_active: editingBranch?.is_active ?? true
    };

    try {
      const res = editingBranch
        ? await updateBranchRecord(editingBranch.id, payload)
        : await createBranchRecord({
          ...payload,
          code: formData.code || `BR00${(branches?.length || 0) + 1}`
        });

      if (!res.success) {
        toast('Could not save branch: ' + (res.error || 'Unknown error'), 'error');
        return;
      }

      const branch = res.data || editingBranch;
      if (formData.password) {
        if (res.source !== 'supabase') {
          closeModal(true);
          toast('Branch saved on this device only. Run the Supabase database setup before creating its manager login.', 'error');
          return;
        }

        const loginRes = await saveBranchLogin({
          branchId: branch.id,
          password: formData.password,
          fullName: branch.name
        });
        if (!loginRes.success) {
          closeModal(true);
          if (onBranchAdded) await onBranchAdded();
          toast(`Branch saved, but its manager login could not be saved: ${loginRes.error}`, 'error');
          return;
        }
      }

      closeModal(true);
      setFormData({ code: '', name: '', address: '', phone: '', upi_id: '', password: '' });
      if (onBranchAdded) await onBranchAdded();
      toast(editingBranch ? 'Branch updated successfully.' : 'Branch created successfully.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save branch.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openAddModal() {
    setEditingBranch(null);
    setFormData({ code: '', name: '', address: '', phone: '', upi_id: '', password: '' });
    setShowModal(true);
  }

  function openEditModal(branch) {
    setEditingBranch(branch);
    setFormData({
      code: branch.code || '',
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      upi_id: branch.upi_id || '',
      password: ''
    });
    setShowModal(true);
  }

  function closeModal(force = false) {
    if (saving && !force) return;
    setShowModal(false);
    setEditingBranch(null);
    setFormData({ code: '', name: '', address: '', phone: '', upi_id: '', password: '' });
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

                <div className="form-group">
                  <label htmlFor="branch-manager-password">Branch Manager Password{!editingBranch && isConfigured ? ' *' : ''}</label>
                  <input
                    id="branch-manager-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required={!editingBranch && isConfigured}
                    placeholder={editingBranch ? 'Leave blank to keep current password' : 'At least 8 characters'}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                  <small className="text-muted">
                    {isConfigured
                      ? `The manager signs in by selecting ${formData.code || editingBranch?.code || 'this branch'} and entering this password.`
                      : 'Connect Supabase to create a branch manager login.'}
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => closeModal()}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingBranch ? 'Update Branch Outlet' : 'Create Branch Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
