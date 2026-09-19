import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import RecipePreview, { RecipePreviewProps } from '../RecipePreview';
import { toPayload } from '../toPayload';
import { RecipeFormValues } from '../types';
import { COVER_URL, STEP_URL, makeValues } from './fixtures';

const EMPTY: Partial<RecipeFormValues> = {
  title: '',
  description: '',
  imageUrl: '',
  caption: '',
  prepTime: '',
  cookingTime: '',
  ingredients: [],
  steps: [],
};

// Always through the real normaliser: that is the component's contract
const renderPreview = (
  overrides: Partial<RecipeFormValues> = {},
  props: Partial<RecipePreviewProps> = {}
) => {
  const onEditSection = jest.fn();
  render(<RecipePreview payload={toPayload(makeValues(overrides), 'create')} {...props} />);
  return { onEditSection, user: userEvent.setup() };
};

// jsdom's computed style drops aspect-ratio, so read the rule Emotion injected for the node
const cssOf = (element: HTMLElement) =>
  Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .filter((text) => Array.from(element.classList).some((name) => text.includes(`.${name}`)))
    .join(' ');

describe('RecipePreview', () => {
  describe('a complete recipe', () => {
    it('should print the title as a bold heading', () => {
      renderPreview();

      expect(screen.getByRole('heading', { level: 3, name: 'Chocotorta' })).toHaveStyle({
        fontWeight: '700',
      });
    });

    it('should show the cover in the 4:3 crop of the feed with its badges', () => {
      renderPreview({ difficulty: 'hard', prepTime: 15, cookingTime: 30 });

      const cover = screen.getByRole('img', { name: 'Chocotorta cover' });
      expect(cover).toHaveAttribute('src', COVER_URL);
      expect(cssOf(cover.parentElement as HTMLElement)).toMatch(/aspect-ratio: 4 ?\/ ?3/);
      expect(within(cover.parentElement as HTMLElement).getByText('hard')).toBeInTheDocument();
      expect(within(cover.parentElement as HTMLElement).getByText('45 min')).toBeInTheDocument();
    });

    it('should print the difficulty once when the cover carries the badge', () => {
      renderPreview({ difficulty: 'hard' });

      expect(screen.getAllByText('hard')).toHaveLength(1);
    });

    it('should keep the line breaks of the description', () => {
      renderPreview({ description: 'Line one\nLine two' });

      expect(screen.getByText(/Line one/)).toHaveStyle({ whiteSpace: 'pre-line' });
    });

    it('should print prep, cook and total time', () => {
      renderPreview({ prepTime: 15, cookingTime: 30 });

      expect(screen.getByText('PREP TIME').parentElement).toHaveTextContent('15 min');
      expect(screen.getByText('TOTAL TIME').parentElement).toHaveTextContent('45 min');
    });

    it('should use the singular for one serving', () => {
      renderPreview({ servings: 1 });

      expect(screen.getByText('1 serving')).toBeInTheDocument();
    });

    it('should use the plural for several servings', () => {
      renderPreview({ servings: 12 });

      expect(screen.getByText('12 servings')).toBeInTheDocument();
    });

    it('should leave the servings out while the field is empty', () => {
      renderPreview({ servings: '' });

      expect(screen.queryByText(/serving/)).not.toBeInTheDocument();
    });

    it('should print the ingredients with the display rules of the recipe page', () => {
      renderPreview({
        ingredients: [
          { id: 'a', name: 'flour', amount: '200', unit: 'g' },
          { id: 'b', name: 'eggs', amount: '2', unit: '' },
          { id: 'c', name: 'Salt', amount: '', unit: '' },
          { id: 'd', name: '', amount: '', unit: '' },
        ],
      });

      const lines = screen.getAllByRole('listitem').map((line) => line.textContent);
      expect(lines).toEqual(['200 g flour', '2 eggs', 'Salt, to taste']);
    });

    it('should number the steps as they will be sent, dropping trailing blank ones', () => {
      renderPreview({
        steps: [
          { id: 's1', description: 'Mix', image: '' },
          { id: 's2', description: 'Bake', image: '' },
          { id: 's3', description: '', image: '' },
        ],
      });

      expect(screen.getByText('Mix').parentElement?.previousElementSibling).toHaveTextContent('1');
      expect(screen.getByText('Bake').parentElement?.previousElementSibling).toHaveTextContent('2');
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });

    it('should expose the step numbers to assistive tech', () => {
      renderPreview();

      expect(screen.getByText('1')).not.toHaveAttribute('aria-hidden');
    });

    it('should keep the line breaks of a step', () => {
      renderPreview({ steps: [{ id: 's1', description: 'Mix\nRest', image: '' }] });

      expect(screen.getByText(/Mix/)).toHaveStyle({ whiteSpace: 'pre-line' });
    });

    it('should show the photo of a step as a thumbnail', () => {
      renderPreview();

      expect(screen.getByRole('img', { name: 'Step 2 photo' })).toHaveAttribute('src', STEP_URL);
    });

    it('should hide a step thumbnail that does not load', () => {
      renderPreview();

      fireEvent.error(screen.getByRole('img', { name: 'Step 2 photo' }));

      expect(screen.queryByRole('img', { name: 'Step 2 photo' })).not.toBeInTheDocument();
    });

    it('should print the closing note as an outlined quote', () => {
      renderPreview({ caption: 'Better the next day' });

      expect(screen.getByText(/Better the next day/).closest('.MuiPaper-root')).toHaveClass(
        'MuiPaper-outlined'
      );
    });

    it('should print no quote without a closing note', () => {
      render(<RecipePreview payload={toPayload(makeValues({ caption: '' }), 'edit')} />);

      expect(document.querySelector('.MuiPaper-root')).toBeNull();
    });

    it('should put the list headings one level below the title', () => {
      renderPreview();

      expect(screen.getByRole('heading', { level: 3, name: 'Chocotorta' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Ingredients' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 4, name: 'Instructions' })).toBeInTheDocument();
    });

    it('should render a compact variant', () => {
      renderPreview({ caption: 'Enjoy' }, { compact: true });

      expect(screen.getByRole('heading', { level: 3, name: 'Chocotorta' })).toHaveClass(
        'MuiTypography-h6'
      );
    });
  });

  describe('an empty recipe', () => {
    it('should render no empty block at all without placeholders', () => {
      renderPreview(EMPTY);

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByText(/yet$/)).not.toBeInTheDocument();
    });

    it('should name every empty block with placeholders', () => {
      renderPreview(EMPTY, { placeholders: true });

      ['Cover photo', 'No title yet', 'No description yet', 'No times yet'].forEach((name) =>
        expect(screen.getByText(name)).toBeInTheDocument()
      );
      expect(screen.getByText('No ingredients yet')).toBeInTheDocument();
      expect(screen.getByText('No steps yet')).toBeInTheDocument();
    });

    it('should use still shapes, never a shimmer', () => {
      renderPreview(EMPTY, { placeholders: true });

      const shapes = document.querySelectorAll('.MuiSkeleton-root');
      expect(shapes.length).toBeGreaterThan(0);
      shapes.forEach((shape) => {
        expect(shape).toHaveClass('MuiSkeleton-rounded');
        expect(shape).not.toHaveClass('MuiSkeleton-pulse');
        expect(shape).not.toHaveClass('MuiSkeleton-wave');
      });
    });

    it('should show the difficulty as a chip while there is no cover to carry the badge', () => {
      renderPreview({ ...EMPTY, difficulty: 'medium' }, { placeholders: true });

      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('should name a cover that does not load', () => {
      renderPreview({}, { placeholders: true });

      fireEvent.error(screen.getByRole('img', { name: 'Chocotorta cover' }));

      expect(screen.getByText('Cover photo could not be loaded')).toBeInTheDocument();
    });

    it('should drop a cover that does not load when placeholders are off', () => {
      renderPreview({ title: '' });

      fireEvent.error(screen.getByRole('img', { name: 'Recipe cover' }));

      expect(screen.queryByRole('img', { name: 'Recipe cover' })).not.toBeInTheDocument();
    });
  });

  describe('onEditSection', () => {
    const renderEditable = (overrides: Partial<RecipeFormValues> = {}) => {
      const onEditSection = jest.fn();
      render(
        <RecipePreview
          payload={toPayload(makeValues(overrides), 'create')}
          onEditSection={onEditSection}
        />
      );
      return { onEditSection, user: userEvent.setup() };
    };

    it('should render no Edit button without the callback', () => {
      renderPreview();

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should render one Edit button per section', () => {
      renderEditable();

      expect(
        screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
      ).toEqual(['Edit photo and description', 'Edit basics', 'Edit ingredients', 'Edit steps']);
    });

    it('should send the cover button to the cover field', async () => {
      const { onEditSection, user } = renderEditable();

      await user.click(screen.getByRole('button', { name: 'Edit photo and description' }));

      expect(onEditSection).toHaveBeenCalledWith('presentation', 'imageUrl');
    });

    it('should send the title button to the title field', async () => {
      const { onEditSection, user } = renderEditable();

      await user.click(screen.getByRole('button', { name: 'Edit basics' }));

      expect(onEditSection).toHaveBeenCalledWith('basics', 'title');
    });

    it('should send the list buttons to their section', async () => {
      const { onEditSection, user } = renderEditable();

      await user.click(screen.getByRole('button', { name: 'Edit ingredients' }));
      await user.click(screen.getByRole('button', { name: 'Edit steps' }));

      expect(onEditSection).toHaveBeenNthCalledWith(1, 'ingredients', undefined);
      expect(onEditSection).toHaveBeenNthCalledWith(2, 'steps', undefined);
    });

    it('should work from the keyboard', async () => {
      const { onEditSection, user } = renderEditable();
      screen.getByRole('button', { name: 'Edit steps' }).focus();

      await user.keyboard('{Enter}');

      expect(onEditSection).toHaveBeenCalledWith('steps', undefined);
    });

    it('should keep the section headers of an empty recipe so it can be edited', () => {
      renderEditable(EMPTY);

      expect(screen.getAllByRole('button')).toHaveLength(4);
      expect(screen.getByRole('heading', { name: 'Ingredients' })).toBeInTheDocument();
    });

    it("should name the buttons after the shell's own section names", () => {
      render(
        <RecipePreview
          payload={toPayload(makeValues(), 'create')}
          onEditSection={jest.fn()}
          sectionLabels={{ presentation: 'Photo & story' }}
        />
      );

      expect(screen.getByRole('button', { name: 'Edit photo & story' })).toBeInTheDocument();
      expect(screen.getByText('Photo & story')).toBeInTheDocument();
    });
  });
});
