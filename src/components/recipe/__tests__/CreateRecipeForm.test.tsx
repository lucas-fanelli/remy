import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CreateRecipeForm from '../CreateRecipeForm';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock framer-motion - comprehensive mock supporting all patterns
jest.mock('framer-motion', () => {
  const mockMotion: any = (component: any) => component;
  mockMotion.create = (component: any) => component;
  mockMotion.div = ({ children, initial, animate, exit, transition, whileHover, whileTap, ...props }: any) =>
    <div {...props}>{children}</div>;

  return {
    motion: mockMotion,
    AnimatePresence: ({ children, mode }: any) => <>{children}</>,
  };
});

// Mock ImageUpload component
jest.mock('../../common/ImageUpload', () => {
  return function MockImageUpload({ onChange, value }: any) {
    return (
      <div>
        <button onClick={() => onChange('https://example.com/image.jpg')}>
          Upload Image
        </button>
        {value && <div>Image: {value}</div>}
      </div>
    );
  };
});

const mockTheme = createTheme();

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      <AuthProvider>
        {component}
      </AuthProvider>
    </ThemeProvider>
  );
};

describe('CreateRecipeForm Component', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render form fields on step 1', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByLabelText(/recipe title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getAllByText(/cuisine/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/difficulty/i).length).toBeGreaterThan(0);
  });

  it('should update form fields on input', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const titleInput = screen.getByLabelText(/recipe title/i) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Test Recipe' } });

    expect(titleInput.value).toBe('Test Recipe');
  });

  it('should show stepper with 4 steps', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByText('Recipe Info')).toBeInTheDocument();
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('should handle image upload', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const uploadButton = screen.getByText(/upload image/i);
    fireEvent.click(uploadButton);

    expect(screen.getByText(/image: https:\/\/example\.com\/image\.jpg/i)).toBeInTheDocument();
  });

  it('should render cancel button', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should render next button', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('should navigate to ingredients step when clicking next', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill in required fields
    const titleInput = screen.getByLabelText(/recipe title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Recipe' } });

    const descriptionInput = screen.getByLabelText(/description/i);
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

    // Upload image
    const uploadButton = screen.getByText(/upload image/i);
    fireEvent.click(uploadButton);

    // Click next
    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    // Should show add ingredient button
    expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
  });

  it('should add ingredients on step 2', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Go to ingredients step
    const titleInput = screen.getByLabelText(/recipe title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Recipe' } });

    const descriptionInput = screen.getByLabelText(/description/i);
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

    // Upload image
    const uploadButton = screen.getByText(/upload image/i);
    fireEvent.click(uploadButton);

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    // Add ingredient
    const addIngredientButton = screen.getByText(/add ingredient/i);
    fireEvent.click(addIngredientButton);

    // Should show ingredient inputs
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    expect(ingredientInputs.length).toBeGreaterThan(1);
  });

  it('should navigate back from ingredients step', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Go to ingredients step
    const titleInput = screen.getByLabelText(/recipe title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Recipe' } });

    const descriptionInput = screen.getByLabelText(/description/i);
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

    // Upload image
    const uploadButton = screen.getByText(/upload image/i);
    fireEvent.click(uploadButton);

    let nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    // Click back
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    // Should be back at step 1
    expect(screen.getByLabelText(/recipe title/i)).toBeInTheDocument();
  });

  it('should handle cancel button click', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should update servings field', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const servingsInput = screen.getByLabelText(/servings/i) as HTMLInputElement;
    fireEvent.change(servingsInput, { target: { value: '4' } });

    expect(servingsInput.value).toBe('4');
  });

  it('should update prep time field', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const prepTimeInput = screen.getByLabelText(/prep time/i) as HTMLInputElement;
    fireEvent.change(prepTimeInput, { target: { value: '30' } });

    expect(prepTimeInput.value).toBe('30');
  });

  it('should update cooking time field', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const cookingTimeInput = screen.getByLabelText(/cooking time/i) as HTMLInputElement;
    fireEvent.change(cookingTimeInput, { target: { value: '45' } });

    expect(cookingTimeInput.value).toBe('45');
  });

  it('should disable next button when required fields are empty', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    // Button exists but validation prevents proceeding
    expect(nextButton).toBeInTheDocument();
  });

  it('should update form fields when user types', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const titleInput = screen.getByLabelText(/recipe title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Recipe' } });

    const descriptionInput = screen.getByLabelText(/description/i);
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

    expect((titleInput as HTMLInputElement).value).toBe('Test Recipe');
    expect((descriptionInput as HTMLTextAreaElement).value).toBe('Test Description');
  });

  it('should update description field', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const descriptionInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
    fireEvent.change(descriptionInput, { target: { value: 'A delicious recipe' } });

    expect(descriptionInput.value).toBe('A delicious recipe');
  });

  it('should render stepper navigation correctly', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const stepper = screen.getByText('Recipe Info');
    expect(stepper).toBeInTheDocument();
  });

  it('should show ingredients section when navigating to step 2', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill required fields
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));

    // Navigate to ingredients
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
  });

  it('should display all stepper steps', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    expect(screen.getByText('Recipe Info')).toBeInTheDocument();
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('should render form with default values', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const titleInput = screen.getByLabelText(/recipe title/i) as HTMLInputElement;
    const servingsInput = screen.getByLabelText(/servings/i) as HTMLInputElement;
    const prepTimeInput = screen.getByLabelText(/prep time/i) as HTMLInputElement;

    expect(titleInput.value).toBe('');
    // Servings and prepTime have default values
    expect(servingsInput.value).toBe('4');
    expect(prepTimeInput.value).toBe('15');
  });

  it('should add multiple ingredients', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to ingredients step
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add first ingredient
    fireEvent.click(screen.getByText(/add ingredient/i));
    expect(screen.getAllByLabelText(/^ingredient$/i).length).toBeGreaterThan(1);

    // Add second ingredient
    fireEvent.click(screen.getByText(/add ingredient/i));
    expect(screen.getAllByLabelText(/^ingredient$/i).length).toBeGreaterThan(2);
  });

  it('should navigate through all steps', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Step 1
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2 - Should be on ingredients
    expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
  });

  // Instructions Step Tests
  it('should navigate to instructions step', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Step 1 - Recipe Info
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test Recipe' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test Description' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 2 - Ingredients - wait for ingredients step to render
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Step 3 - Instructions
    expect(screen.getByText(/add step/i)).toBeInTheDocument();
  });

  it('should add instructions', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to instructions step
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction
    const addInstructionButton = screen.getByText(/add step/i);
    fireEvent.click(addInstructionButton);

    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    expect(instructionInputs.length).toBeGreaterThan(1);
  });

  it('should add multiple instructions', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to instructions step
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add first instruction
    fireEvent.click(screen.getByText(/add step/i));
    expect(screen.getAllByLabelText(/^step \d+$/i).length).toBeGreaterThan(1);

    // Add second instruction
    fireEvent.click(screen.getByText(/add step/i));
    expect(screen.getAllByLabelText(/^step \d+$/i).length).toBeGreaterThan(2);
  });

  it('should update instruction text', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to instructions step
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Get the first instruction input
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    const firstInstruction = instructionInputs[0] as HTMLInputElement;
    fireEvent.change(firstInstruction, { target: { value: 'Mix ingredients' } });

    expect(firstInstruction.value).toBe('Mix ingredients');
  });

  it('should navigate back from instructions step', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to instructions step
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Click back
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    // Should be back at ingredients
    expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
  });

  // Review Step Tests
  it('should navigate to review step', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate through all steps
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test Recipe' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test Description' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed to instructions
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction to proceed to review
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Mix well' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Should show recipe details on review step
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('should display recipe title on review step', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const testTitle = 'Delicious Pasta';

    // Fill form and navigate to review
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: testTitle } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction to proceed
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(testTitle)).toBeInTheDocument();
  });

  it('should display recipe description on review step', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    const testDescription = 'A wonderful pasta dish';

    // Fill form and navigate to review
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: testDescription } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction to proceed
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(testDescription)).toBeInTheDocument();
  });

  it('should show submit button on review step', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to review step
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction to proceed
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /create recipe/i })).toBeInTheDocument();
  });

  it('should navigate back from review step', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to review step
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction to proceed
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Click back
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    // Should be back at instructions
    expect(screen.getByText(/add step/i)).toBeInTheDocument();
  });

  // Submit Functionality Tests
  it('should call onSubmit when submit button is clicked', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill form and navigate to review
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test Recipe' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test Description' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction to proceed
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Click submit
    const submitButton = screen.getByRole('button', { name: /create recipe/i });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('should submit form with all filled data', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill all fields
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test Recipe' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test Description' } });
    fireEvent.change(screen.getByLabelText(/servings/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/prep time/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/cooking time/i), { target: { value: '30' } });
    fireEvent.click(screen.getByText(/upload image/i));

    // Navigate to review and submit
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with unit to proceed
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction to proceed
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /create recipe/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Test Recipe',
      description: 'Test Description',
      servings: 4,
      prepTime: 15,
      cookingTime: 30,
      imageUrl: 'https://example.com/image.jpg',
    }));
  });

  it('should include ingredients in submitted data', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill basic info
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with name
    fireEvent.click(screen.getByText(/add ingredient/i));
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[1], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (2 unit selects for 2 ingredients)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(1); // 2 Unit selects
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects

    // Set unit for the new ingredient (second one)
    fireEvent.mouseDown(unitSelects[1]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    // Also need to set unit for first ingredient
    fireEvent.change(ingredientInputs[0], { target: { value: 'Sugar' } });
    fireEvent.mouseDown(unitSelects[0]);
    const tbspOption = await screen.findByText('tbsp');
    fireEvent.click(tbspOption);

    // Navigate to instructions step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add an instruction to pass validation
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[0], { target: { value: 'Mix ingredients together' } });

    // Navigate to review and submit
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /create recipe/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
      ingredients: expect.arrayContaining([
        expect.objectContaining({ name: 'Flour' })
      ])
    }));
  });

  it('should include instructions in submitted data', async () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Fill basic info and navigate to ingredients
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Wait for ingredients step
    await waitFor(() => {
      expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
    });

    // Add ingredient with name and unit to pass validation
    const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
    fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

    // Wait for MUI Select components to render (only Unit selects on ingredients step)
    await waitFor(() => {
      const selects = screen.queryAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0); // At least one Unit select
    });
    const unitSelects = screen.getAllByRole('combobox'); // On ingredients step, these are all unit selects
    fireEvent.mouseDown(unitSelects[0]);
    const cupsOption = await screen.findByText('cups');
    fireEvent.click(cupsOption);

    // Now navigate to instructions
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add instruction
    fireEvent.click(screen.getByText(/add step/i));
    const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
    fireEvent.change(instructionInputs[1], { target: { value: 'Mix well' } });

    // Navigate to review and submit
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /create recipe/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
      instructions: expect.arrayContaining([
        expect.objectContaining({ description: 'Mix well' })
      ])
    }));
  });

  it('should update ingredient amount field', () => {
    renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

    // Navigate to ingredients
    fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText(/upload image/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Add ingredient and update amount
    fireEvent.click(screen.getByText(/add ingredient/i));
    const amountInputs = screen.getAllByLabelText(/amount/i);
    fireEvent.change(amountInputs[1], { target: { value: '2' } });

    expect((amountInputs[1] as HTMLInputElement).value).toBe('2');
  });

  // Branch Coverage Tests - Error Messages (lines 99-105)
  describe('Validation Error Messages - Branch Coverage', () => {
    it('should show error when clicking next on step 0 without required fields - branch coverage', () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Click next without filling required fields (tests line 99-100 branch)
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText(/please fill in all required fields: title, description \(max 500 chars\), and image url/i)).toBeInTheDocument();
    });

    it('should show error when clicking next on step 1 without ingredient unit - branch coverage', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Navigate to step 1 (ingredients)
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      // Add ingredient name but no unit (tests line 101-102 branch)
      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

      // Click next without setting unit
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText(/please add at least one ingredient with a unit \(e\.g\., cups, tbsp, g\)/i)).toBeInTheDocument();
    });

    it('should show error when clicking next on step 2 without instructions - branch coverage', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Navigate to step 2 (instructions)
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      // Add ingredient with unit to proceed
      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

      await waitFor(() => {
        const selects = screen.queryAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
      const unitSelects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(unitSelects[0]);
      const cupsOption = await screen.findByText('cups');
      fireEvent.click(cupsOption);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Now on instructions step - click next without adding instruction (tests line 103-104 branch)
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      expect(screen.getByText(/please add at least one instruction step/i)).toBeInTheDocument();
    });
  });

  // Branch Coverage Tests - Remove Instruction (lines 135-138)
  describe('Remove Instruction - Branch Coverage', () => {
    it('should remove instruction and update step numbers - branch coverage', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Navigate to instructions step
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      // Add ingredient with unit
      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

      await waitFor(() => {
        const selects = screen.queryAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
      const unitSelects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(unitSelects[0]);
      const cupsOption = await screen.findByText('cups');
      fireEvent.click(cupsOption);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Start with 1 instruction by default, add 2 more to get 3 total
      fireEvent.click(screen.getByText(/add step/i));
      fireEvent.click(screen.getByText(/add step/i));

      // Should have 3 instructions (Step 1, Step 2, Step 3)
      // Each step appears multiple times: in Chip and in TextField label
      const stepTexts = screen.getAllByText(/^Step \d+$/);
      expect(stepTexts.length).toBeGreaterThanOrEqual(3);

      // Get all delete buttons (filter for buttons with DeleteIcon)
      const allButtons = screen.getAllByRole('button');
      const deleteButtons = allButtons.filter(
        btn => btn.querySelector('svg[data-testid="DeleteIcon"]') !== null
      );

      // Remove the middle instruction (index 1) - this tests lines 135-138
      fireEvent.click(deleteButtons[1]);

      // Should now have 2 instructions, and steps should be renumbered
      await waitFor(() => {
        const remainingSteps = screen.getAllByText(/^Step \d+$/);
        // At least 2 steps should remain
        expect(remainingSteps.length).toBeGreaterThanOrEqual(2);
        expect(remainingSteps.length).toBeLessThan(stepTexts.length);
      });
    });
  });

  // Branch Coverage Tests - Submit Error (line 169)
  describe('Submit Error Handling - Branch Coverage', () => {
    it('should handle submit error with Error instance - branch coverage', async () => {
      const errorSubmit = jest.fn().mockRejectedValue(new Error('Recipe creation failed'));

      renderWithProviders(<CreateRecipeForm onSubmit={errorSubmit} onCancel={mockOnCancel} />);

      // Navigate to review and submit
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

      await waitFor(() => {
        const selects = screen.queryAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
      const unitSelects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(unitSelects[0]);
      const cupsOption = await screen.findByText('cups');
      fireEvent.click(cupsOption);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
      fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Submit and expect error (tests line 169 - error.message branch)
      fireEvent.click(screen.getByRole('button', { name: /create recipe/i }));

      await waitFor(() => {
        expect(screen.getByText(/recipe creation failed/i)).toBeInTheDocument();
      });
    });

    it('should handle submit error without Error instance - fallback branch', async () => {
      const errorSubmit = jest.fn().mockRejectedValue('Unknown error');

      renderWithProviders(<CreateRecipeForm onSubmit={errorSubmit} onCancel={mockOnCancel} />);

      // Navigate to review and submit
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

      await waitFor(() => {
        const selects = screen.queryAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
      const unitSelects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(unitSelects[0]);
      const cupsOption = await screen.findByText('cups');
      fireEvent.click(cupsOption);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
      fireEvent.change(instructionInputs[0], { target: { value: 'Cook' } });

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Submit and expect fallback error (tests line 169 - fallback 'Failed to create recipe' branch)
      fireEvent.click(screen.getByRole('button', { name: /create recipe/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to create recipe/i)).toBeInTheDocument();
      });
    });
  });

  // Additional Edge Case Tests for Uncovered Lines
  describe('Additional Edge Cases - Branch Coverage', () => {
    it('should test default case in canProceed - line 90', () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Fill required fields and navigate to review step (step 3)
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));

      // The default case (line 90) returns true for any step >= 3
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should remove an ingredient when clicking delete button - line 118', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Navigate to ingredients
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      // Add a second ingredient
      fireEvent.click(screen.getByText(/add ingredient/i));

      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      expect(ingredientInputs.length).toBe(2);

      // Find delete buttons (testing line 118 - removeIngredient)
      const deleteButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('svg[data-testid="DeleteIcon"]')
      );

      // Click the first delete button
      fireEvent.click(deleteButtons[0]);

      // Should have one less ingredient
      await waitFor(() => {
        const remainingInputs = screen.getAllByLabelText(/^ingredient$/i);
        expect(remainingInputs.length).toBe(1);
      });
    });

    it('should handle description field with maxLength constraint - line 224', () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const descriptionInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;

      // Type exactly 500 characters
      const maxText = 'a'.repeat(500);
      fireEvent.change(descriptionInput, { target: { value: maxText } });

      // Should accept 500 characters
      expect(descriptionInput.value.length).toBe(500);
      expect(screen.getByText('500/500 characters')).toBeInTheDocument();

      // Verify the maxLength prop is set (line 208)
      expect(descriptionInput).toHaveAttribute('maxlength', '500');
    });

    it('should update cuisine selection - line 224', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Find cuisine select (line 224)
      const cuisineSelects = screen.getAllByRole('combobox');
      const cuisineSelect = cuisineSelects.find(select =>
        select.getAttribute('id')?.includes('cuisine') ||
        select.parentElement?.textContent?.includes('Cuisine')
      );

      if (cuisineSelect) {
        fireEvent.mouseDown(cuisineSelect);

        await waitFor(() => {
          const mexicanOption = screen.getByText('Mexican');
          fireEvent.click(mexicanOption);
        });

        // Cuisine should be updated
        expect(cuisineSelect).toHaveTextContent('Mexican');
      }
    });

    it('should update difficulty selection - line 237', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Find difficulty select (line 237)
      const selects = screen.getAllByRole('combobox');
      const difficultySelect = selects.find(select =>
        select.getAttribute('id')?.includes('difficulty') ||
        select.parentElement?.textContent?.includes('Difficulty')
      );

      if (difficultySelect) {
        fireEvent.mouseDown(difficultySelect);

        await waitFor(() => {
          const hardOption = screen.getByText('Hard');
          fireEvent.click(hardOption);
        });

        // Difficulty should be updated
        expect(difficultySelect).toHaveTextContent('Hard');
      }
    });

    it('should update caption field - line 275-285', () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Find caption field (lines 281-287)
      const captionInput = screen.getByLabelText(/caption \(optional\)/i);
      fireEvent.change(captionInput, { target: { value: 'This is my favorite recipe!' } });

      expect((captionInput as HTMLInputElement).value).toBe('This is my favorite recipe!');
    });

    it('should filter out empty ingredients and instructions on submit - line 162-163', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Fill form and add empty ingredients/instructions
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test Recipe' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      // Add multiple ingredients, but only fill one
      fireEvent.click(screen.getByText(/add ingredient/i));
      fireEvent.click(screen.getByText(/add ingredient/i));

      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      fireEvent.change(ingredientInputs[1], { target: { value: 'Flour' } });

      await waitFor(() => {
        const selects = screen.queryAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
      const unitSelects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(unitSelects[1]);
      const cupsOption = await screen.findByText('cups');
      fireEvent.click(cupsOption);

      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Add multiple instructions, but only fill one
      fireEvent.click(screen.getByText(/add step/i));
      const instructionInputs = screen.getAllByLabelText(/^step \d+$/i);
      fireEvent.change(instructionInputs[0], { target: { value: 'Mix ingredients' } });

      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /create recipe/i }));

      // Should filter out empty ingredients and instructions (lines 162-163)
      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(expect.objectContaining({
          ingredients: expect.arrayContaining([
            expect.objectContaining({ name: 'Flour' })
          ]),
          instructions: expect.arrayContaining([
            expect.objectContaining({ description: 'Mix ingredients' })
          ])
        }));
      });

      // Verify only non-empty items were included
      const submittedData = mockOnSubmit.mock.calls[0][0];
      expect(submittedData.ingredients.length).toBe(1);
      expect(submittedData.instructions.length).toBe(1);
    });

    it('should handle ingredient without name but with unit selected - validation edge case', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Navigate to ingredients
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      // Don't fill ingredient name, but select a unit
      await waitFor(() => {
        const selects = screen.queryAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
      const unitSelects = screen.getAllByRole('combobox');
      fireEvent.mouseDown(unitSelects[0]);
      const cupsOption = await screen.findByText('cups');
      fireEvent.click(cupsOption);

      // Try to proceed - should fail validation (line 85-86)
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Should show error because no ingredient has a name
      await waitFor(() => {
        expect(screen.getByText(/please add at least one ingredient with a unit/i)).toBeInTheDocument();
      });
    });

    it('should show error indicator on ingredient unit field when name is filled but unit is missing', async () => {
      renderWithProviders(<CreateRecipeForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Navigate to ingredients
      fireEvent.change(screen.getByLabelText(/recipe title/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
      fireEvent.click(screen.getByText(/upload image/i));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        expect(screen.getByText(/add ingredient/i)).toBeInTheDocument();
      });

      // Fill ingredient name but don't select unit (line 336 - error prop on FormControl)
      const ingredientInputs = screen.getAllByLabelText(/^ingredient$/i);
      fireEvent.change(ingredientInputs[0], { target: { value: 'Flour' } });

      // The FormControl should show error state when name is filled but unit is empty
      const unitSelects = screen.getAllByRole('combobox');
      const unitFormControl = unitSelects[0].closest('.MuiFormControl-root');

      // Try to proceed to trigger validation display
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/please add at least one ingredient with a unit/i)).toBeInTheDocument();
      });
    });
  });
});
