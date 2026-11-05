import { expect, test } from 'vitest';
import { activeTab, backTarget, tabsFor } from '@/client/nav';

test('tabs by role', () => {
  expect(tabsFor('admin').map((t) => t.key)).toEqual(['home', 'budgets', 'add', 'bills', 'activity']);
  expect(tabsFor('viewer').map((t) => t.key)).toEqual(['home', 'budgets', 'bills', 'activity']);
});
test('active tab', () => {
  const tabs = tabsFor('admin');
  expect(activeTab('/month/2026-11', tabs)).toBe('budgets');
  expect(activeTab('/capture/abc', tabs)).toBe('add');
  expect(activeTab('/year/2027', tabs)).toBe('bills');
  expect(activeTab('/inbox', tabs)).toBe('activity');
});
test('Back with no history goes to the tab root', () => {
  expect(backTarget('/year/2027')).toBe('/forecast');
  expect(backTarget('/month/2026-11/review')).toBe('/budgets');
  expect(backTarget('/settings/family')).toBe('/activity');
  expect(backTarget('/somewhere-else')).toBe('/home');
});
