import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  CalendarDays,
  Check,
  CircleDollarSign,
  Eye,
  Filter,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { useToast } from './ToastProvider.jsx';
import {
  cancelMembershipEnrollment,
  createMembershipEnrollment,
  fetchMembershipEnrollments,
  deleteMembershipPlan,
  fetchMembershipBranches,
  fetchMembershipPlans,
  recordMembershipDelivery,
  saveMembershipPlan
} from '../services/supabase.js';

export const MEMBERSHIP_CATEGORIES = [
  'Chicken',
  'Mutton',
  'Fish & Seafood',
  'Eggs & Marinades',
  'Specialty Cuts'
];

function getCatClass(cat) {
  const c = (cat || 'Chicken').toLowerCase();
  if (c.includes('mutton')) return 'mutton';
  if (c.includes('fish') || c.includes('seafood')) return 'fish';
  if (c.includes('egg') || c.includes('marinade')) return 'eggs';
  if (c.includes('special')) return 'specialty';
  return 'chicken';
}

const EMPTY_FORM = {
  plan_name: '',
  category: 'Chicken',
  duration_weeks: 3,
  original_price: '',
  offer_price: '',
  product_name: 'Broiler Chicken',
  product_quantity: '1 KG per delivery',
  description: 'Each delivery includes 1 KG Broiler Chicken.',
  is_active: true
};
const EMPTY_CUSTOMER_FORM = { customer_name: '', customer_phone: '', customer_address: '', plan_id: '', branch_id: '' };

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
}).format(Number(value || 0));

function planBranchIds(plan) {
  return (plan.membership_plan_branches || []).map(item => item.branch_id);
}

function membershipStatus(membership) {
  if (membership.status === 'active' && new Date(membership.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }
  return membership.status || 'active';
}

export default function MembershipManagement({ branches: propBranches = [] }) {
  const toast = useToast();
  const [section, setSection] = useState('customers'); // Default to Customer Memberships view for quick tracking
  const [plans, setPlans] = useState([]);
  const [branches, setBranches] = useState(propBranches || []);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [enrollments, setEnrollments] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
  const [planCategoryFilter, setPlanCategoryFilter] = useState('all');
  const [customerModal, setCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [selectedBranchId]);

  async function loadData() {
    setLoading(true);
    const [branchResult, planResult] = await Promise.all([
      fetchMembershipBranches(),
      fetchMembershipPlans()
    ]);

    if (branchResult.error || planResult.error) {
      const err = branchResult.error || planResult.error;
      toast(`Could not load membership data: ${err}`, 'error');
    }

    const loadedBranches = branchResult.data && branchResult.data.length > 0
      ? branchResult.data
      : (propBranches && propBranches.length > 0 ? propBranches : []);

    setBranches(loadedBranches);
    setPlans(planResult.data || []);
    setLoading(false);
  }

  async function loadEnrollments() {
    setCustomersLoading(true);
    const result = await fetchMembershipEnrollments(selectedBranchId === 'all' ? null : selectedBranchId);
    if (result.error) {
      toast(`Could not load membership customers: ${result.error}`, 'error');
    }
    setEnrollments(result.data || []);
    setCustomersLoading(false);
  }

  // Live Counts for Status & Category Buttons
  const planCounts = useMemo(() => {
    const bPlans = plans.filter(p => !selectedBranchId || selectedBranchId === 'all' || planBranchIds(p).includes(selectedBranchId));
    return {
      all: bPlans.length,
      active: bPlans.filter(p => p.is_active).length,
      inactive: bPlans.filter(p => !p.is_active).length
    };
  }, [plans, selectedBranchId]);

  const planCategoryCounts = useMemo(() => {
    const bPlans = plans.filter(p => !selectedBranchId || selectedBranchId === 'all' || planBranchIds(p).includes(selectedBranchId));
    const counts = { all: bPlans.length };
    MEMBERSHIP_CATEGORIES.forEach(cat => {
      counts[cat] = bPlans.filter(p => (p.category || 'Chicken') === cat).length;
    });
    return counts;
  }, [plans, selectedBranchId]);

  const customerCounts = useMemo(() => {
    const bEnrollments = enrollments.filter(e => !selectedBranchId || selectedBranchId === 'all' || e.branch_id === selectedBranchId);
    return {
      all: bEnrollments.length,
      active: bEnrollments.filter(e => membershipStatus(e) === 'active').length,
      completed: bEnrollments.filter(e => membershipStatus(e) === 'completed').length,
      expired: bEnrollments.filter(e => membershipStatus(e) === 'expired').length,
      cancelled: bEnrollments.filter(e => membershipStatus(e) === 'cancelled').length
    };
  }, [enrollments, selectedBranchId]);

  const visiblePlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plans.filter(plan => {
      const planCat = plan.category || 'Chicken';
      const matchesCategory = planCategoryFilter === 'all' || planCat === planCategoryFilter;
      const matchesQuery = !query ||
        plan.plan_name.toLowerCase().includes(query) ||
        planCat.toLowerCase().includes(query) ||
        (plan.product_name && plan.product_name.toLowerCase().includes(query)) ||
        (plan.product_quantity && plan.product_quantity.toLowerCase().includes(query)) ||
        (plan.description && plan.description.toLowerCase().includes(query));

      const matchesBranch = !selectedBranchId || selectedBranchId === 'all' || planBranchIds(plan).includes(selectedBranchId);
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' ? plan.is_active : !plan.is_active);
      return matchesCategory && matchesQuery && matchesBranch && matchesStatus;
    });
  }, [plans, search, statusFilter, selectedBranchId, planCategoryFilter]);

  const availablePlansForSelectedBranch = useMemo(() => {
    const branchId = customerForm.branch_id || (selectedBranchId !== 'all' ? selectedBranchId : branches[0]?.id);
    return plans.filter(plan =>
      plan.is_active && (!branchId || planBranchIds(plan).includes(branchId))
    );
  }, [plans, customerForm.branch_id, selectedBranchId, branches]);

  const visibleEnrollments = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    return enrollments.filter(enrollment => {
      const planCat = enrollment.membership_plans?.category || 'Chicken';
      const matchesQuery = !query ||
        enrollment.customer_name?.toLowerCase().includes(query) ||
        (enrollment.customer_phone || '').includes(query) ||
        (enrollment.customer_address || '').toLowerCase().includes(query) ||
        (enrollment.membership_plans?.plan_name || '').toLowerCase().includes(query) ||
        planCat.toLowerCase().includes(query) ||
        (enrollment.branches?.name || '').toLowerCase().includes(query);

      const status = membershipStatus(enrollment);
      const matchesStatus = customerStatusFilter === 'all' || status === customerStatusFilter;
      const matchesBranch = !selectedBranchId || selectedBranchId === 'all' || enrollment.branch_id === selectedBranchId;
      return matchesQuery && matchesStatus && matchesBranch;
    });
  }, [enrollments, customerSearch, customerStatusFilter, selectedBranchId]);

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setSelectedBranches(branches.map(branch => branch.id));
    setModal({ mode: 'create' });
  }

  function openPlan(plan, mode) {
    setForm({
      plan_name: plan.plan_name,
      category: plan.category || 'Chicken',
      duration_weeks: plan.duration_weeks,
      original_price: plan.original_price,
      offer_price: plan.offer_price,
      product_name: plan.product_name,
      product_quantity: plan.product_quantity,
      description: plan.description || '',
      is_active: plan.is_active
    });
    setSelectedBranches(planBranchIds(plan));
    setModal({ mode, plan });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (selectedBranches.length === 0) {
      toast('Select at least one branch for this plan.', 'error');
      return;
    }

    setSaving(true);
    const result = await saveMembershipPlan({
      ...form,
      category: form.category || 'Chicken',
      id: modal.plan?.id,
      branch_ids: selectedBranches
    });
    setSaving(false);

    if (!result.success) {
      toast(result.error || 'Could not save this membership plan.', 'error');
      return;
    }

    setModal(null);
    toast(modal.mode === 'create' ? `Membership plan "${form.plan_name}" (${form.category}) created!` : `Membership plan "${form.plan_name}" updated!`);
    await loadData();
  }

  async function handleStatusToggle(plan) {
    const nextActive = !plan.is_active;
    const action = nextActive ? 'activate' : 'deactivate';

    const result = await saveMembershipPlan({
      ...plan,
      category: plan.category || 'Chicken',
      branch_ids: planBranchIds(plan),
      is_active: nextActive
    });
    if (!result.success) {
      toast(result.error || `Could not ${action} this plan.`, 'error');
      return;
    }
    toast(`Plan "${plan.plan_name}" ${nextActive ? 'activated' : 'deactivated'}.`);
    await loadData();
  }

  async function handleDelete(plan) {
    if (!window.confirm(
      `Delete "${plan.plan_name}" (${plan.category || 'Chicken'})? This cannot be undone. Plans referenced by active memberships cannot be deleted.`
    )) return;

    const result = await deleteMembershipPlan(plan.id);
    if (!result.success) {
      toast(result.error || 'Could not delete this plan.', 'error');
      return;
    }
    toast(`Membership plan "${plan.plan_name}" deleted.`);
    await loadData();
  }

  function openAddCustomer() {
    const defaultBranchId = (selectedBranchId && selectedBranchId !== 'all') ? selectedBranchId : (branches[0]?.id || '');
    const defaultPlan = plans.find(p => p.is_active && planBranchIds(p).includes(defaultBranchId)) || plans[0];

    setCustomerForm({
      ...EMPTY_CUSTOMER_FORM,
      branch_id: defaultBranchId,
      plan_id: defaultPlan?.id || ''
    });
    setCustomerModal(true);
  }

  async function handleAddCustomer(event) {
    event.preventDefault();
    if (!customerForm.customer_name.trim()) {
      toast('Please enter customer name.', 'error');
      return;
    }
    if (!customerForm.branch_id) {
      toast('Please select an outlet location.', 'error');
      return;
    }
    if (!customerForm.plan_id) {
      toast('Please select a membership plan.', 'error');
      return;
    }

    setCustomerSaving(true);
    const result = await createMembershipEnrollment({
      customerName: customerForm.customer_name,
      customerPhone: customerForm.customer_phone,
      customerAddress: customerForm.customer_address,
      planId: customerForm.plan_id,
      branchId: customerForm.branch_id
    });
    setCustomerSaving(false);

    if (!result.success) {
      toast(result.error || 'Could not add this membership customer.', 'error');
      return;
    }

    setCustomerModal(false);
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    toast('Customer enrolled in membership plan successfully!');
    await loadEnrollments();
  }

  async function handleRecordDelivery(enrollment) {
    const currentDelivery = (enrollment.deliveries_used || 0) + 1;
    if (!window.confirm(`Record delivery ${currentDelivery} of ${enrollment.max_deliveries} for ${enrollment.customer_name}?`)) return;

    const result = await recordMembershipDelivery(enrollment.id);
    if (!result.success) {
      toast(result.error || 'Could not record delivery.', 'error');
      return;
    }
    const status = result.data?.status;
    toast(status === 'expired'
      ? 'This membership has expired.'
      : status === 'completed'
        ? `Delivery ${currentDelivery} recorded. All deliveries completed!`
        : `Delivery ${currentDelivery} of ${enrollment.max_deliveries} recorded successfully!`);
    await loadEnrollments();
  }

  async function handleCancelEnrollment(enrollment) {
    if (!window.confirm(`Cancel ${enrollment.customer_name}'s membership? No refund will be issued.`)) return;
    const result = await cancelMembershipEnrollment(enrollment.id);
    if (!result.success) {
      toast(result.error || 'Could not cancel membership.', 'error');
      return;
    }
    toast(`Membership for ${enrollment.customer_name} cancelled. Refund amount: ₹0.`);
    await loadEnrollments();
  }

  const readOnly = modal?.mode === 'view';
  const savings = Math.max(
    0,
    Number(form.original_price || 0) - Number(form.offer_price || 0)
  );

  return (
    <div className="admin-container membership-page">
      {/* Page Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Membership Management</h1>
          <p className="admin-subtitle">Manage retail outlet membership plans by category, customer enrollments, and deliveries</p>
        </div>
        <div className="admin-header-actions">
          {section === 'plans' ? (
            <button className="btn-primary" onClick={openCreate} disabled={loading || branches.length === 0}>
              <Plus size={16} /> Create Membership Plan
            </button>
          ) : (
            <button className="btn-primary" onClick={openAddCustomer} disabled={loading || branches.length === 0}>
              <Plus size={16} /> Enroll New Member
            </button>
          )}
          <button
            className="btn-secondary btn-sm"
            onClick={() => { loadData(); loadEnrollments(); toast('Membership data refreshed.'); }}
            disabled={loading || customersLoading}
            title="Refresh memberships"
          >
            <RefreshCw size={14} className={(loading || customersLoading) ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="membership-tabs" role="tablist" aria-label="Membership management sections">
        <button
          className={`membership-tab ${section === 'customers' ? 'active' : ''}`}
          role="tab"
          aria-selected={section === 'customers'}
          onClick={() => setSection('customers')}
        >
          <Users size={16} /> Member Subscriptions
          <span className="tab-pill-badge">{customerCounts.all}</span>
        </button>
        <button
          className={`membership-tab ${section === 'plans' ? 'active' : ''}`}
          role="tab"
          aria-selected={section === 'plans'}
          onClick={() => setSection('plans')}
        >
          <BadgePercent size={16} /> Membership Plans
          <span className="tab-pill-badge">{planCounts.all}</span>
        </button>
      </div>

      {/* Filter Toolbar: Location Dropdown + Search + Status / Category Dropdown */}
      <div className="membership-filter-toolbar">
        {/* 1. Location Dropdown */}
        <div className="filter-group membership-location-group">
          <MapPin size={16} className="filter-icon" />
          <select
            className="membership-filter-select membership-branch-dropdown"
            value={selectedBranchId}
            onChange={event => setSelectedBranchId(event.target.value)}
            aria-label="Filter by location"
          >
            <option value="all">📍 All Locations ({branches.length})</option>
            {branches.map(branch => (
              <option key={branch.id} value={branch.id}>
                📍 {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Search Input */}
        <div className="search-bar-wrap membership-search-bar">
          <Search size={16} className="search-icon" />
          <input
            type="search"
            placeholder={
              section === 'plans'
                ? 'Search plans by name, category, product...'
                : 'Search members by name, phone, plan, address...'
            }
            value={section === 'plans' ? search : customerSearch}
            onChange={event => section === 'plans' ? setSearch(event.target.value) : setCustomerSearch(event.target.value)}
            aria-label="Search memberships"
          />
          {(section === 'plans' ? search : customerSearch) && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => section === 'plans' ? setSearch('') : setCustomerSearch('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 3. Status Dropdown */}
        <div className="filter-group membership-status-dropdown-group">
          <Filter size={16} className="filter-icon" />
          <select
            className="membership-filter-select"
            value={section === 'plans' ? statusFilter : customerStatusFilter}
            onChange={event => section === 'plans' ? setStatusFilter(event.target.value) : setCustomerStatusFilter(event.target.value)}
            aria-label="Filter by status"
          >
            {section === 'plans' ? (
              <>
                <option value="all">All Plan Statuses ({planCounts.all})</option>
                <option value="active">Active Plans ({planCounts.active})</option>
                <option value="inactive">Inactive Plans ({planCounts.inactive})</option>
              </>
            ) : (
              <>
                <option value="all">All Member Status ({customerCounts.all})</option>
                <option value="active">Active Members ({customerCounts.active})</option>
                <option value="completed">Completed 3/3 ({customerCounts.completed})</option>
                <option value="expired">Expired ({customerCounts.expired})</option>
                <option value="cancelled">Cancelled ({customerCounts.cancelled})</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Category Filter Pills (When viewing plans) */}
      {section === 'plans' && (
        <div className="membership-cat-btn-bar" role="group" aria-label="Filter plans by meat category">
          <span className="status-bar-label"><Tag size={13} /> Category:</span>
          <button
            type="button"
            className={`status-filter-btn ${planCategoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setPlanCategoryFilter('all')}
          >
            All Categories <span className="status-count-badge">{planCategoryCounts.all}</span>
          </button>
          {MEMBERSHIP_CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`status-filter-btn cat-btn-${getCatClass(cat)} ${planCategoryFilter === cat ? 'active' : ''}`}
              onClick={() => setPlanCategoryFilter(cat)}
            >
              {cat} <span className="status-count-badge">{planCategoryCounts[cat] || 0}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content Section: Plans vs Customers */}
      {section === 'plans' ? (
        <section className="admin-panel membership-panel">
          {loading ? (
            <div className="membership-empty-state">
              <RefreshCw size={24} className="animate-spin" />
              <span>Loading membership plans...</span>
            </div>
          ) : visiblePlans.length === 0 ? (
            <div className="membership-empty-state">
              <BadgePercent size={32} />
              <strong>{plans.length ? 'No matching plans found' : 'No membership plans created yet'}</strong>
              <span>
                {plans.length
                  ? 'Try selecting a different category, location, or status button.'
                  : 'Click "Create Membership Plan" to set up your first subscription plan.'}
              </span>
            </div>
          ) : (
            <div className="custom-table-wrap">
              <table className="custom-table membership-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Plan Name</th>
                    <th>Duration</th>
                    <th>Original Price</th>
                    <th>Offer Price</th>
                    <th>Savings</th>
                    <th>Product & Quantity</th>
                    <th>Available Branches</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePlans.map(plan => {
                    const availableNames = (plan.membership_plan_branches || [])
                      .map(item => item.branches?.name)
                      .filter(Boolean);
                    const cat = plan.category || 'Chicken';
                    return (
                      <tr key={plan.id}>
                        <td>
                          <span className={`badge-pill cat-badge-${getCatClass(cat)}`}>
                            {cat}
                          </span>
                        </td>
                        <td>
                          <div className="font-bold">{plan.plan_name}</div>
                          <small className="text-muted">{cat} Special</small>
                        </td>
                        <td>{plan.duration_weeks} weeks</td>
                        <td>{money(plan.original_price)}</td>
                        <td>{money(plan.offer_price)}</td>
                        <td className="text-emerald font-bold">{money(plan.savings_amount)}</td>
                        <td>
                          <div className="font-medium">{plan.product_name}</div>
                          <small className="text-muted">{plan.product_quantity}</small>
                        </td>
                        <td>
                          <div className="membership-branch-tags">
                            {availableNames.length
                              ? availableNames.map(name => <span className="membership-branch-tag" key={name}>{name}</span>)
                              : <span className="text-muted">All Branches</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`badge-pill ${plan.is_active ? 'pill-green' : 'pill-red'}`}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="membership-row-actions">
                            <button className="btn-icon-subtle" title="View plan" aria-label={`View ${plan.plan_name}`} onClick={() => openPlan(plan, 'view')}>
                              <Eye size={15} />
                            </button>
                            <button className="btn-icon-subtle" title="Edit plan" aria-label={`Edit ${plan.plan_name}`} onClick={() => openPlan(plan, 'edit')}>
                              <Pencil size={15} />
                            </button>
                            <button className="btn-icon-subtle" title={plan.is_active ? 'Deactivate plan' : 'Activate plan'} aria-label={`${plan.is_active ? 'Deactivate' : 'Activate'} ${plan.plan_name}`} onClick={() => handleStatusToggle(plan)}>
                              {plan.is_active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                            </button>
                            <button className="btn-icon-subtle membership-delete-action" title="Delete plan" aria-label={`Delete ${plan.plan_name}`} onClick={() => handleDelete(plan)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="admin-panel membership-panel">
          <div className="panel-header-row membership-customer-header">
            <div>
              <h2 className="panel-title">Customer Subscriptions & Deliveries</h2>
              <p className="membership-help-text">A membership completes after 3 deliveries or when its plan expires. Cancellation refund is ₹0.</p>
            </div>
            <span className="membership-count-badge">
              Showing {visibleEnrollments.length} of {enrollments.length} members
            </span>
          </div>

          {customersLoading ? (
            <div className="membership-empty-state">
              <RefreshCw size={24} className="animate-spin" />
              <span>Loading membership customers...</span>
            </div>
          ) : visibleEnrollments.length === 0 ? (
            <div className="membership-empty-state">
              <Users size={32} />
              <strong>{enrollments.length ? 'No matching members found' : 'No membership customers enrolled yet'}</strong>
              <span>
                {enrollments.length
                  ? 'Try selecting a different location, status button, or search keyword.'
                  : 'Click "Enroll New Member" to add a customer to a membership plan.'}
              </span>
            </div>
          ) : (
            <div className="custom-table-wrap">
              <table className="custom-table membership-customers-table">
                <thead>
                  <tr>
                    <th>Customer Name & Contact</th>
                    <th>Plan & Category</th>
                    <th>Outlet Location</th>
                    <th>Deliveries Used</th>
                    <th>Amount Paid</th>
                    <th>Valid Until</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEnrollments.map(enrollment => {
                    const status = membershipStatus(enrollment);
                    const isCompleted = status === 'completed';
                    const isActive = status === 'active';
                    const isExpired = status === 'expired';
                    const cat = enrollment.membership_plans?.category || 'Chicken';

                    return (
                      <tr key={enrollment.id}>
                        <td>
                          <div className="membership-member-cell">
                            <span className="font-bold member-name">{enrollment.customer_name}</span>
                            <small className="membership-customer-phone">📞 {enrollment.customer_phone || 'No phone number'}</small>
                            <small className="membership-customer-address">🏠 {enrollment.customer_address || 'No address provided'}</small>
                          </div>
                        </td>
                        <td>
                          <span className="font-medium">{enrollment.membership_plans?.plan_name || 'Membership Plan'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                            <span className={`badge-pill cat-badge-${getCatClass(cat)}`} style={{ fontSize: '11px', padding: '2px 7px' }}>
                              {cat}
                            </span>
                            <small className="text-muted">{enrollment.membership_plans?.product_quantity || '1 KG per delivery'}</small>
                          </div>
                        </td>
                        <td>
                          <span className="badge-pill pill-subtle">
                            <MapPin size={12} /> {enrollment.branches?.name || 'Branch Outlet'}
                          </span>
                        </td>
                        <td>
                          <div className="delivery-progress-cell">
                            <span className="font-bold">{enrollment.deliveries_used} / {enrollment.max_deliveries}</span>
                            <div className="delivery-dots">
                              {[...Array(enrollment.max_deliveries || 3)].map((_, i) => (
                                <span
                                  key={i}
                                  className={`delivery-dot ${i < enrollment.deliveries_used ? 'dot-filled' : 'dot-empty'}`}
                                  title={`Delivery ${i + 1}`}
                                />
                              ))}
                            </div>
                          </div>
                        </td>
                        <td>{money(enrollment.paid_amount)}</td>
                        <td>{new Date(enrollment.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td>
                          <span className={`badge-pill ${isActive ? 'pill-green' : isCompleted ? 'pill-amber' : isExpired ? 'pill-red' : 'pill-gray'}`}>
                            {status.toUpperCase()}
                          </span>
                          {status === 'cancelled' && <small className="membership-customer-phone block">Refund ₹0</small>}
                        </td>
                        <td>
                          {isActive ? (
                            <div className="membership-row-actions">
                              <button
                                className="btn-outline btn-sm"
                                onClick={() => handleRecordDelivery(enrollment)}
                                title="Record delivery for customer"
                              >
                                <CalendarDays size={14} /> Record Delivery
                              </button>
                              <button
                                className="btn-icon-subtle membership-delete-action"
                                onClick={() => handleCancelEnrollment(enrollment)}
                                title="Cancel membership"
                                aria-label={`Cancel membership for ${enrollment.customer_name}`}
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ) : isCompleted ? (
                            <span className="text-emerald font-bold text-sm">✓ All 3 Delivered</span>
                          ) : status === 'cancelled' ? (
                            <span className="text-muted text-sm">Cancelled</span>
                          ) : (
                            <span className="text-muted text-sm">Expired</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Add Customer Modal */}
      {customerModal && (
        <div className="modal-backdrop membership-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !customerSaving) setCustomerModal(false);
        }}>
          <div className="modal-content membership-modal membership-customer-modal" role="dialog" aria-modal="true" aria-labelledby="membership-customer-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="membership-customer-modal-title">Enroll New Member</h2>
                <p className="membership-help-text">Register customer and issue membership subscription</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setCustomerModal(false)} aria-label="Close" disabled={customerSaving}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <div className="modal-body membership-form">
                {/* Branch Location Selection */}
                <div className="form-group">
                  <label htmlFor="membership-customer-branch">Outlet Location *</label>
                  <select
                    id="membership-customer-branch"
                    required
                    value={customerForm.branch_id}
                    onChange={event => {
                      const newBranchId = event.target.value;
                      const validPlans = plans.filter(p => p.is_active && planBranchIds(p).includes(newBranchId));
                      setCustomerForm({
                        ...customerForm,
                        branch_id: newBranchId,
                        plan_id: validPlans[0]?.id || ''
                      });
                    }}
                  >
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="membership-customer-name">Customer Name *</label>
                  <input
                    id="membership-customer-name"
                    required
                    maxLength={120}
                    placeholder="e.g. Senthil Kumar"
                    value={customerForm.customer_name}
                    onChange={event => setCustomerForm({ ...customerForm, customer_name: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="membership-customer-phone">Phone Number</label>
                  <input
                    id="membership-customer-phone"
                    type="tel"
                    maxLength={30}
                    placeholder="e.g. 9876543210"
                    value={customerForm.customer_phone}
                    onChange={event => setCustomerForm({ ...customerForm, customer_phone: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="membership-customer-address">Customer Delivery Address *</label>
                  <textarea
                    id="membership-customer-address"
                    required
                    maxLength={500}
                    rows="3"
                    placeholder="House / Street address..."
                    value={customerForm.customer_address}
                    onChange={event => setCustomerForm({ ...customerForm, customer_address: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="membership-customer-plan">Membership Plan *</label>
                  <select
                    id="membership-customer-plan"
                    required
                    value={customerForm.plan_id}
                    onChange={event => setCustomerForm({ ...customerForm, plan_id: event.target.value })}
                  >
                    {availablePlansForSelectedBranch.length === 0 ? (
                      <option value="">No plans available for this location</option>
                    ) : (
                      availablePlansForSelectedBranch.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          [{plan.category || 'Chicken'}] {plan.plan_name} · {plan.duration_weeks} weeks · {money(plan.offer_price)}
                        </option>
                      ))
                    )}
                  </select>
                  <small className="membership-help-text">Plan completes automatically after 3 deliveries or expiry.</small>
                </div>
                {customerForm.plan_id && (
                  <div className="membership-enrollment-summary">
                    <CircleDollarSign size={17} />
                    <span>Refund on early cancellation: ₹0 (No refund policy)</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setCustomerModal(false)} disabled={customerSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={customerSaving || availablePlansForSelectedBranch.length === 0}>
                  {customerSaving ? 'Enrolling...' : <><Check size={15} /> Enroll Member</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Create / Edit Modal */}
      {modal && (
        <div className="modal-backdrop membership-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !saving) setModal(null);
        }}>
          <div className="modal-content membership-modal" role="dialog" aria-modal="true" aria-labelledby="membership-modal-title">
            <div className="modal-header">
              <div>
                <h2 id="membership-modal-title">
                  {modal.mode === 'create' ? 'Create Membership Plan' : modal.mode === 'edit' ? 'Edit Membership Plan' : 'Membership Plan Details'}
                </h2>
                <p className="membership-help-text">Select meat category, set plan pricing, and assign outlet branches</p>
              </div>
              <button className="icon-btn" type="button" onClick={() => setModal(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body membership-form">
                <div className="membership-form-grid">
                  {/* Category Selection Dropdown */}
                  <div className="form-group">
                    <label htmlFor="plan-category">Category *</label>
                    <select
                      id="plan-category"
                      required
                      value={form.category || 'Chicken'}
                      disabled={readOnly}
                      onChange={event => {
                        const newCat = event.target.value;
                        let defaultProduct = form.product_name;
                        if (modal.mode === 'create') {
                          if (newCat === 'Chicken') defaultProduct = 'Broiler Chicken';
                          else if (newCat === 'Mutton') defaultProduct = 'Fresh Mutton';
                          else if (newCat === 'Fish & Seafood') defaultProduct = 'Fish & Prawns';
                          else if (newCat === 'Eggs & Marinades') defaultProduct = 'Country Eggs & Marinades';
                          else if (newCat === 'Specialty Cuts') defaultProduct = 'Specialty Boneless Cuts';
                        }
                        setForm({
                          ...form,
                          category: newCat,
                          product_name: defaultProduct,
                          description: modal.mode === 'create'
                            ? `Each delivery includes ${form.product_quantity || '1 KG per delivery'} ${defaultProduct}.`
                            : form.description
                        });
                      }}
                    >
                      {MEMBERSHIP_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Plan Name */}
                  <div className="form-group">
                    <label htmlFor="plan-name">Plan Name *</label>
                    <input
                      id="plan-name"
                      required
                      maxLength={100}
                      placeholder="e.g. 3 Weeks Plan or Family Pack"
                      value={form.plan_name}
                      readOnly={readOnly}
                      onChange={event => setForm({ ...form, plan_name: event.target.value })}
                    />
                    <small className="membership-help-text">Can be same across different categories</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="plan-duration">Duration (Weeks) *</label>
                    <input id="plan-duration" type="number" min="1" step="1" required value={form.duration_weeks} readOnly={readOnly} onChange={event => setForm({ ...form, duration_weeks: event.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="plan-original-price">Original Price (₹) *</label>
                    <input id="plan-original-price" type="number" min="0" step="0.01" required value={form.original_price} readOnly={readOnly} onChange={event => setForm({ ...form, original_price: event.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="plan-offer-price">Offer Price (₹) *</label>
                    <input id="plan-offer-price" type="number" min="0" step="0.01" max={form.original_price || undefined} required value={form.offer_price} readOnly={readOnly} onChange={event => setForm({ ...form, offer_price: event.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="plan-savings">Savings Amount</label>
                    <input id="plan-savings" value={money(savings)} readOnly />
                  </div>
                  <div className="form-group">
                    <label htmlFor="plan-product">Product Name *</label>
                    <input id="plan-product" required maxLength={100} value={form.product_name} readOnly={readOnly} onChange={event => setForm({ ...form, product_name: event.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="plan-quantity">Product Quantity *</label>
                    <input id="plan-quantity" required maxLength={100} value={form.product_quantity} readOnly={readOnly} onChange={event => setForm({ ...form, product_quantity: event.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="plan-status">Plan Status</label>
                    <select id="plan-status" value={form.is_active ? 'active' : 'inactive'} disabled={readOnly} onChange={event => setForm({ ...form, is_active: event.target.value === 'active' })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="plan-description">Description</label>
                  <textarea id="plan-description" rows="2" maxLength={1000} value={form.description} readOnly={readOnly} onChange={event => setForm({ ...form, description: event.target.value })} />
                </div>
                <fieldset className="membership-branch-fieldset">
                  <legend>Available Branches *</legend>
                  {branches.length === 0 ? (
                    <p className="text-muted">No branches available.</p>
                  ) : (
                    <div className="membership-branch-options">
                      {branches.map(branch => (
                        <label className="membership-branch-option" key={branch.id}>
                          <input
                            type="checkbox"
                            checked={selectedBranches.includes(branch.id)}
                            disabled={readOnly}
                            onChange={event => setSelectedBranches(current => event.target.checked
                              ? [...current, branch.id]
                              : current.filter(id => id !== branch.id)
                            )}
                          />
                          <span>{branch.name}</span>
                          {!branch.is_active && <small>Inactive branch</small>}
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedBranches.length === 0 && !readOnly && (
                    <small className="membership-validation">Select at least one branch.</small>
                  )}
                </fieldset>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setModal(null)} disabled={saving}>
                  {readOnly ? 'Close' : 'Cancel'}
                </button>
                {!readOnly && (
                  <button type="submit" className="btn-primary" disabled={saving || branches.length === 0}>
                    {saving ? 'Saving...' : <><Check size={15} /> {modal.mode === 'create' ? 'Create Plan' : 'Save Changes'}</>}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
