import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  CalendarDays,
  Check,
  CircleDollarSign,
  Eye,
  Plus,
  RefreshCw,
  Search,
  Store,
  Users,
  X
} from 'lucide-react';
import { useToast } from './ToastProvider.jsx';
import {
  cancelMembershipEnrollment,
  createMembershipEnrollment,
  fetchMembershipEnrollments,
  fetchMembershipPlans,
  recordMembershipDelivery
} from '../services/supabase.js';

const EMPTY_CUSTOMER = { customer_name: '', customer_phone: '', customer_address: '', plan_id: '' };

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
}).format(Number(value || 0));

function membershipStatus(membership) {
  if (membership.status === 'active' && new Date(membership.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }
  return membership.status;
}

function getCatClass(cat) {
  const c = (cat || 'Chicken').toLowerCase();
  if (c.includes('mutton')) return 'mutton';
  if (c.includes('fish') || c.includes('seafood')) return 'fish';
  if (c.includes('egg') || c.includes('marinade')) return 'eggs';
  if (c.includes('special')) return 'specialty';
  return 'chicken';
}

export default function BranchMembership({ branch }) {
  const toast = useToast();
  const [section, setSection] = useState('plans');
  const [plans, setPlans] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER);

  useEffect(() => {
    loadData();
  }, [branch?.id]);

  async function loadData() {
    if (!branch?.id) {
      setPlans([]);
      setEnrollments([]);
      setLoading(false);
      setError('No branch is assigned to this account.');
      return;
    }

    setLoading(true);
    setError('');
    const [planResult, customerResult] = await Promise.all([
      fetchMembershipPlans(),
      fetchMembershipEnrollments(branch.id)
    ]);
    setPlans(planResult.data || []);
    setEnrollments(customerResult.data || []);
    const err = planResult.error || customerResult.error || '';
    setError(err);
    if (err) {
      toast(`Could not load branch memberships: ${err}`, 'error');
    }
    setLoading(false);
  }

  function showNotice(message, type = 'success') {
    toast(message, type);
  }

  const visiblePlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plans.filter(plan =>
      plan.is_active &&
      (!query || `${plan.plan_name} ${plan.product_name} ${plan.product_quantity}`.toLowerCase().includes(query))
    );
  }, [plans, search]);

  const visibleEnrollments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return enrollments.filter(enrollment =>
      section !== 'customers' ||
      !query ||
      enrollment.customer_name.toLowerCase().includes(query) ||
      (enrollment.customer_phone || '').includes(query) ||
      (enrollment.membership_plans?.plan_name || '').toLowerCase().includes(query)
    );
  }, [enrollments, search, section]);

  function openAddCustomer(plan = null) {
    setSelectedPlan(plan);
    setCustomerForm({
      ...EMPTY_CUSTOMER,
      plan_id: plan?.id || visiblePlans[0]?.id || ''
    });
    setCustomerModal(true);
  }

  async function handleAddCustomer(event) {
    event.preventDefault();
    setSaving(true);
    const result = await createMembershipEnrollment({
      customerName: customerForm.customer_name,
      customerPhone: customerForm.customer_phone,
      customerAddress: customerForm.customer_address,
      planId: customerForm.plan_id,
      branchId: branch.id
    });
    setSaving(false);
    if (!result.success) {
      showNotice(result.error || 'Could not add this customer to the membership.', 'error');
      return;
    }

    setCustomerModal(false);
    setSelectedPlan(null);
    setCustomerForm(EMPTY_CUSTOMER);
    setSection('customers');
    showNotice('Customer added to the membership plan.');
    await loadData();
  }

  async function handleRecordDelivery(enrollment) {
    const result = await recordMembershipDelivery(enrollment.id);
    if (!result.success) {
      showNotice(result.error || 'Could not record this delivery.', 'error');
      return;
    }
    showNotice(result.data?.status === 'completed'
      ? 'Third delivery recorded. Membership completed.'
      : result.data?.status === 'expired'
        ? 'This membership has expired.'
        : 'Delivery recorded.');
    await loadData();
  }

  async function handleCancel(enrollment) {
    if (!window.confirm(`Cancel ${enrollment.customer_name}'s membership? No refund will be issued.`)) return;
    const result = await cancelMembershipEnrollment(enrollment.id);
    if (!result.success) {
      showNotice(result.error || 'Could not cancel this membership.', 'error');
      return;
    }
    showNotice('Membership cancelled. Refund amount: ₹0.');
    await loadData();
  }

  const formPlan = visiblePlans.find(plan => plan.id === customerForm.plan_id);

  return (
    <div className="admin-container membership-page branch-membership-page">
      <div className="admin-header-row branch-membership-page-header">
        <div>
          <h1 className="admin-page-title">Membership Management</h1>
          <p className="admin-subtitle"><Store size={15} /> {branch?.name || 'Assigned branch'} · This branch only</p>
        </div>
        <button className="btn-secondary btn-sm" onClick={() => { loadData(); toast('Branch memberships refreshed.'); }} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="membership-tabs" role="tablist" aria-label="Branch membership sections">
        <button
          className={`membership-tab ${section === 'plans' ? 'active' : ''}`}
          role="tab"
          aria-selected={section === 'plans'}
          onClick={() => { setSection('plans'); setSearch(''); }}
        >
          <BadgePercent size={16} /> Available Plans
        </button>
        <button
          className={`membership-tab ${section === 'customers' ? 'active' : ''}`}
          role="tab"
          aria-selected={section === 'customers'}
          onClick={() => { setSection('customers'); setSearch(''); }}
        >
          <Users size={16} /> Customers
        </button>
      </div>

      <section className="admin-panel membership-panel">
        <div className="panel-header-row membership-customer-header">
          <div>
            <h2 className="panel-title">{section === 'plans' ? 'Plans available for this branch' : 'Branch membership customers'}</h2>
            <p className="membership-help-text">
              {section === 'plans'
                ? 'Select a plan to view details and add a customer.'
                : 'Membership completes after 3 deliveries or when the plan expires. Cancellation refund is ₹0.'}
            </p>
          </div>
          <div className="branch-membership-header-actions">
            <div className="search-bar-wrap membership-search">
              <Search size={16} />
              <input
                type="search"
                placeholder={section === 'plans' ? 'Search plans...' : 'Search customers or plans...'}
                value={search}
                onChange={event => setSearch(event.target.value)}
                aria-label={section === 'plans' ? 'Search plans' : 'Search customers'}
              />
            </div>
            {section === 'customers' && (
              <button className="btn-primary" onClick={() => openAddCustomer()} disabled={loading || visiblePlans.length === 0}>
                <Plus size={16} /> Add Customer
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="membership-empty-state">Loading branch memberships...</div>
        ) : section === 'plans' ? (
          visiblePlans.length ? (
            <div className="branch-membership-plan-grid">
              {visiblePlans.map(plan => {
                const cat = plan.category || 'Chicken';
                return (
                  <button className="branch-membership-plan-card" key={plan.id} onClick={() => setSelectedPlan(plan)}>
                    <div className="branch-membership-plan-card-top">
                      <span className="branch-membership-plan-icon"><BadgePercent size={20} /></span>
                      <span className={`badge-pill cat-badge-${getCatClass(cat)}`}>
                        {cat}
                      </span>
                    </div>
                    <div className="branch-membership-plan-card-body">
                      <strong>{plan.plan_name}</strong>
                      <span>{plan.duration_weeks} weeks · {plan.product_quantity}</span>
                    </div>
                    <div className="branch-membership-plan-card-footer">
                      <b>{money(plan.offer_price)}</b>
                      <small>View details <Eye size={13} /></small>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="membership-empty-state">
              <BadgePercent size={28} />
              <strong>{plans.length ? 'No active plans for this branch' : 'No membership plans available'}</strong>
              <span>The owner must assign an active plan to this branch.</span>
            </div>
          )
        ) : visibleEnrollments.length ? (
          <div className="custom-table-wrap">
            <table className="custom-table membership-customers-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Plan</th>
                  <th>Deliveries</th>
                  <th>Amount Paid</th>
                  <th>Valid Until</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleEnrollments.map(enrollment => {
                  const status = membershipStatus(enrollment);
                  return (
                    <tr key={enrollment.id}>
                      <td>
                        <span className="font-bold">{enrollment.customer_name}</span>
                        <small className="membership-customer-phone">{enrollment.customer_phone || 'No phone number'}</small>
                        <small className="membership-customer-address">{enrollment.customer_address || 'No address provided'}</small>
                      </td>
                      <td>
                        <span className="font-bold">{enrollment.membership_plans?.plan_name || 'Membership plan'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span className={`badge-pill cat-badge-${getCatClass(enrollment.membership_plans?.category || 'Chicken')}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                            {enrollment.membership_plans?.category || 'Chicken'}
                          </span>
                          <small className="text-muted">{enrollment.membership_plans?.product_quantity || '1 KG per delivery'}</small>
                        </div>
                      </td>
                      <td>{enrollment.deliveries_used} / {enrollment.max_deliveries}</td>
                      <td>{money(enrollment.paid_amount)}</td>
                      <td>{new Date(enrollment.expires_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={`badge-pill ${status === 'active' ? 'pill-green' : status === 'completed' ? 'pill-amber' : 'pill-red'}`}>
                          {status}
                        </span>
                        {status === 'cancelled' && <small className="membership-customer-phone">Refund ₹0</small>}
                      </td>
                      <td>
                        {status === 'active' ? (
                          <div className="membership-row-actions">
                            <button className="btn-outline btn-sm" onClick={() => handleRecordDelivery(enrollment)} title="Record a delivery">
                              <CalendarDays size={14} /> Record delivery
                            </button>
                            <button className="btn-icon-subtle membership-delete-action" onClick={() => handleCancel(enrollment)} title="Cancel membership" aria-label={`Cancel membership for ${enrollment.customer_name}`}>
                              <X size={15} />
                            </button>
                          </div>
                        ) : status === 'cancelled' ? (
                          <span className="text-muted">No refund</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="membership-empty-state">
            <Users size={28} />
            <strong>{enrollments.length ? 'No matching customers' : 'No customers have memberships yet'}</strong>
            <span>Add a customer from an available plan.</span>
          </div>
        )}
      </section>

      {selectedPlan && !customerModal && (
        <div className="modal-backdrop membership-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setSelectedPlan(null);
        }}>
          <div className="modal-content membership-modal branch-plan-modal" role="dialog" aria-modal="true" aria-labelledby="branch-membership-plan-title">
            <div className="modal-header">
              <div>
                <h2 id="branch-membership-plan-title">{selectedPlan.plan_name}</h2>
                <p className="membership-help-text">{selectedPlan.duration_weeks} weeks · {branch?.name}</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setSelectedPlan(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body membership-form">
              <div className="branch-membership-plan-detail">
                <div><span>Offer price</span><strong>{money(selectedPlan.offer_price)}</strong></div>
                <div><span>Original price</span><strong>{money(selectedPlan.original_price)}</strong></div>
                <div><span>Product</span><strong>{selectedPlan.product_name}</strong></div>
                <div><span>Quantity</span><strong>{selectedPlan.product_quantity}</strong></div>
                <div><span>Duration</span><strong>{selectedPlan.duration_weeks} weeks</strong></div>
              </div>
              {selectedPlan.description && <p className="membership-help-text">{selectedPlan.description}</p>}
              <p className="membership-help-text">Membership completes after 3 deliveries or when the plan expires. Cancellation refund is ₹0.</p>
              <div className="membership-enrollment-summary">
                <CircleDollarSign size={17} />
                <span>Refund on cancellation: ₹0</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedPlan(null)}>Close</button>
              <button className="btn-primary" onClick={() => openAddCustomer(selectedPlan)}>
                <Plus size={15} /> Add Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {customerModal && (
        <div className="modal-backdrop membership-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !saving) {
            setCustomerModal(false);
            setSelectedPlan(null);
          }
        }}>
          <div className="modal-content membership-modal branch-plan-modal" role="dialog" aria-modal="true" aria-labelledby="branch-membership-customer-title">
            <div className="modal-header">
              <div>
                <h2 id="branch-membership-customer-title">Add Membership Customer</h2>
                <p className="membership-help-text">{branch?.name} · No refund on cancellation</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => {
                setCustomerModal(false);
                setSelectedPlan(null);
              }} aria-label="Close" disabled={saving}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="modal-body membership-form">
                <div className="form-group">
                  <label htmlFor="branch-membership-customer-name">Customer Name *</label>
                  <input id="branch-membership-customer-name" required maxLength={120} value={customerForm.customer_name} onChange={event => setCustomerForm({ ...customerForm, customer_name: event.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="branch-membership-customer-phone">Phone Number</label>
                  <input id="branch-membership-customer-phone" type="tel" maxLength={30} value={customerForm.customer_phone} onChange={event => setCustomerForm({ ...customerForm, customer_phone: event.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="branch-membership-customer-address">Customer Address *</label>
                  <textarea id="branch-membership-customer-address" required maxLength={500} rows="3" value={customerForm.customer_address} onChange={event => setCustomerForm({ ...customerForm, customer_address: event.target.value })} />
                </div>
                <div className="form-group">
                  <label htmlFor="branch-membership-customer-plan">Membership Plan *</label>
                  <select
                    id="branch-membership-customer-plan"
                    required
                    value={customerForm.plan_id}
                    disabled={Boolean(selectedPlan)}
                    onChange={event => setCustomerForm({ ...customerForm, plan_id: event.target.value })}
                  >
                    {visiblePlans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        [{plan.category || 'Chicken'}] {plan.plan_name} · {plan.duration_weeks} weeks · {money(plan.offer_price)}
                      </option>
                    ))}
                  </select>
                </div>
                {formPlan && (
                  <>
                    <div className="membership-enrollment-summary">
                      <CircleDollarSign size={17} />
                      <span>Plan amount: {money(formPlan.offer_price)} · Refund: ₹0</span>
                    </div>
                    <small className="membership-help-text">Completes after 3 deliveries or at the end of the plan duration, whichever comes first.</small>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => {
                  setCustomerModal(false);
                  setSelectedPlan(null);
                }} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving || !formPlan}>
                  {saving ? 'Adding...' : <><Check size={15} /> Add Customer</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
