import { deductions, planPantryDeduction, shortfalls } from '../pantryPlan';

const pantry = (name: string, quantity: number, unit: string, id = `${name}-${unit}`) => ({
  id,
  name,
  quantity,
  unit,
});

const needs = (name: string, amount: string, unit: string) => ({ name, amount, unit });

const statusOf = (plan: ReturnType<typeof planPantryDeduction>, name: string) =>
  plan.ingredients.find((i) => i.name === name)?.status;

describe('planPantryDeduction', () => {
  it('deducts what the recipe asks for when there is enough', () => {
    const plan = planPantryDeduction([pantry('flour', 1000, 'g')], [needs('flour', '200', 'g')]);

    expect(plan.canCookNow).toBe(true);
    expect(plan.ingredients[0]).toMatchObject({
      status: 'deduct',
      required: 200,
      available: 1000,
      deduct: 200,
      emptiesPantryItem: false,
    });
  });

  describe('units that measure the same thing', () => {
    it('satisfies a recipe in grams from a pantry in kilograms', () => {
      // The reason deduction silently did nothing: `kg` and `g` are different strings, so
      // the old matcher found no pantry item at all and reported no shortage either.
      const plan = planPantryDeduction([pantry('flour', 1, 'kg')], [needs('flour', '500', 'g')]);

      expect(plan.canCookNow).toBe(true);
      expect(plan.ingredients[0]).toMatchObject({
        status: 'deduct',
        required: 500,
        available: 1000, // expressed in the recipe's unit
        deduct: 0.5, // subtracted in the pantry's unit
        pantryUnit: 'kg',
      });
    });

    it('satisfies a recipe in millilitres from a pantry in litres', () => {
      const plan = planPantryDeduction([pantry('milk', 2, 'L')], [needs('milk', '250', 'ml')]);

      expect(plan.ingredients[0]).toMatchObject({ status: 'deduct', deduct: 0.25 });
    });

    it('treats a plural unit as the same unit', () => {
      const plan = planPantryDeduction(
        [pantry('bread', 4, 'pieces')],
        [needs('bread', '2', 'piece')]
      );

      expect(plan.ingredients[0]).toMatchObject({ status: 'deduct', deduct: 2 });
    });

    it('refuses to convert a mass into a volume', () => {
      // Without a density this is not answerable, and guessing would quietly corrupt
      // somebody's pantry.
      const plan = planPantryDeduction([pantry('honey', 500, 'g')], [needs('honey', '2', 'ml')]);

      expect(plan.ingredients[0]).toMatchObject({
        status: 'missing',
        available: null,
        pantryQuantity: 500,
        pantryUnit: 'g',
        deduct: 0,
      });
    });
  });

  describe('what the old dialog could not say', () => {
    it('reports an ingredient that is not in the pantry at all', () => {
      // Previously invisible: no pantry row meant no entry anywhere, so the recipe was
      // marked cooked with nothing deducted and nothing mentioned.
      const plan = planPantryDeduction([pantry('salt', 100, 'g')], [needs('bread', '2', 'pieces')]);

      expect(statusOf(plan, 'bread')).toBe('missing');
      expect(plan.canCookNow).toBe(false);
      expect(shortfalls(plan).map((i) => i.name)).toEqual(['bread']);
    });

    it('reports an ingredient held in an incomparable unit, and says what you do have', () => {
      const plan = planPantryDeduction(
        [pantry('garlic', 200, 'g')],
        [needs('garlic', '2', 'cloves')]
      );

      expect(plan.ingredients[0]).toMatchObject({
        status: 'missing',
        required: 2,
        unit: 'cloves',
        pantryQuantity: 200,
        pantryUnit: 'g',
      });
    });

    it('separates "not enough" from "none at all"', () => {
      const plan = planPantryDeduction(
        [pantry('sugar', 50, 'g')],
        [needs('sugar', '200', 'g'), needs('butter', '100', 'g')]
      );

      expect(statusOf(plan, 'sugar')).toBe('short');
      expect(statusOf(plan, 'butter')).toBe('missing');
    });
  });

  describe('"to taste"', () => {
    it('is neither a deduction nor a shortage', () => {
      const plan = planPantryDeduction([pantry('salt', 100, 'g')], [needs('salt', 'to taste', '')]);

      expect(plan.ingredients[0]).toMatchObject({ status: 'unmeasured', deduct: 0 });
      expect(plan.canCookNow).toBe(true);
    });

    it('does not hold the pantry item away from a line that can use it', () => {
      // The old planner claimed the pantry row before parsing the amount, so an
      // unmeasurable line locked out a later measurable one for the same ingredient.
      const plan = planPantryDeduction(
        [pantry('salt', 100, 'g')],
        [needs('salt', 'to taste', ''), needs('salt', '20', 'g')]
      );

      expect(plan.ingredients[0].status).toBe('unmeasured');
      expect(plan.ingredients[1]).toMatchObject({ status: 'deduct', deduct: 20 });
    });
  });

  it('never lets two ingredients spend the same pantry item', () => {
    const plan = planPantryDeduction(
      [pantry('egg', 3, 'pieces')],
      [needs('egg', '2', 'pieces'), needs('egg', '1', 'pieces')]
    );

    expect(plan.ingredients[0].status).toBe('deduct');
    expect(plan.ingredients[1].status).toBe('missing');
  });

  it('does not take "rice vinegar" for "rice"', () => {
    const plan = planPantryDeduction(
      [pantry('rice vinegar', 500, 'ml')],
      [needs('rice', '200', 'g')]
    );

    expect(plan.ingredients[0].status).toBe('missing');
    expect(plan.ingredients[0].pantryItemId).toBeNull();
  });

  it('marks a pantry item as emptied when the recipe uses all of it', () => {
    const plan = planPantryDeduction([pantry('milk', 250, 'ml')], [needs('milk', '250', 'ml')]);

    expect(plan.ingredients[0]).toMatchObject({ status: 'deduct', emptiesPantryItem: true });
  });

  it('uses up what is there when short, rather than nothing', () => {
    const plan = planPantryDeduction([pantry('flour', 80, 'g')], [needs('flour', '200', 'g')]);

    expect(plan.ingredients[0]).toMatchObject({
      status: 'short',
      required: 200,
      available: 80,
      deduct: 80,
      emptiesPantryItem: true,
    });
    expect(deductions(plan)).toHaveLength(1);
  });

  it('plans nothing for an empty recipe', () => {
    const plan = planPantryDeduction([pantry('flour', 100, 'g')], []);

    expect(plan.ingredients).toEqual([]);
    expect(plan.canCookNow).toBe(true);
  });

  it('strips markup out of the names and units it reports back', () => {
    const plan = planPantryDeduction([], [needs('<b>flour</b>', '2', '<i>g</i>')]);

    expect(plan.ingredients[0]).toMatchObject({ name: 'flour', unit: 'g' });
  });
});
