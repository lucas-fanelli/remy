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

  // Seeded recipes store `amount: 400`, and the repository only casts the Json column
  describe('rows that are not three strings', () => {
    it('should print a numeric amount', () => {
      const parts = getIngredientParts({ name: 'spaghetti', amount: 400, unit: 'g' });

      expect(parts).toEqual({ quantity: '400 g', name: 'spaghetti', toTaste: false });
    });

    it('should print a fractional numeric amount as it is stored', () => {
      const parts = getIngredientParts({ name: 'butter', amount: 0.5, unit: 'cup' });

      expect(parts.quantity).toBe('0.5 cup');
    });

    it('should print only the unit when the amount is null', () => {
      const parts = getIngredientParts({ name: 'oil', amount: null, unit: 'splash' });

      expect(parts).toEqual({ quantity: 'splash', name: 'oil', toTaste: false });
    });

    it('should print only the amount when the unit is null', () => {
      const parts = getIngredientParts({ name: 'eggs', amount: 2, unit: null });

      expect(parts).toEqual({ quantity: '2', name: 'eggs', toTaste: false });
    });

    it('should not throw when the amount and the unit are missing', () => {
      const parts = getIngredientParts({ name: 'Water' });

      expect(parts).toEqual({ quantity: '', name: 'Water', toTaste: false });
    });

    it('should return an empty name when the name is null', () => {
      const parts = getIngredientParts({ name: null, amount: '1', unit: 'g' });

      expect(parts.name).toBe('');
    });
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
