import { normalizeUrlPath } from './url.utils';

describe('normalizeUrlPath', () => {
  it('replaces numeric path segments with {id}', () => {
    expect(normalizeUrlPath('https://api.example.com/users/42')).toBe('/users/{id}');
  });

  it('replaces UUID path segments with {id}', () => {
    expect(normalizeUrlPath('https://api.example.com/orders/550e8400-e29b-41d4-a716-446655440000/items'))
      .toBe('/orders/{id}/items');
  });

  it('replaces long hex strings with {id}', () => {
    expect(normalizeUrlPath('https://api.example.com/docs/507f1f77bcf86cd799439011'))
      .toBe('/docs/{id}');
  });

  it('replaces long alphanumeric tokens with {id}', () => {
    expect(normalizeUrlPath('https://api.example.com/sessions/abc123def456xyz'))
      .toBe('/sessions/{id}');
  });

  it('keeps short readable slugs as-is', () => {
    expect(normalizeUrlPath('https://api.example.com/products/blue-widget')).toBe('/products/blue-widget');
  });

  it('keeps short purely alphabetic segments as-is', () => {
    expect(normalizeUrlPath('https://api.example.com/api/v2/users')).toBe('/api/v2/users');
  });

  it('normalizes multiple dynamic segments', () => {
    expect(normalizeUrlPath('https://api.example.com/users/123/orders/456'))
      .toBe('/users/{id}/orders/{id}');
  });

  it('returns the original string on invalid URL', () => {
    expect(normalizeUrlPath('not-a-url')).toBe('not-a-url');
  });
});
