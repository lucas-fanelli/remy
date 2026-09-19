import { formatServings, getIngredientParts } from '../displayFormat';

describe('getIngredientParts', () => {
  it('should print the amount and the unit in front of the name', () => {
    const parts = getIngredientParts({ name: 'Flour', amount: '200', unit: 'g' });

    expect(parts).toEqual({ quantity: '200 g', name: 'Flour', toTaste: false });
  });

  it("should not print the unit when it is exactly 'units'", () => {
    const parts = getIngredientParts({ name: 'eggs', amount: '2', unit: 'units' });

    expect(parts.quantity).toBe('2');
  });

  it('should print a legacy unit as it is stored', () => {
    const parts = getIngredientParts({ name: 'Onion', amount: '1', unit: 'whole' });

    expect(parts.quantity).toBe('1 whole');
  });

  it('should flag a to-taste row and leave the quantity empty', () => {
    const parts = getIngredientParts({ name: 'Salt', amount: '', unit: 'to taste' });

    expect(parts).toEqual({ quantity: '', name: 'Salt', toTaste: true });
  });

  it('should recognise a to-taste unit stored with another casing', () => {
    const parts = getIngredientParts({ name: 'Salt', amount: '', unit: 'To Taste' });

    expect(parts.toTaste).toBe(true);
  });

  it('should keep the amount of a legacy to-taste row', () => {
    const parts = getIngredientParts({ name: 'Lemon', amount: '1', unit: 'to taste' });

    expect(parts).toEqual({ quantity: '1', name: 'Lemon', toTaste: true });
  });

  it('should return an empty quantity when there is neither amount nor unit', () => {
    const parts = getIngredientParts({ name: 'Water', amount: ' ', unit: '' });

    expect(parts).toEqual({ quantity: '', name: 'Water', toTaste: false });
  });
});

describe('formatServings', () => {
  it('should use the singular for one serving', () => {
    expect(formatServings(1)).toBe('1 serving');
  });

  it('should use the plural for any other number', () => {
    expect(formatServings(4)).toBe('4 servings');
  });
});
