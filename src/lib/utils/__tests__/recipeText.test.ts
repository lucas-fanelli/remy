import { RECIPE_LIMITS, RECIPE_UNITS } from '@/lib/constants';
import {
  INGREDIENTS_CAPPED_MESSAGE,
  STEPS_CAPPED_MESSAGE,
  UNIT_ALIASES,
  normaliseLine,
  parseIngredientLines,
  parseMethod,
  serialiseIngredient,
  serialiseIngredients,
  serialiseSteps,
} from '../recipeText';

/** [line as typed, amount, unit, name] - lines the parser is sure about */
const CONFIDENT_LINES: [string, string, string, string][] = [
  ['500 g harina', '500', 'g', 'harina'],
  ['2 huevos', '2', 'units', 'huevos'],
  ['1 1/2 tazas de leche', '1.5', 'cups', 'leche'],
  ['1,5 kg papas', '1.5', 'kg', 'papas'],
  ['sal a gusto', '', '', 'sal'],
  ['pimienta', '', '', 'pimienta'],
  ['sal (c/n)', '', '', 'sal'],
  ['queso rallado c/n', '', '', 'queso rallado'],
  ['salt, to taste', '', '', 'salt'],
  ['aceite cantidad necesaria', '', '', 'aceite'],
  ['1/2 kg de carne picada', '1/2', 'kg', 'carne picada'],
  ['½ taza azúcar', '0.5', 'cups', 'azúcar'],
  ['1 ½ cdta. de sal', '1.5', 'tsp', 'sal'],
  ['2-3 tomates', '2-3', 'units', 'tomates'],
  ['500g manteca', '500', 'g', 'manteca'],
  ['1.5 l agua', '1.5', 'L', 'agua'],
  ['200 ML leche', '200', 'mL', 'leche'],
  ['250 cc crema', '250', 'mL', 'crema'],
  ['3 Cucharadas de Azúcar', '3', 'tbsp', 'Azúcar'],
  ['2 tbsp olive oil', '2', 'tbsp', 'olive oil'],
  ['1 tsp of salt', '1', 'tsp', 'salt'],
  ['2 cups flour', '2', 'cups', 'flour'],
  ['1 pizca de sal', '1', 'pinch', 'sal'],
  ['2 u. limón', '2', 'units', 'limón'],
  ['8 oz cream cheese', '8', 'oz', 'cream cheese'],
  ['1 lb ground beef', '1', 'lb', 'ground beef'],
  ['2 huevos grandes', '2', 'units', 'huevos grandes'],
  ['harina 500 g', '500', 'g', 'harina'],
  ['Harina: 500g', '500', 'g', 'Harina'],
  ['harina (500 g)', '500', 'g', 'harina'],
  ['azúcar 1 1/2 tazas', '1.5', 'cups', 'azúcar'],
  ['harina 000 500 g', '500', 'g', 'harina 000'],
];

/** [line as typed, amount, unit, name, what the reason must mention] */
const DOUBTFUL_LINES: [string, string, string, string, RegExp][] = [
  ['1 lata de tomate', '1', 'units', 'lata de tomate', /is "lata" part of the name/],
  ['3 dientes de ajo', '3', 'units', 'dientes de ajo', /is "dientes" part of the name/],
  ['1 can of tomatoes', '1', 'units', 'can of tomatoes', /is "can" part of the name/],
  ['harina 0000', '', '', 'harina 0000', /could not read it as an amount/],
  ['2 cdas de aceite, a gusto', '2', 'tbsp', 'aceite, a gusto', /keep one/],
  ['2 limones a gusto', '2', 'units', 'limones a gusto', /keep one/],
  ['500 g', '500', 'g', '', /No ingredient name/],
  ['250', '250', 'units', '', /No ingredient name/],
];

describe('parseIngredientLines', () => {
  it.each(CONFIDENT_LINES)('should read "%s"', (line, amount, unit, name) => {
    const { rows } = parseIngredientLines(line);

    expect(rows).toEqual([{ amount, unit, name, confidence: 'ok', reason: '', sourceText: line }]);
  });

  it.each(DOUBTFUL_LINES)(
    'should flag "%s" for a check and say why',
    (line, amount, unit, name, reason) => {
      const [row] = parseIngredientLines(line).rows;

      expect(row).toMatchObject({ amount, unit, name, confidence: 'check' });
      expect(row.reason).toMatch(reason);
    }
  );

  it.each([
    ['- 2 huevos', '2', 'huevos'],
    ['* 2 huevos', '2', 'huevos'],
    ['• 2 huevos', '2', 'huevos'],
    ['1. 2 huevos', '2', 'huevos'],
    ['3) 2 huevos', '2', 'huevos'],
  ])('should drop the list marker of "%s"', (line, amount, name) => {
    const [row] = parseIngredientLines(line).rows;

    expect(row).toMatchObject({ amount, unit: 'units', name });
  });

  it('should not take the decimal point of an amount for list numbering', () => {
    const [row] = parseIngredientLines('1.5 kg papas').rows;

    expect(row).toMatchObject({ amount: '1.5', unit: 'kg', name: 'papas' });
  });

  it('should read the eight-line sample as eight rows in order', () => {
    const text = [
      '500 g harina',
      '2 huevos',
      '1 1/2 tazas de leche',
      '1,5 kg papas',
      'sal a gusto',
      '2 tbsp olive oil',
      '1 lata de tomate',
      'pimienta',
    ].join('\n');

    const { rows, capped } = parseIngredientLines(text);

    expect(rows.map((row) => row.name)).toEqual([
      'harina',
      'huevos',
      'leche',
      'papas',
      'sal',
      'olive oil',
      'lata de tomate',
      'pimienta',
    ]);
    expect(capped).toBe(false);
  });

  it('should skip empty lines and accept Windows line endings', () => {
    const { rows } = parseIngredientLines('500 g harina\r\n\r\n   \r\n2 huevos\r\n');

    expect(rows.map((row) => row.name)).toEqual(['harina', 'huevos']);
  });

  it('should only store units from the closed list', () => {
    const lines = [...CONFIDENT_LINES, ...DOUBTFUL_LINES].map(([line]) => line).join('\n');

    const units = parseIngredientLines(lines).rows.map((row) => row.unit);

    units.forEach((unit) => expect(['', ...RECIPE_UNITS]).toContain(unit));
  });

  it('should flag a name longer than the limit instead of cutting it', () => {
    const name = 'x'.repeat(RECIPE_LIMITS.name + 1);

    const [row] = parseIngredientLines(`2 ${name}`).rows;

    expect(row.name).toBe(name);
    expect(row).toMatchObject({ confidence: 'check' });
    expect(row.reason).toMatch(/shorten the name/);
  });

  it('should keep a very long line whole without scanning it for a trailing amount', () => {
    const line = `${'palabra '.repeat(60)}500 g`;

    const [row] = parseIngredientLines(line).rows;

    expect(row.name).toBe(line.trim());
    expect(row.confidence).toBe('check');
  });

  it('should read only the first 100 lines and say so', () => {
    const text = Array.from({ length: 103 }, (_, index) => `${index + 1} g cosa`).join('\n');

    const { rows, capped } = parseIngredientLines(text);

    expect(rows).toHaveLength(RECIPE_LIMITS.ingredients);
    expect(capped).toBe(true);
    expect(INGREDIENTS_CAPPED_MESSAGE).toBe('Only the first 100 ingredients were read');
  });

  it('should return no rows for an empty text', () => {
    expect(parseIngredientLines('  \n \n')).toEqual({ rows: [], capped: false });
  });

  // Property-style: whatever the line, no word the author typed may disappear. A word may
  // only be used up as a unit alias, as the connecting 'de' / 'of' or as a to-taste marker
  const MARKER_WORDS = ['a', 'al', 'gusto', 'to', 'taste', 'cantidad', 'necesaria', 'c/n'];
  const isUsedUp = (word: string): boolean =>
    word in UNIT_ALIASES || ['de', 'del', 'of'].includes(word) || MARKER_WORDS.includes(word);
  const SAMPLES = [
    ...CONFIDENT_LINES.map(([line]) => line),
    ...DOUBTFUL_LINES.map(([line]) => line),
    '???',
    '1/0 de algo raro',
    '0,5-1,5 kg de zapallo (pelado)',
    'un puñado generoso de perejil fresco',
    '12 @ 3 # huevos',
    'Tomates 3 o 4, maduros',
    '  -  ',
  ];

  it.each(SAMPLES)('should not throw or lose a word of "%s"', (line) => {
    const { rows } = parseIngredientLines(line);

    const kept = rows.map((row) => row.name.toLowerCase()).join(' ');
    const words = line
      .toLowerCase()
      .split(/[\s,;:().\d]+/)
      .filter((word) => /\p{L}/u.test(word) && !isUsedUp(word));
    expect(words.filter((word) => !kept.includes(word))).toEqual([]);
  });
});

describe('parseMethod', () => {
  it('should split numbered lines into steps and drop the numbering', () => {
    const text = '1. Mezclar todo\n2) Hornear 30 min\nPaso 3: Servir\nStep 4 - Enjoy\n- Repetir';

    const { steps } = parseMethod(text);

    expect(steps.map((step) => step.description)).toEqual([
      'Mezclar todo',
      'Hornear 30 min',
      'Servir',
      'Enjoy',
      'Repetir',
    ]);
  });

  it('should split on blank lines and keep the line breaks inside a paragraph', () => {
    const text = 'Mezclar\nbien\n\nHornear\n\n\nServir\n';

    const { steps } = parseMethod(text);

    expect(steps.map((step) => step.description)).toEqual(['Mezclar\nbien', 'Hornear', 'Servir']);
  });

  it('should take every line of a plain block for a step', () => {
    const { steps } = parseMethod('Mezclar\nHornear\nServir');

    expect(steps.map((step) => step.description)).toEqual(['Mezclar', 'Hornear', 'Servir']);
  });

  it('should attach an unnumbered line to the numbered step above it', () => {
    const { steps } = parseMethod('1. Mezclar todo\ncon cuidado\n2. Hornear');

    expect(steps.map((step) => step.description)).toEqual(['Mezclar todo\ncon cuidado', 'Hornear']);
  });

  it('should accept numbering glued to the text', () => {
    const { steps } = parseMethod('1.Mezclar\n2)Hornear');

    expect(steps.map((step) => step.description)).toEqual(['Mezclar', 'Hornear']);
  });

  it('should not take a range or a decimal at the start of a line for numbering', () => {
    const { steps } = parseMethod('5 - 10 minutos de reposo\n1.5 kg de papas hervidas');

    expect(steps.map((step) => step.description)).toEqual([
      '5 - 10 minutos de reposo',
      '1.5 kg de papas hervidas',
    ]);
  });

  it('should keep the paragraph as typed next to the step', () => {
    const { steps } = parseMethod('1. Mezclar todo');

    expect(steps[0].sourceText).toBe('1. Mezclar todo');
  });

  it('should ignore a number that carries no step', () => {
    const { steps } = parseMethod('1. Mezclar\n\n2.\n\n3. Servir');

    expect(steps.map((step) => step.description)).toEqual(['Mezclar', 'Servir']);
  });

  it('should read only the first 50 steps and say so', () => {
    const text = Array.from({ length: 52 }, (_, index) => `Paso ${index + 1}: hacer algo`).join(
      '\n'
    );

    const { steps, capped } = parseMethod(text);

    expect(steps).toHaveLength(RECIPE_LIMITS.steps);
    expect(capped).toBe(true);
    expect(STEPS_CAPPED_MESSAGE).toBe('Only the first 50 steps were read');
  });

  it('should not cut a step that is longer than the limit', () => {
    const long = 'a'.repeat(RECIPE_LIMITS.stepText + 10);

    const { steps } = parseMethod(long);

    expect(steps[0].description).toHaveLength(RECIPE_LIMITS.stepText + 10);
  });

  it.each(['', '   \n\n', '\r\n'])('should return no steps for the empty text %j', (text) => {
    expect(parseMethod(text)).toEqual({ steps: [], capped: false });
  });
});

describe('serialisers', () => {
  it('should write an ingredient the way it is read aloud', () => {
    expect(serialiseIngredient({ amount: '500', unit: 'g', name: 'harina' })).toBe('500 g harina');
  });

  it('should not write the generic unit', () => {
    expect(serialiseIngredient({ amount: '2', unit: 'units', name: 'huevos' })).toBe('2 huevos');
  });

  it.each([[''], ['to taste']])('should write a to-taste row (unit %j) as its name', (unit) => {
    expect(serialiseIngredient({ amount: '', unit, name: 'sal' })).toBe('sal');
  });

  it('should skip blank rows', () => {
    const rows = [
      { amount: '500', unit: 'g', name: 'harina' },
      { amount: '', unit: '', name: '  ' },
      { amount: '', unit: '', name: 'sal' },
    ];

    expect(serialiseIngredients(rows)).toBe('500 g harina\nsal');
  });

  it('should number the steps, separate them with a blank line and skip empty ones', () => {
    const rows = [{ description: 'Mezclar' }, { description: ' ' }, { description: 'Hornear' }];

    expect(serialiseSteps(rows)).toBe('1. Mezclar\n\n2. Hornear');
  });

  it('should close up a blank line inside a step', () => {
    expect(serialiseSteps([{ description: 'a\n\nb' }])).toBe('1. a\nb');
  });

  it('should give rows with canonical units back after a round trip', () => {
    const rows = [
      { amount: '500', unit: 'g', name: 'harina 0000' },
      { amount: '2', unit: 'units', name: 'huevos' },
      { amount: '1.5', unit: 'cups', name: 'leche' },
      { amount: '1/2', unit: 'kg', name: 'carne picada' },
      { amount: '1', unit: 'pinch', name: 'sal' },
      { amount: '250', unit: 'mL', name: 'crema' },
      { amount: '1', unit: 'L', name: 'agua' },
      { amount: '2', unit: 'tbsp', name: 'aceite' },
      { amount: '1', unit: 'tsp', name: 'azúcar' },
      { amount: '8', unit: 'oz', name: 'queso' },
      { amount: '1', unit: 'lb', name: 'carne' },
      { amount: '', unit: '', name: 'pimienta' },
    ];

    const parsed = parseIngredientLines(serialiseIngredients(rows)).rows;

    expect(parsed.map(({ amount, unit, name }) => ({ amount, unit, name }))).toEqual(rows);
  });

  it('should give the steps back after a round trip, line breaks included', () => {
    const rows = [{ description: 'Mezclar todo\ncon cuidado' }, { description: 'Hornear 30 min' }];

    const parsed = parseMethod(serialiseSteps(rows)).steps;

    expect(parsed.map(({ description }) => ({ description }))).toEqual(rows);
  });

  it('should give a single step with a line break back as one step', () => {
    const rows = [{ description: 'Mezclar\nHornear' }];

    const parsed = parseMethod(serialiseSteps(rows)).steps;

    expect(parsed.map(({ description }) => ({ description }))).toEqual(rows);
  });
});

describe('normaliseLine', () => {
  it('should ignore case and spacing', () => {
    expect(normaliseLine('  500  G   Harina ')).toBe('500 g harina');
  });
});
