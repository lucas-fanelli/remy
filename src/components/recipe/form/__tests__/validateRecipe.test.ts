import fs from 'fs';
import path from 'path';
import { text } from '@/i18n/text';
import { RECIPE_LIMITS, RECIPE_UNITS, UNIT_TO_TASTE } from '@/lib/constants';
import { RecipeFormValues, RecipeIssue } from '../types';
import { isPathWithin, sectionOfPath, validateRecipe } from '../validateRecipe';
import { COVER_URL, makeValues, STEP_URL } from './fixtures';

/**
 * validateRecipe names messages instead of writing them (docs/I18N.md), so the tests assert
 * on the descriptor - which is the intent, and does not move when the copy is reworded.
 */
const messagesOf = (values: RecipeFormValues) => validateRecipe(values).map((i) => i.message);
const issueAt = (values: RecipeFormValues, issuePath: string): RecipeIssue | undefined =>
  validateRecipe(values).find((issue) => issue.path === issuePath);

describe('validateRecipe', () => {
  it('should find nothing wrong with a complete recipe', () => {
    expect(validateRecipe(makeValues())).toEqual([]);
  });

  describe('basics', () => {
    it('should ask for a title when it is blank', () => {
      expect(issueAt(makeValues({ title: '   ' }), 'title')).toEqual({
        path: 'title',
        section: 'basics',
        label: text('recipeForm.fields.title'),
        message: text('recipeForm.issues.titleRequired'),
      });
    });

    it('should reject a title over the limit', () => {
      const title = 'a'.repeat(RECIPE_LIMITS.title + 1);

      expect(issueAt(makeValues({ title }), 'title')?.message).toEqual(
        text('recipeForm.issues.titleTooLong', { max: 100 })
      );
    });

    it('should accept a title exactly at the limit', () => {
      const title = 'a'.repeat(RECIPE_LIMITS.title);

      expect(issueAt(makeValues({ title }), 'title')).toBeUndefined();
    });

    it('should name the field and the fix when the cook time is missing', () => {
      expect(issueAt(makeValues({ cookingTime: '' }), 'cookingTime')?.message).toEqual(
        text('recipeForm.issues.cookTimeRange', { min: 1, max: 720 })
      );
    });

    it.each([0, 721, 1.5])('should reject a cook time of %p', (cookingTime) => {
      expect(issueAt(makeValues({ cookingTime }), 'cookingTime')).toBeDefined();
    });

    it.each([1, 720])('should accept a cook time of %p', (cookingTime) => {
      expect(issueAt(makeValues({ cookingTime }), 'cookingTime')).toBeUndefined();
    });

    it('should accept a prep time of zero', () => {
      expect(issueAt(makeValues({ prepTime: 0 }), 'prepTime')).toBeUndefined();
    });

    it.each(['' as const, -1, 481, 2.5])('should reject a prep time of %p', (prepTime) => {
      expect(issueAt(makeValues({ prepTime }), 'prepTime')?.message).toEqual(
        text('recipeForm.issues.prepTimeRange', { min: 0, max: 480 })
      );
    });

    it.each(['' as const, 0, 101, 2.5])('should reject servings of %p', (servings) => {
      expect(issueAt(makeValues({ servings }), 'servings')?.message).toEqual(
        text('recipeForm.issues.servingsRange', { min: 1, max: 100 })
      );
    });

    it('should reject a difficulty outside easy, medium and hard', () => {
      const values = makeValues({ difficulty: 'extreme' as RecipeFormValues['difficulty'] });

      expect(issueAt(values, 'difficulty')?.section).toBe('basics');
    });
  });

  describe('ingredients', () => {
    it('should ask for an ingredient when every row is blank', () => {
      const values = makeValues({ ingredients: [{ id: 'i1', name: '', amount: '', unit: '' }] });

      expect(issueAt(values, 'ingredients')?.message).toEqual(
        text('recipeForm.issues.ingredientsRequired')
      );
    });

    it('should ignore blank rows wherever they are', () => {
      const values = makeValues({
        ingredients: [
          { id: 'i1', name: '', amount: '', unit: '' },
          { id: 'i2', name: 'Flour', amount: '2', unit: 'cups' },
          { id: 'i3', name: '', amount: '', unit: '' },
        ],
      });

      expect(validateRecipe(values)).toEqual([]);
    });

    it('should name a row that has an amount or unit but no name', () => {
      const values = makeValues({
        ingredients: [
          { id: 'i1', name: 'Flour', amount: '2', unit: 'cups' },
          { id: 'i2', name: '', amount: '3', unit: 'g' },
        ],
      });

      expect(issueAt(values, 'ingredients.i2.name')).toEqual({
        path: 'ingredients.i2.name',
        section: 'ingredients',
        label: text('recipeForm.fields.ingredientAt', { position: 2 }),
        message: text('recipeForm.issues.ingredientNameRequired', { position: 2 }),
      });
    });

    it('should ask for an amount, by ingredient name, when a real unit has none', () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Flour', amount: '', unit: 'g' }],
      });

      expect(issueAt(values, 'ingredients.i1.amount')?.message).toEqual(
        text('recipeForm.issues.ingredientAmountRequired', {
          named: 'yes',
          name: 'Flour',
          position: 1,
        })
      );
    });

    it('should accept a named row without amount or unit as to taste', () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Salt', amount: '', unit: '' }],
      });

      expect(validateRecipe(values)).toEqual([]);
    });

    it('should accept a named row with the explicit to-taste unit', () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Salt', amount: '', unit: UNIT_TO_TASTE }],
      });

      expect(validateRecipe(values)).toEqual([]);
    });

    it("should accept an amount without a unit because 'units' is filled in", () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Eggs', amount: '2', unit: '' }],
      });

      expect(validateRecipe(values)).toEqual([]);
    });

    it('should accept a legacy unit that is not in the unit list', () => {
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Eggs', amount: '2', unit: 'pieces' }],
      });

      expect(validateRecipe(values)).toEqual([]);
    });

    it('should reject an ingredient name over the limit', () => {
      const name = 'a'.repeat(RECIPE_LIMITS.name + 1);
      const values = makeValues({ ingredients: [{ id: 'i1', name, amount: '1', unit: 'g' }] });

      expect(issueAt(values, 'ingredients.i1.name')?.message).toEqual(
        text('recipeForm.issues.ingredientNameTooLong', { position: 1, max: 200 })
      );
    });

    it('should reject an amount over the limit', () => {
      const amount = '1'.repeat(RECIPE_LIMITS.amount + 1);
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Flour', amount, unit: 'g' }],
      });

      expect(issueAt(values, 'ingredients.i1.amount')?.message).toEqual(
        text('recipeForm.issues.ingredientAmountTooLong', {
          named: 'yes',
          name: 'Flour',
          position: 1,
          max: 50,
        })
      );
    });

    it('should reject a unit over the limit', () => {
      const unit = 'u'.repeat(RECIPE_LIMITS.unit + 1);
      const values = makeValues({
        ingredients: [{ id: 'i1', name: 'Flour', amount: '1', unit }],
      });

      expect(issueAt(values, 'ingredients.i1.unit')?.message).toEqual(
        text('recipeForm.issues.ingredientUnitTooLong', {
          named: 'yes',
          name: 'Flour',
          position: 1,
          max: 50,
        })
      );
    });

    it('should fall back to the position in messages when the row has no name', () => {
      const values = makeValues({ ingredients: [{ id: 'i1', name: '', amount: '', unit: 'g' }] });

      expect(issueAt(values, 'ingredients.i1.amount')?.message).toEqual(
        text('recipeForm.issues.ingredientAmountRequired', {
          named: 'no',
          name: '',
          position: 1,
        })
      );
    });

    it('should say how many ingredients to remove when there are too many', () => {
      const ingredients = Array.from({ length: RECIPE_LIMITS.ingredients + 2 }, (_, i) => ({
        id: `i${i}`,
        name: `Ingredient ${i}`,
        amount: '1',
        unit: 'g',
      }));

      expect(issueAt(makeValues({ ingredients }), 'ingredients')?.message).toEqual(
        text('recipeForm.issues.ingredientsTooMany', { max: 100, extra: 2 })
      );
    });

    it('should address rows without an id by their index', () => {
      const values = {
        ...makeValues(),
        ingredients: [{ name: '', amount: '1', unit: 'g' }],
      };

      expect(validateRecipe(values)[0].path).toBe('ingredients.0.name');
    });
  });

  describe('steps', () => {
    it('should ask for a step when every row is blank', () => {
      const values = makeValues({ steps: [{ id: 's1', description: '', image: '' }] });

      expect(issueAt(values, 'steps')?.message).toEqual(text('recipeForm.issues.stepsRequired'));
    });

    it('should ignore trailing blank steps', () => {
      const values = makeValues({
        steps: [
          { id: 's1', description: 'Bake', image: '' },
          { id: 's2', description: '', image: '' },
          { id: 's3', description: ' ', image: '' },
        ],
      });

      expect(validateRecipe(values)).toEqual([]);
    });

    it('should name an interior blank step', () => {
      const values = makeValues({
        steps: [
          { id: 's1', description: 'Mix', image: '' },
          { id: 's2', description: '', image: '' },
          { id: 's3', description: 'Bake', image: '' },
        ],
      });

      expect(issueAt(values, 'steps.s2.description')).toEqual({
        path: 'steps.s2.description',
        section: 'steps',
        label: text('recipeForm.fields.stepAt', { position: 2 }),
        message: text('recipeForm.issues.stepEmpty', { position: 2 }),
      });
    });

    it('should name a step that has a photo but no text, even when it is the last one', () => {
      const values = makeValues({
        steps: [
          { id: 's1', description: 'Mix', image: '' },
          { id: 's2', description: '', image: STEP_URL },
        ],
      });

      expect(issueAt(values, 'steps.s2.description')?.message).toEqual(
        text('recipeForm.issues.stepPhotoWithoutText', { position: 2 })
      );
    });

    it('should reject a step text over the limit', () => {
      const description = 'a'.repeat(RECIPE_LIMITS.stepText + 1);
      const values = makeValues({ steps: [{ id: 's1', description, image: '' }] });

      expect(issueAt(values, 'steps.s1.description')?.message).toEqual(
        text('recipeForm.issues.stepTooLong', { position: 1, max: 5000 })
      );
    });

    it('should reject a step photo that is not a finished upload', () => {
      const values = makeValues({
        steps: [{ id: 's1', description: 'Mix', image: 'blob:http://localhost/1' }],
      });

      expect(issueAt(values, 'steps.s1.image')?.message).toEqual(
        text('recipeForm.issues.stepImageInvalid', { position: 1 })
      );
    });

    it('should say how many steps to remove when there are too many', () => {
      const steps = Array.from({ length: RECIPE_LIMITS.steps + 1 }, (_, i) => ({
        id: `s${i}`,
        description: `Step ${i}`,
        image: '',
      }));

      expect(issueAt(makeValues({ steps }), 'steps')?.message).toEqual(
        text('recipeForm.issues.stepsTooMany', { max: 50, extra: 1 })
      );
    });

    it('should address rows without an id by their index', () => {
      const values = {
        ...makeValues(),
        steps: [
          { description: '', image: '' },
          { description: 'Bake', image: '' },
        ],
      };

      expect(validateRecipe(values)[0].path).toBe('steps.0.description');
    });
  });

  describe('presentation', () => {
    it('should ask for a cover photo naming the accepted formats', () => {
      expect(issueAt(makeValues({ imageUrl: '' }), 'imageUrl')).toEqual({
        path: 'imageUrl',
        section: 'presentation',
        label: text('recipeForm.fields.coverPhoto'),
        message: text('recipeForm.issues.coverRequired'),
      });
    });

    it('should reject a cover that is not a finished upload', () => {
      const values = makeValues({ imageUrl: 'blob:http://localhost/1' });

      expect(issueAt(values, 'imageUrl')?.message).toEqual(text('recipeForm.issues.coverInvalid'));
    });

    it('should ask for a description when it is blank', () => {
      expect(issueAt(makeValues({ description: ' ' }), 'description')?.message).toEqual(
        text('recipeForm.issues.descriptionRequired')
      );
    });

    it('should reject a description over the limit', () => {
      const description = 'a'.repeat(RECIPE_LIMITS.description + 1);

      expect(issueAt(makeValues({ description }), 'description')?.message).toEqual(
        text('recipeForm.issues.descriptionTooLong', { max: 500 })
      );
    });

    it('should accept an empty closing note', () => {
      expect(issueAt(makeValues({ caption: '' }), 'caption')).toBeUndefined();
    });

    it('should reject a closing note over the limit', () => {
      const caption = 'a'.repeat(RECIPE_LIMITS.caption + 1);

      expect(issueAt(makeValues({ caption }), 'caption')?.message).toEqual(
        text('recipeForm.issues.captionTooLong', { max: 500 })
      );
    });
  });

  it("should list the issues in the author's order", () => {
    const values = makeValues({
      title: '',
      imageUrl: '',
      ingredients: [{ id: 'i1', name: '', amount: '', unit: '' }],
      steps: [{ id: 's1', description: '', image: '' }],
    });

    expect(validateRecipe(values).map((issue) => issue.section)).toEqual([
      'basics',
      'ingredients',
      'steps',
      'presentation',
    ]);
  });

  it('should report an empty form without throwing', () => {
    const values = makeValues({
      title: '',
      description: '',
      imageUrl: '',
      prepTime: '',
      cookingTime: '',
      ingredients: [],
      steps: [],
    });

    expect(messagesOf(values)).toEqual([
      text('recipeForm.issues.titleRequired'),
      text('recipeForm.issues.prepTimeRange', { min: 0, max: 480 }),
      text('recipeForm.issues.cookTimeRange', { min: 1, max: 720 }),
      text('recipeForm.issues.ingredientsRequired'),
      text('recipeForm.issues.stepsRequired'),
      text('recipeForm.issues.coverRequired'),
      text('recipeForm.issues.descriptionRequired'),
    ]);
  });
});

describe('path helpers', () => {
  it.each([
    ['title', 'basics'],
    ['cookingTime', 'basics'],
    ['ingredients.i1.amount', 'ingredients'],
    ['steps', 'steps'],
    ['imageUrl', 'presentation'],
    ['caption', 'presentation'],
    ['somethingElse', 'basics'],
  ])('should place %s in the %s section', (fieldPath, section) => {
    expect(sectionOfPath(fieldPath)).toBe(section);
  });

  it('should tell whether a path lives under a scope', () => {
    expect(isPathWithin('steps.s1.description', 'steps.s1')).toBe(true);
    expect(isPathWithin('steps.s10.description', 'steps.s1')).toBe(false);
    expect(isPathWithin('steps.s1', 'steps.s1')).toBe(true);
  });
});

/**
 * The route's zod schemas are not exported and the route is not touched, so the file is
 * read as text. If a limit changes on the server this fails until RECIPE_LIMITS follows.
 */
describe('parity with the server rules (text-based)', () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.resolve(__dirname, '../../../../..', relativePath), 'utf8');
  const compact = (source: string) => source.replace(/\s+/g, '');

  const route = compact(read('src/app/api/recipes/route.ts'));
  const service = compact(read('src/infrastructure/services/RecipeService.ts'));

  const schemaBlock = (name: string): string => {
    const start = route.indexOf(`const${name}=`);
    const end = route.indexOf('.strict()', start);
    if (start === -1 || end === -1) throw new Error(`schema ${name} not found in route.ts`);
    return route.slice(start, end);
  };
  const boundsOf = (block: string): string[] => block.match(/\.(min|max)\(\d+\)/g) ?? [];

  const L = RECIPE_LIMITS;

  it('should match every numeric literal of the ingredient schema', () => {
    expect(boundsOf(schemaBlock('ingredientSchema'))).toEqual([
      '.min(1)',
      `.max(${L.name})`,
      `.max(${L.amount})`,
      `.max(${L.unit})`,
    ]);
  });

  it('should match every numeric literal of the instruction schema', () => {
    expect(boundsOf(schemaBlock('instructionSchema'))).toEqual(['.min(1)', `.max(${L.stepText})`]);
  });

  it('should match every numeric literal of the recipe schema, in field order', () => {
    expect(boundsOf(schemaBlock('createRecipeSchema'))).toEqual([
      '.min(1)',
      `.max(${L.title})`,
      '.min(1)',
      `.max(${L.description})`,
      '.min(1)', // imageUrl
      `.min(${L.cook.min})`,
      `.max(${L.cook.max})`,
      `.min(${L.prep.min})`,
      `.max(${L.prep.max})`,
      `.min(${L.servings.min})`,
      `.max(${L.servings.max})`,
      '.min(1)',
      `.max(${L.ingredients})`,
      '.min(1)',
      `.max(${L.steps})`,
      `.max(${L.caption})`,
    ]);
  });

  it.each([
    ['title', `title:z.string().min(1).max(${L.title})`],
    ['description', `description:z.string().min(1).max(${L.description})`],
    ['cookingTime', `cookingTime:z.number().int().min(${L.cook.min}).max(${L.cook.max})`],
    ['prepTime', `prepTime:z.number().int().min(${L.prep.min}).max(${L.prep.max})`],
    ['servings', `servings:z.number().int().min(${L.servings.min}).max(${L.servings.max})`],
    ['ingredients', `ingredients:z.array(ingredientSchema).min(1).max(${L.ingredients})`],
    ['caption', `caption:z.string().max(${L.caption})`],
    ['difficulty', "difficulty:z.enum(['easy','medium','hard'])"],
  ])('should find the %s rule spelled as expected in the route', (_field, rule) => {
    expect(schemaBlock('createRecipeSchema')).toContain(rule);
  });

  it('should require the same image host as the route', () => {
    expect(route).toContain("url.startsWith('https://res.cloudinary.com/')");
    expect(COVER_URL.startsWith('https://res.cloudinary.com/')).toBe(true);
  });

  it.each([
    `data.title.length>${L.title}`,
    `data.description.length>${L.description}`,
    `data.cookingTime>${L.cook.max}`,
    `data.prepTime>${L.prep.max}`,
    `data.servings>${L.servings.max}`,
    `data.ingredients.length>${L.ingredients}`,
    `data.instructions.length>${L.steps}`,
    'ingredient.unit!==UNIT_TO_TASTE',
  ])('should find %s in RecipeService', (rule) => {
    expect(service).toContain(rule);
  });

  it('should offer the to-taste unit the service exempts from the amount rule', () => {
    expect(RECIPE_UNITS).toContain(UNIT_TO_TASTE);
  });
});
