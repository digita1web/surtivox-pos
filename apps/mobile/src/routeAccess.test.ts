import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilityForPath } from './routeAccess.ts';
import { can, ROLES, type Role } from './roles.ts';

test('sensitive routes map to the capability the menu already uses', () => {
  const expected: Record<string, string> = {
    '/staff': 'staff', '/add-staff': 'staff', '/reports': 'reports', '/reorder': 'reports',
    '/purchases': 'purchases', '/new-purchase': 'purchases', '/suppliers': 'suppliers', '/add-supplier': 'suppliers',
    '/customers': 'customers', '/customer/abc-123': 'customers', '/data': 'backup',
    '/store-settings': 'shop', '/business-settings': 'shop', '/new-shop': 'shop',
    '/cloud-sync': 'sync', '/paywall': 'sync', '/add-product': 'products',
  };
  for (const [path, capability] of Object.entries(expected)) assert.equal(capabilityForPath(path), capability, path);
});

test('routes every role needs stay open, including the customer form used when charging on credit', () => {
  for (const path of ['/', '/products', '/sales', '/more', '/scan', '/add-customer', '/sale/xyz', '/shops', '/diagnostics', '/legal', '/licenses']) {
    assert.equal(capabilityForPath(path), null, path);
  }
});

test('trailing slashes and query strings do not bypass a guard', () => {
  assert.equal(capabilityForPath('/staff/'), 'staff');
  assert.equal(capabilityForPath('/staff?x=1'), 'staff');
  assert.equal(capabilityForPath('/data//'), 'backup');
});

test('a cashier is blocked from every guarded route and the owner from none', () => {
  const paths = ['/staff', '/add-staff', '/reports', '/purchases', '/suppliers', '/customers', '/data', '/store-settings', '/cloud-sync', '/add-product'];
  const blocked = (role: Role) => paths.filter((p) => !can(role, capabilityForPath(p)!));
  assert.equal(blocked('cashier').length, paths.length);
  assert.deepEqual(blocked('owner'), []);
  assert.ok(blocked('manager').includes('/staff') && blocked('manager').includes('/cloud-sync') && !blocked('manager').includes('/reports'));
  assert.deepEqual(ROLES.length, 3);
});
