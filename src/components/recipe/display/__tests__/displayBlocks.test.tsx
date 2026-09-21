import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { createAppTheme } from '@/theme/createAppTheme';
import { darkTokens } from '@/theme/tokens';
import CaptionQuote from '../CaptionQuote';
import DifficultyChip from '../DifficultyChip';
import { StoredIngredient } from '../displayFormat';
import IngredientLine from '../IngredientLine';
import RecipeCoverBadges from '../RecipeCoverBadges';
import RecipeTimeStrip from '../RecipeTimeStrip';
import StepNumber from '../StepNumber';

describe('StepNumber', () => {
  it('should hide the number from assistive tech by default', () => {
    render(<StepNumber number={3} />);

    expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true');
  });

  it('should expose the number when it is not decorative', () => {
    render(<StepNumber number={3} decorative={false} />);

    expect(screen.getByText('3')).not.toHaveAttribute('aria-hidden');
  });

  it('should use the contrast text of the primary colour, never a literal white', () => {
    const theme = createTheme({
      palette: { mode: 'dark', primary: { main: '#26A69A', contrastText: 'rgba(0,0,0,0.87)' } },
    });

    render(
      <ThemeProvider theme={theme}>
        <StepNumber number={1} />
      </ThemeProvider>
    );

    expect(screen.getByText('1')).toHaveStyle({ color: 'rgba(0, 0, 0, 0.87)' });
  });

  it('should stay 40px wide at every width when it is not responsive', () => {
    render(<StepNumber number={1} responsive={false} />);

    expect(screen.getByText('1')).toHaveStyle({ width: '40px', height: '40px' });
  });

  it('should fade the ghost number of the add row', () => {
    render(<StepNumber number={4} ghost />);

    expect(screen.getByText('4')).toHaveStyle({ opacity: '0.5' });
  });

  it('should accept extra sx from the caller', () => {
    render(<StepNumber number={2} sx={[{ marginTop: '4px' }]} />);

    expect(screen.getByText('2')).toHaveStyle({ marginTop: '4px' });
  });
});

describe('IngredientLine', () => {
  const renderLine = (ingredient: StoredIngredient, dense = false) =>
    render(
      <ul>
        <IngredientLine ingredient={ingredient} dense={dense} />
      </ul>
    );

  it('should print the quantity in bold before the name', () => {
    renderLine({ name: 'flour', amount: '200', unit: 'g' });

    const line = screen.getByRole('listitem');
    expect(line).toHaveTextContent('200 g flour');
    expect(within(line).getByText('200 g').tagName).toBe('STRONG');
  });

  it("should read '2 eggs' when the unit is 'units'", () => {
    renderLine({ name: 'eggs', amount: '2', unit: 'units' });

    expect(screen.getByRole('listitem')).toHaveTextContent(/^2 eggs$/);
  });

  it("should read '{name}, to taste' without a bold prefix", () => {
    renderLine({ name: 'Salt', amount: '', unit: 'to taste' });

    const line = screen.getByRole('listitem');
    expect(line).toHaveTextContent(/^Salt, to taste$/);
    expect(line.querySelector('strong')).toBeNull();
  });

  it('should render a seeded row whose amount is a number', () => {
    renderLine({ name: 'spaghetti', amount: 400, unit: 'g' });

    const line = screen.getByRole('listitem');
    expect(line).toHaveTextContent(/^400 g spaghetti$/);
    expect(within(line).getByText('400 g').tagName).toBe('STRONG');
  });

  it('should render a legacy row whose amount and unit are null', () => {
    renderLine({ name: 'water', amount: null, unit: null });

    const line = screen.getByRole('listitem');
    expect(line).toHaveTextContent(/^water$/);
    expect(line.querySelector('strong')).toBeNull();
  });

  it('should use the roomy line of the recipe page by default', () => {
    render(
      <ul>
        <IngredientLine ingredient={{ name: 'flour', amount: '200', unit: 'g' }} />
      </ul>
    );

    expect(screen.getByRole('listitem')).toHaveStyle({ marginBottom: '12px' });
  });

  it('should render as a span inside a list item the caller owns', () => {
    render(
      <ul>
        <li>
          <IngredientLine
            ingredient={{ name: 'flour', amount: '200', unit: 'g' }}
            component="span"
          />
        </li>
      </ul>
    );

    const line = screen.getByText('200 g').parentElement as HTMLElement;
    expect(line.tagName).toBe('SPAN');
    expect(line).toHaveStyle({ marginBottom: '0px' });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('should render a dense line for the compact preview', () => {
    renderLine({ name: 'flour', amount: '200', unit: 'g' }, true);

    expect(screen.getByRole('listitem')).toHaveStyle({ marginBottom: '6px' });
  });
});

describe('RecipeTimeStrip', () => {
  it('should print prep, cook and their total in minutes', () => {
    render(<RecipeTimeStrip prepTime={15} cookingTime={30} />);

    expect(screen.getByText('PREP TIME').parentElement).toHaveTextContent('15 min');
    expect(screen.getByText('COOK TIME').parentElement).toHaveTextContent('30 min');
    expect(screen.getByText('TOTAL TIME').parentElement).toHaveTextContent('45 min');
  });

  it('should keep the values out of the heading outline', () => {
    render(<RecipeTimeStrip prepTime={15} cookingTime={30} compact />);

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });

  it('should accept extra sx from the caller', () => {
    render(<RecipeTimeStrip prepTime={0} cookingTime={10} sx={{ marginBottom: '24px' }} />);

    expect(screen.getByText('PREP TIME').parentElement?.parentElement).toHaveStyle({
      marginBottom: '24px',
    });
  });
});

describe('sx passthrough', () => {
  it('should accept an sx array on the time strip', () => {
    render(<RecipeTimeStrip prepTime={0} cookingTime={10} sx={[{ marginBottom: '8px' }]} />);

    expect(screen.getByText('PREP TIME').parentElement?.parentElement).toHaveStyle({
      marginBottom: '8px',
    });
  });

  it('should accept an sx array on the closing quote', () => {
    render(<CaptionQuote caption="Enjoy" sx={[{ marginTop: '8px' }]} />);

    expect(screen.getByText(/Enjoy/).closest('.MuiPaper-root')).toHaveStyle({ marginTop: '8px' });
  });
});

describe('DifficultyChip', () => {
  /**
   * Mounted in the real theme, not MUI's default.
   *
   * These assertions are about the tones the palette hands out, and a bare render gets
   * MUI's `#d32f2f` rather than the token `#C62828` — which would pass just as happily
   * while proving nothing about this app.
   */
  const inTheme = (ui: React.ReactElement, mode: 'light' | 'dark' = 'light') =>
    render(<ThemeProvider theme={createAppTheme(mode)}>{ui}</ThemeProvider>);

  it('should print the difficulty capitalised through CSS', () => {
    render(<DifficultyChip difficulty="medium" />);

    expect(screen.getByText('medium').closest('.MuiChip-root')).toHaveStyle({
      textTransform: 'capitalize',
    });
  });

  it('should carry the difficulty tone without asking MUI to fill the chip', () => {
    // It used to assert `MuiChip-colorError`, i.e. a saturated error-coloured pill. The
    // chip is now tinted, and `color="default"` is the mechanism: asking for the tone
    // would paint palette.error.main at full opacity underneath and hand the label that
    // colour's contrastText, so the tint would be fighting a fill it then has to cover.
    inTheme(<DifficultyChip difficulty="hard" size="small" sx={[{ marginTop: '2px' }]} />);
    const chip = screen.getByText('hard').closest('.MuiChip-root');

    expect(chip).toHaveClass('MuiChip-colorDefault');
    expect(chip).not.toHaveClass('MuiChip-colorError');
    // The tone lives in the border, which is where it survives being only 16% strong.
    // Asserted as the shorthand: jsdom does not expand `border` into `border-color`.
    expect(chip).toHaveStyle({ border: '1px solid #C62828' });
    expect(chip).toHaveStyle({ marginTop: '2px' });
  });

  it('should leave an unrecognised difficulty untinted rather than guess a tone', () => {
    // The column is still `String?`; a row written before the list was closed can hold
    // anything, and there is no palette colour to reach for.
    inTheme(<DifficultyChip difficulty="impossible" />);
    const chip = screen.getByText('impossible').closest('.MuiChip-root');

    expect(chip).toHaveClass('MuiChip-colorDefault');
    expect(chip).not.toHaveStyle({ border: '1px solid #C62828' });
  });

  it('should swap the tint for an opaque scrim when it sits on a photo', () => {
    // A 16% tint composites against whatever is behind it. Over a cover that is the food,
    // so the fill becomes the scrim and the tone moves to a rule down the side.
    inTheme(<DifficultyChip difficulty="easy" appearance="onCover" />);
    const chip = screen.getByText('easy').closest('.MuiChip-root');

    expect(chip).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0.62)' });
    expect(chip).toHaveStyle({ borderLeft: '3px solid #93B896' });
  });
});

describe('CaptionQuote', () => {
  it('should print the closing note between quotes and keep its line breaks', () => {
    render(<CaptionQuote caption={'Better the next day.\nTrust me.'} />);

    const quote = screen.getByText(/Better the next day/);
    expect(quote).toHaveTextContent('“Better the next day. Trust me.”');
    expect(quote).toHaveStyle({ whiteSpace: 'pre-line' });
  });

  it('should be an outlined surface in the preview', () => {
    render(<CaptionQuote caption="Enjoy" variant="outlined" sx={{ marginTop: '8px' }} />);

    expect(screen.getByText(/Enjoy/).closest('.MuiPaper-root')).toHaveClass('MuiPaper-outlined');
  });

  it('should use the dark surface in dark mode', () => {
    // Was pinned to MUI's grey[900] — one of the undeclared greys the token layer
    // removed. The quote sits in a well, so it takes the sunken surface.
    const theme = createTheme({ palette: { mode: 'dark' } });

    render(
      <ThemeProvider theme={theme}>
        <CaptionQuote caption="Enjoy" />
      </ThemeProvider>
    );

    expect(screen.getByText(/Enjoy/).closest('.MuiPaper-root')).toHaveStyle({
      backgroundColor: darkTokens.surface.sunken,
    });
  });
});

describe('RecipeCoverBadges', () => {
  it('should paint the difficulty and the total time', () => {
    render(<RecipeCoverBadges difficulty="easy" totalTime={45} />);

    expect(screen.getByText('easy')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('should leave the time pill out while no time was typed', () => {
    render(<RecipeCoverBadges difficulty="easy" totalTime={0} />);

    expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
  });
});
