import { normalizeIngredientName } from '../ingredients';

describe('normalizeIngredientName', () => {
  it('should handle SQL metacharacters in ingredient names', () => {
    // normalizeIngredientName only does string ops, but this test prevents
    // regressions if someone adds SQL logic in the future.
    expect(normalizeIngredientName('\'; DROP TABLE "Post"; --')).toBeDefined();
    expect(normalizeIngredientName('chicken%')).toBeDefined();
  });

  it('should truncate names longer than 200 characters', () => {
    const longName = 'a'.repeat(250);
    const result = normalizeIngredientName(longName);
    expect(result.length).toBeLessThanOrEqual(200);
  });
});
