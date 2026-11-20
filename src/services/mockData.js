// Mock seed data for instant testing and resilient offline/pre-migration fallback
export const INITIAL_BRANCHES = [
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    code: 'BR001',
    name: 'Chennai',
    address: 'Chennai, Tamil Nadu',
    phone: '+91 98401 22334',
    is_active: true
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    code: 'BR002',
    name: 'Trichy',
    address: 'Tiruchirappalli, Tamil Nadu',
    phone: '+91 98402 33445',
    is_active: true
  },
  {
    id: 'b3333333-3333-3333-3333-333333333333',
    code: 'BR003',
    name: 'Tirunelveli',
    address: 'Tirunelveli, Tamil Nadu',
    phone: '+91 98403 44556',
    is_active: true
  }
];

export const INITIAL_PRODUCTS = [
  {
    id: 'p1111111-1111-1111-1111-111111111111',
    sku: 'CH-001',
    name: 'Fresh Broiler Chicken',
    tamil_name: 'பிராய்லர் கோழி',
    category: 'Chicken',
    unit: 'kg',
    price_per_kg: 240,
    is_active: true
  },
  {
    id: 'p2222222-2222-2222-2222-222222222222',
    sku: 'CH-002',
    name: 'Country Chicken (Nattu Kozhi)',
    tamil_name: 'நாட்டுக்கோழி',
    category: 'Chicken',
    unit: 'kg',
    price_per_kg: 580,
    is_active: true
  },
  {
    id: 'p3333333-3333-3333-3333-333333333333',
    sku: 'CH-003',
    name: 'Chicken Keema (Minced)',
    tamil_name: 'சிக்கன் கீமா',
    category: 'Chicken',
    unit: 'kg',
    price_per_kg: 320,
    is_active: true
  },
  {
    id: 'p4444444-4444-4444-4444-444444444444',
    sku: 'CH-004',
    name: 'Chicken Breast Boneless',
    tamil_name: 'போன்லெஸ் சிக்கன்',
    category: 'Chicken',
    unit: 'kg',
    price_per_kg: 380,
    is_active: true
  },
  {
    id: 'p5555555-5555-5555-5555-555555555555',
    sku: 'MT-001',
    name: 'Goat Mutton Curry Cut',
    tamil_name: 'ஆட்டுக்கறி (கறி துண்டுகள்)',
    category: 'Mutton',
    unit: 'kg',
    price_per_kg: 860,
    is_active: true
  },
  {
    id: 'p6666666-6666-6666-6666-666666666666',
    sku: 'MT-002',
    name: 'Goat Mutton Biryani Cut',
    tamil_name: 'பிரியாணி மட்டன் கட்',
    category: 'Mutton',
    unit: 'kg',
    price_per_kg: 890,
    is_active: true
  },
  {
    id: 'p7777777-7777-7777-7777-777777777777',
    sku: 'MT-003',
    name: 'Fresh Mutton Liver (Eeral)',
    tamil_name: 'மட்டன் ஈரல்',
    category: 'Mutton',
    unit: 'kg',
    price_per_kg: 900,
    is_active: true
  },
  {
    id: 'p8888888-8888-8888-8888-888888888888',
    sku: 'FS-001',
    name: 'Vanjaram / Seer Fish Slices',
    tamil_name: 'வஞ்சிரம் மீன்',
    category: 'Fish & Seafood',
    unit: 'kg',
    price_per_kg: 950,
    is_active: true
  },
  {
    id: 'p9999999-9999-9999-9999-999999999999',
    sku: 'FS-002',
    name: 'Fresh Tiger Prawns (Cleaned)',
    tamil_name: 'இறால்',
    category: 'Fish & Seafood',
    unit: 'kg',
    price_per_kg: 650,
    is_active: true
  },
  {
    id: 'paaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sku: 'EG-001',
    name: 'Country Hen Eggs (Pack of 6)',
    tamil_name: 'நாட்டுக்கோழி முட்டை',
    category: 'Eggs & Marinades',
    unit: 'pack',
    price_per_kg: 90,
    is_active: true
  },
  {
    id: 'pbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    sku: 'SP-001',
    name: 'Tandoori Peri-Peri Marinade Chicken',
    tamil_name: 'மசாலா மேரினேட் சிக்கன்',
    category: 'Specialty',
    unit: 'kg',
    price_per_kg: 340,
    is_active: true
  }
];

export const INITIAL_INVENTORY = {
  // BR001 (Chennai)
  'b1111111-1111-1111-1111-111111111111': {
    'p1111111-1111-1111-1111-111111111111': 118500, // 118.5 kg
    'p2222222-2222-2222-2222-222222222222': 42000,
    'p3333333-3333-3333-3333-333333333333': 18500,
    'p4444444-4444-4444-4444-444444444444': 25000,
    'p5555555-5555-5555-5555-555555555555': 54000,
    'p6666666-6666-6666-6666-666666666666': 38000,
    'p7777777-7777-7777-7777-777777777777': 12000,
    'p8888888-8888-8888-8888-888888888888': 28500,
    'p9999999-9999-9999-9999-999999999999': 22000,
    'paaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': 45000,
    'pbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': 24000
  },
  // BR002 (Trichy)
  'b2222222-2222-2222-2222-222222222222': {
    'p1111111-1111-1111-1111-111111111111': 85000,
    'p2222222-2222-2222-2222-222222222222': 31000,
    'p5555555-5555-5555-5555-555555555555': 48000,
    'p6666666-6666-6666-6666-666666666666': 27000,
    'p8888888-8888-8888-8888-888888888888': 18000,
    'p9999999-9999-9999-9999-999999999999': 14000
  },
  // BR003 (Tirunelveli)
  'b3333333-3333-3333-3333-333333333333': {
    'p1111111-1111-1111-1111-111111111111': 72000,
    'p2222222-2222-2222-2222-222222222222': 22000,
    'p5555555-5555-5555-5555-555555555555': 36000,
    'p8888888-8888-8888-8888-888888888888': 14000
  }
};

export const INITIAL_SALES = [
  {
    id: 's-001',
    invoice_no: 1001,
    invoice_code: 'MM-20261110-1001',
    branch_id: 'b1111111-1111-1111-1111-111111111111',
    branch_name: 'Chennai',
    cashier_name: 'Karthik Raja',
    customer_name: 'Sundar Raman',
    customer_phone: '9840199887',
    payment_method: 'upi',
    subtotal: 1240,
    total_amount: 1240,
    tendered_amount: 1240,
    change_amount: 0,
    status: 'completed',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    items: [
      {
        product_name: 'Fresh Broiler Chicken',
        qty_grams: 1500,
        price_per_kg: 240,
        cutting_style: 'Curry Cut',
        line_total: 360
      },
      {
        product_name: 'Goat Mutton Curry Cut',
        qty_grams: 1000,
        price_per_kg: 860,
        cutting_style: 'Biryani Cut',
        line_total: 860
      },
      {
        product_name: 'Country Hen Eggs (Pack of 6)',
        qty_grams: 220,
        price_per_kg: 90,
        cutting_style: 'Standard',
        line_total: 20
      }
    ]
  },
  {
    id: 's-002',
    invoice_no: 1002,
    invoice_code: 'MM-20261110-1002',
    branch_id: 'b1111111-1111-1111-1111-111111111111',
    branch_name: 'Chennai',
    cashier_name: 'Karthik Raja',
    customer_name: 'Dr. Priya V',
    customer_phone: '9940023456',
    payment_method: 'card',
    subtotal: 1900,
    total_amount: 1900,
    tendered_amount: 1900,
    change_amount: 0,
    status: 'completed',
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    items: [
      {
        product_name: 'Vanjaram / Seer Fish Slices',
        qty_grams: 2000,
        price_per_kg: 950,
        cutting_style: 'Steak Cut',
        line_total: 1900
      }
    ]
  },
  {
    id: 's-003',
    invoice_no: 1003,
    invoice_code: 'MM-20261110-1003',
    branch_id: 'b2222222-2222-2222-2222-222222222222',
    branch_name: 'Trichy',
    cashier_name: 'Manoj Kumar',
    customer_name: 'Aravind K',
    customer_phone: '9789012345',
    payment_method: 'cash',
    subtotal: 720,
    total_amount: 720,
    tendered_amount: 1000,
    change_amount: 280,
    status: 'completed',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    items: [
      {
        product_name: 'Fresh Broiler Chicken',
        qty_grams: 3000,
        price_per_kg: 240,
        cutting_style: 'Curry Cut',
        line_total: 720
      }
    ]
  }
];

export const CUTTING_STYLES = [
  'Curry Cut (Medium)',
  'Biryani Cut (Large)',
  'Boneless / Fillet',
  'Keema (Minced)',
  'Soup Bones & Ribs',
  'Skinless / Clean'
];
