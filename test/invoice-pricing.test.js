'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function orderFor(items, coupon, totals) {
  return {
    id: 17,
    date: '26/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice GST and total match the order pricing HSN slab', function () {
  var items = [{ id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 2 }];
  var billed = pricing.computeTotals(items, '');
  var order = orderFor(items, '', billed);
  var printed = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(billed.subtotal, 200);
  assert.equal(billed.discount, 0);
  assert.equal(billed.tax, 10);
  assert.equal(billed.total, 210);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 10);
  assert.deepEqual(
    { mismatchCount: reconciliation.mismatchCount, totalDelta: reconciliation.totalDelta, delta: reconciliation.rows[0].delta },
    { mismatchCount: 0, totalDelta: 0, delta: 0 }
  );
});

test('invoice percentage coupon uses the same capped discount and post-discount GST as order pricing', function () {
  var items = [{ id: 2, name: 'Rice', sku: 'RICE-2', hsn: '1006', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = orderFor(items, 'SAVE10', billed);
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total },
    { subtotal: 2000, discount: 150, tax: 92.5, total: 1942.5 }
  );
  assert.deepEqual(
    { subtotal: printed.subtotal, discount: printed.discount, tax: printed.tax, total: printed.total },
    { subtotal: billed.subtotal, discount: billed.discount, tax: billed.tax, total: billed.total }
  );
  assert.equal(printed.rows[0].gstPercent, 5);
  assert.equal(printed.rows[0].lineTax, 92.5);
});

test('invoice uses the same no-discount result for a coupon that validation rejects', function () {
  var items = [{ id: 3, name: 'Rice', sku: 'RICE-3', hsn: '1006', price: 1000, qty: 1 }];
  var validation = coupons.validate('DIWALI20', 1000);
  var billed = pricing.computeTotals(items, 'DIWALI20');
  var order = orderFor(items, 'DIWALI20', billed);
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual(validation, { valid: false, error: 'Coupon DIWALI20 has expired' });
  assert.equal(billed.discount, 0);
  assert.equal(billed.total, 1050);
  assert.equal(printed.discount, billed.discount);
  assert.equal(printed.tax, billed.tax);
  assert.equal(printed.total, billed.total);
});
