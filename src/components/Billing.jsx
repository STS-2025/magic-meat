import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Smartphone,
  Banknote,
  Clock,
  Printer,
  AlertCircle,
  Scissors,
  User,
  Phone,
  Layers,
  Sparkles
} from 'lucide-react';
import { fetchProducts, fetchBranchStock, processSale } from '../services/supabase.js';
import { CUTTING_STYLES } from '../services/mockData.js';
import ReceiptModal from './ReceiptModal.jsx';
import { useToast } from './ToastProvider.jsx';

let billingDraftCache = null;

export function resetBillingDraftCache() {
  billingDraftCache = null;
}

function getSavedBillingDraft() {
  return billingDraftCache || {};
}

export default function Billing({ profile, activeBranch, branches, onSelectBranch }) {
  const toast = useToast();
  const [savedDraft] = useState(getSavedBillingDraft);
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState(savedDraft.cart || []);
  const [gramInputs, setGramInputs] = useState({});
  const [customerName, setCustomerName] = useState(savedDraft.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(savedDraft.customerPhone || '');
  const [paymentMethod, setPaymentMethod] = useState(savedDraft.paymentMethod || 'cash');
  const [tenderedAmount, setTenderedAmount] = useState(savedDraft.tenderedAmount || '');
  const [loading, setLoading] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const categories = ['All', 'Chicken', 'Mutton', 'Fish & Seafood', 'Eggs & Marinades', 'Specialty'];

  const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(n || 0));

  const currentBranchId = activeBranch?.id || profile?.branch_id || (branches && branches[0]?.id);
  const currentBranch = branches?.find(b => b.id === currentBranchId) || activeBranch || branches?.[0];

  useEffect(() => {
    loadData();
  }, [currentBranchId]);

  useEffect(() => {
    billingDraftCache = { cart, customerName, customerPhone, paymentMethod, tenderedAmount };
  }, [cart, customerName, customerPhone, paymentMethod, tenderedAmount]);

  async function loadData() {
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      fetchProducts(currentBranchId),
      currentBranchId ? fetchBranchStock(currentBranchId) : { data: {} }
    ]);
    setProducts(pRes.data || []);
    setStockMap(sRes.data || {});
    setLoading(false);
  }

  // Filtered products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (!p.is_active) return false;
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.tamil_name && p.tamil_name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  function addToCart(product, grams = 500) {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, grams: item.grams + grams } : item
        );
      }
      return [
        ...prev,
        {
          ...product,
          grams: grams,
          cuttingStyle: 'Curry Cut (Medium)'
        }
      ];
    });
  }

  function updateItemGrams(productId, grams) {
    const g = Math.max(1, Number(grams) || 1);
    setCart(prev =>
      prev.map(item => (item.id === productId ? { ...item, grams: g } : item))
    );
  }

  function handleGramInputChange(productId, value) {
    setGramInputs(prev => ({ ...prev, [productId]: value }));
    if (/^\d+$/.test(value) && Number(value) > 0) {
      updateItemGrams(productId, value);
    }
  }

  function finishGramInput(productId) {
    setGramInputs(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  function adjustGrams(productId, delta) {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === productId) {
            const next = item.grams + delta;
            return next > 0 ? { ...item, grams: next } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  }

  function updateCuttingStyle(productId, style) {
    setCart(prev =>
      prev.map(item => (item.id === productId ? { ...item, cuttingStyle: style } : item))
    );
  }

  function removeFromCart(productId) {
    setCart(prev => prev.filter(item => item.id !== productId));
  }

  function clearCart() {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setTenderedAmount('');
  }

  // Cart totals
  const totalWeightGrams = cart.reduce((acc, item) => acc + item.grams, 0);
  const totalAmount = cart.reduce(
    (acc, item) => acc + (item.grams / 1000) * Number(item.price_per_kg),
    0
  );

  const tenderedNum = Number(tenderedAmount) || totalAmount;
  const changeAmount = Math.max(0, tenderedNum - totalAmount);

  // Checkout execution
  async function handleCheckout() {
    if (cart.length === 0) return;

    setLoading(true);
    try {
      const res = await processSale({
        branchId: currentBranchId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        paymentMethod,
        tenderedAmount: paymentMethod === 'cash' ? tenderedNum : totalAmount,
        items: cart,
        cashierName: profile?.full_name || 'Staff Cashier'
      });

      if (res.success) {
        const saleRecord = res.sale || {
          invoice_no: res.invoiceNo,
          invoice_code: res.invoiceCode,
          branch_id: currentBranchId,
          branch_name: currentBranch?.name,
          cashier_name: profile?.full_name || 'Staff Cashier',
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_method: paymentMethod,
          subtotal: totalAmount,
          total_amount: totalAmount,
          tendered_amount: paymentMethod === 'cash' ? tenderedNum : totalAmount,
          change_amount: changeAmount,
          created_at: new Date().toISOString(),
          items: cart.map(it => ({
            product_name: it.name,
            qty_grams: it.grams,
            price_per_kg: it.price_per_kg,
            cutting_style: it.cuttingStyle,
            line_total: (it.grams / 1000) * it.price_per_kg
          }))
        };

        setLastSale(saleRecord);
        setShowReceipt(true);
        clearCart();
        loadData(); // reload stock
        toast(`Bill #${res.invoiceCode || res.invoiceNo} successfully generated!`);
      } else {
        toast('Could not complete sale: ' + (res.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      toast('Checkout error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pos-container">
      {/* Top Banner & Branch Switcher (Owner can switch branch billing) */}
      <div className="pos-sub-header">
        <div className="branch-meta">
          <span className="pos-dot"></span>
          <div>
            <strong>{currentBranch?.name || 'Branch Billing'}</strong>
            <span className="branch-code-badge">{currentBranch?.code}</span>
          </div>
        </div>

        {profile?.role === 'owner' && branches && branches.length > 1 && (
          <div className="owner-branch-switch">
            <span>Switch Counter:</span>
            <select
              value={currentBranchId}
              onChange={e => {
                const b = branches.find(x => x.id === e.target.value);
                if (b && onSelectBranch) onSelectBranch(b);
              }}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pos-quick-stats">
          <span>Fresh Meat POS Counter</span>
        </div>
      </div>

      {/* Main Split Layout: Left Catalogue, Right Cart Drawer */}
      <div className="pos-grid">
        {/* LEFT COLUMN: Product Catalogue & Quick Weigh */}
        <div className="pos-catalogue-pane">
          {/* Search & Category Pills */}
          <div className="catalogue-controls">
            <div className="search-bar-wrap">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search Chicken, Mutton, Fish, SKU, நாட்டுக்கோழி..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search" onClick={() => setSearchQuery('')}>×</button>
              )}
            </div>

            <div className="category-scroll-pills">
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === 'All' && '🥩 All Items'}
                  {cat === 'Chicken' && '🐔 Chicken'}
                  {cat === 'Mutton' && '🐐 Mutton'}
                  {cat === 'Fish & Seafood' && '🐟 Seafood'}
                  {cat === 'Eggs & Marinades' && '🥚 Eggs & Masala'}
                  {cat === 'Specialty' && '✨ Special Cuts'}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="products-grid">
            {filteredProducts.map(p => {
              const currentStockGrams = stockMap[p.id] || 0;
              const stockKg = (currentStockGrams / 1000).toFixed(1);
              const isLowStock = currentStockGrams < 5000;

              return (
                <div key={p.id} className="pos-product-card">
                  <div className="card-top">
                    <span className="card-cat-badge">{p.category}</span>
                    <span className={`stock-badge ${isLowStock ? 'stock-low' : 'stock-ok'}`}>
                      {stockKg} kg left
                    </span>
                  </div>

                  <h3 className="product-title">{p.name}</h3>
                  {p.tamil_name && <span className="product-tamil">{p.tamil_name}</span>}

                  <div className="product-pricing">
                    <span className="rate-num">{money(p.price_per_kg)}</span>
                    <span className="rate-unit">/ {p.unit || 'kg'}</span>
                  </div>

                  {/* Meat Shop Quick Weight Add Buttons */}
                  <div className="weight-presets">
                    <button
                      className="weight-btn"
                      title="Add 250 grams"
                      onClick={() => addToCart(p, 250)}
                    >
                      +250g
                    </button>
                    <button
                      className="weight-btn"
                      title="Add 500 grams (Half KG)"
                      onClick={() => addToCart(p, 500)}
                    >
                      +500g
                    </button>
                    <button
                      className="weight-btn"
                      title="Add 1000 grams (1 KG)"
                      onClick={() => addToCart(p, 1000)}
                    >
                      +1 kg
                    </button>
                    <button
                      className="weight-btn"
                      title="Add 2000 grams (2 KG)"
                      onClick={() => addToCart(p, 2000)}
                    >
                      +2 kg
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="empty-state">
              <p>No products found matching "{searchQuery}".</p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Cart / Billing Panel */}
        <div className="pos-cart-pane">
          <div className="cart-header">
            <div className="cart-title">
              <ShoppingCart size={20} />
              <span>Current Order</span>
              <span className="cart-count-badge">{cart.length}</span>
            </div>
            {cart.length > 0 && (
              <button className="clear-cart-btn" onClick={clearCart}>
                <Trash2 size={14} /> Clear
              </button>
            )}
          </div>

          {/* Customer Info (Optional) */}
          <div className="customer-inputs-grid">
            <div className="input-group">
              <User size={14} className="input-icon" />
              <input
                type="text"
                placeholder="Customer Name (Optional)"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <Phone size={14} className="input-icon" />
              <input
                type="text"
                placeholder="Phone (Optional)"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="cart-items-scroll">
            {cart.length === 0 ? (
              <div className="cart-empty-state">
                <ShoppingCart size={40} className="empty-cart-icon" />
                <p>Counter Cart is Empty</p>
                <small>Click any meat item or weight preset on the left to add.</small>
              </div>
            ) : (
              cart.map(item => {
                const lineTotal = (item.grams / 1000) * item.price_per_kg;

                return (
                  <div key={item.id} className="cart-item-card">
                    <div className="item-row-top">
                      <div>
                        <strong className="item-name">{item.name}</strong>
                        <span className="item-unit-rate">₹{item.price_per_kg}/kg</span>
                      </div>
                      <div className="item-total-col">
                        <strong>{money(lineTotal)}</strong>
                        <button
                          className="item-delete-btn"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Weight Controls & Cutting Style */}
                    <div className="item-row-bottom">
                      <div className="weight-adjust-group">
                        <button
                          className="step-btn"
                          onClick={() => adjustGrams(item.id, -250)}
                          title="Minus 250g"
                        >
                          <Minus size={12} />
                        </button>
                        <div className="gram-input-wrap">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={gramInputs[item.id] ?? item.grams}
                            onFocus={e => {
                              setGramInputs(prev => ({ ...prev, [item.id]: String(item.grams) }));
                              e.currentTarget.select();
                            }}
                            onChange={e => handleGramInputChange(item.id, e.target.value)}
                            onBlur={() => finishGramInput(item.id)}
                          />
                          <span className="g-unit">g</span>
                        </div>
                        <button
                          className="step-btn"
                          onClick={() => adjustGrams(item.id, 250)}
                          title="Plus 250g"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Meat Cutting Style Dropdown */}
                      <div className="cut-style-wrap">
                        <Scissors size={12} className="cut-icon" />
                        <select
                          value={item.cuttingStyle}
                          onChange={e => updateCuttingStyle(item.id, e.target.value)}
                        >
                          {CUTTING_STYLES.map(style => (
                            <option key={style} value={style}>
                              {style}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary & Payment */}
          {cart.length > 0 && (
            <div className="cart-checkout-footer">
              {/* Payment Method Selector */}
              <div className="payment-method-selector">
                <span className="pay-label">Payment Mode:</span>
                <div className="payment-buttons">
                  <button
                    className={`pay-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('cash')}
                  >
                    <Banknote size={16} /> Cash
                  </button>
                  <button
                    className={`pay-btn ${paymentMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('upi')}
                  >
                    <Smartphone size={16} /> UPI / QR
                  </button>
                  <button
                    className={`pay-btn ${paymentMethod === 'card' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    <CreditCard size={16} /> Card
                  </button>
                </div>
              </div>

              {/* Cash Tendered & Change Helper */}
              {paymentMethod === 'cash' && (
                <div className="cash-tender-box">
                  <div className="tender-row">
                    <span>Cash Received:</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={totalAmount.toFixed(0)}
                      value={tenderedAmount}
                      onFocus={e => e.currentTarget.select()}
                      onChange={e => setTenderedAmount(e.target.value)}
                    />
                  </div>
                  <div className="quick-cash-notes">
                    {[100, 200, 500, 1000, 2000].map(val => (
                      <button
                        key={val}
                        className="note-btn"
                        onClick={() => setTenderedAmount(String(val))}
                      >
                        ₹{val}
                      </button>
                    ))}
                    <button
                      className="note-btn exact-btn"
                      onClick={() => setTenderedAmount(String(Math.round(totalAmount)))}
                    >
                      Exact
                    </button>
                  </div>
                  {tenderedNum > totalAmount && (
                    <div className="change-return-row">
                      <span>Change to Return:</span>
                      <strong className="change-amount">{money(changeAmount)}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* UPI QR Assistant */}
              {paymentMethod === 'upi' && (
                <div className="upi-qr-helper">
                  <div className="upi-badge">
                    <Smartphone size={16} /> Instant UPI Payment: {money(totalAmount)}
                  </div>
                  <small>Ask customer to scan shop GPay / PhonePe QR code</small>
                </div>
              )}

              {/* Grand Total Row */}
              <div className="bill-summary-card">
                <div className="summary-line">
                  <span>Total Weight:</span>
                  <span>{(totalWeightGrams / 1000).toFixed(2)} kg</span>
                </div>
                <div className="summary-line grand-total-line">
                  <span>Grand Total:</span>
                  <span className="grand-amount">{money(totalAmount)}</span>
                </div>
              </div>

              {/* Big Checkout Action */}
              <button
                className="checkout-action-btn"
                onClick={handleCheckout}
                disabled={loading || cart.length === 0}
              >
                <Printer size={20} />
                <span>
                  {loading
                    ? 'Processing Sale...'
                    : `Complete & Print Bill (${money(totalAmount)})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        sale={lastSale}
        branch={currentBranch}
      />
    </div>
  );
}
