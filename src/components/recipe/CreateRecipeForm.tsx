'use client';
import React, { useState } from 'react';
import {
  Box,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  useTheme,
  useMediaQuery,
  MobileStepper,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack,
  ArrowForward,
  Restaurant,
  Check,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateRecipeDTO, Ingredient, Instruction, DifficultyLevel } from '@/domain/types/recipe';
import ImageUpload from '@/components/common/ImageUpload';

const MotionBox = motion.create(Box);

interface CreateRecipeFormProps {
  onSubmit: (data: CreateRecipeDTO) => Promise<void>;
  onCancel: () => void;
}

const steps = ['Recipe Info', 'Ingredients', 'Instructions', 'Review'];

const commonUnits = [
  'cups',
  'tbsp',
  'tsp',
  'g',
  'kg',
  'oz',
  'lb',
  'mL',
  'L',
  'pieces',
  'pinch',
  'to taste',
  'whole',
];

export default function CreateRecipeForm({ onSubmit, onCancel }: CreateRecipeFormProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cookingTime, setCookingTime] = useState<number | ''>('');
  const [prepTime, setPrepTime] = useState<number | ''>('');
  const [servings, setServings] = useState<number | ''>('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [caption, setCaption] = useState('');

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', amount: '', unit: '' },
  ]);

  const [instructions, setInstructions] = useState<Instruction[]>([
    { step: 1, description: '', image: '' },
  ]);

  const canProceed = () => {
    switch (activeStep) {
      case 0: // Recipe Info
        return (
          title.trim() !== '' &&
          description.trim() !== '' &&
          description.length <= 500 &&
          imageUrl.trim() !== '' &&
          typeof cookingTime === 'number' &&
          cookingTime > 0 &&
          typeof prepTime === 'number' &&
          prepTime >= 0 &&
          typeof servings === 'number' &&
          servings > 0
        );
      case 1: // Ingredients
        return (
          ingredients.some((i) => i.name.trim() !== '') &&
          ingredients
            .filter((i) => i.name.trim())
            .every((i) => i.unit.trim() !== '' && (i.unit === 'to taste' || i.amount.trim() !== ''))
        );
      case 2: // Instructions
        return instructions.some((i) => i.description.trim() !== '');
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      setActiveStep((prev) => prev + 1);
      setError('');
    } else {
      if (activeStep === 0) {
        setError(
          'Please fill in all required fields: title, description (max 500 chars), image, and time/servings'
        );
      } else if (activeStep === 1) {
        setError('Please add at least one ingredient with name, amount, and unit');
      } else if (activeStep === 2) {
        setError('Please add at least one instruction step');
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', unit: '' }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };

    // Clear amount when "to taste" is selected
    if (field === 'unit' && value === 'to taste') {
      updated[index].amount = '';
    }

    setIngredients(updated);
  };

  const addInstruction = () => {
    setInstructions([
      ...instructions,
      { step: instructions.length + 1, description: '', image: '' },
    ]);
  };

  const removeInstruction = (index: number) => {
    const updated = instructions
      .filter((_, i) => i !== index)
      .map((inst, i) => ({ ...inst, step: i + 1 }));
    setInstructions(updated);
  };

  const updateInstruction = (index: number, field: keyof Instruction, value: string | number) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], [field]: value };
    setInstructions(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const data: CreateRecipeDTO = {
        title,
        description,
        imageUrl,
        cookingTime: typeof cookingTime === 'number' ? cookingTime : 30,
        prepTime: typeof prepTime === 'number' ? prepTime : 15,
        servings: typeof servings === 'number' ? servings : 4,
        difficulty,
        caption,
        ingredients: ingredients.filter(
          (i) =>
            i.name.trim() !== '' &&
            i.unit.trim() !== '' &&
            (i.unit === 'to taste' || i.amount.trim() !== '')
        ),
        instructions: instructions.filter((i) => i.description.trim()),
        userId: '', // Will be set by the API from session
      };

      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create recipe');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Grid container spacing={{ xs: 2, md: 3 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                  label="Recipe Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g., Grandma's Chocolate Chip Cookies"
                  autoComplete="off"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                  multiline
                  rows={isMobile ? 2 : 3}
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="What makes this recipe special?"
                  helperText={`${description.length}/500 characters`}
                  error={description.length > 500}
                  inputProps={{ maxLength: 500 }}
                  autoComplete="off"
                />
              </Grid>

              <Grid item xs={12}>
                <ImageUpload
                  value={imageUrl}
                  onChange={setImageUrl}
                  label="Recipe Image"
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size={isMobile ? 'small' : 'medium'}>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                    label="Difficulty"
                  >
                    <MenuItem value="easy">Easy</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="hard">Hard</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                  type="number"
                  label="Prep Time (min)"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  autoComplete="off"
                  InputLabelProps={{ shrink: prepTime !== '' }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                  type="number"
                  label="Cooking Time (min)"
                  value={cookingTime}
                  onChange={(e) =>
                    setCookingTime(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  required
                  autoComplete="off"
                  InputLabelProps={{ shrink: cookingTime !== '' }}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                  type="number"
                  label="Servings"
                  value={servings}
                  onChange={(e) => setServings(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  autoComplete="off"
                  InputLabelProps={{ shrink: servings !== '' }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                  label="Caption (Optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share your thoughts about this recipe..."
                  autoComplete="off"
                />
              </Grid>
            </Grid>
          </MotionBox>
        );

      case 1:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}
              >
                Ingredients
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
              >
                Add all ingredients with amounts and units (e.g., &ldquo;2 cups flour&rdquo;,
                &ldquo;1 tsp salt&rdquo;)
              </Typography>
              <Alert severity="info" sx={{ mt: 1, fontSize: { xs: '0.8125rem', md: '0.875rem' } }}>
                💡 Tip: Select &quot;to taste&quot; as unit for ingredients without specific amounts
                (like salt, pepper). Amount field is optional for &quot;to taste&quot; ingredients.
              </Alert>
            </Box>

            {ingredients.map((ingredient, index) => (
              <Card key={index} sx={{ mb: { xs: 1.5, md: 2 }, p: { xs: 1.5, md: 2 } }}>
                <Grid container spacing={{ xs: 1.5, md: 2 }} alignItems="center">
                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Ingredient *"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      placeholder="e.g., All-purpose flour"
                      autoComplete="off"
                      error={
                        ingredient.name === '' &&
                        (ingredient.amount !== '' || ingredient.unit !== '')
                      }
                    />
                  </Grid>
                  <Grid item xs={5} sm={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label={ingredient.unit === 'to taste' ? 'Amount' : 'Amount *'}
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                      placeholder="2"
                      autoComplete="off"
                      error={
                        ingredient.amount === '' &&
                        ingredient.name !== '' &&
                        ingredient.unit !== 'to taste'
                      }
                      disabled={ingredient.unit === 'to taste'}
                    />
                  </Grid>
                  <Grid item xs={5} sm={3}>
                    <FormControl
                      fullWidth
                      size="small"
                      error={!ingredient.unit && ingredient.name !== ''}
                    >
                      <InputLabel>Unit *</InputLabel>
                      <Select
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                        label="Unit *"
                      >
                        {commonUnits.map((unit) => (
                          <MenuItem key={unit} value={unit}>
                            {unit}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={2} sm={1} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <IconButton
                      color="error"
                      size={isMobile ? 'small' : 'medium'}
                      onClick={() => removeIngredient(index)}
                      disabled={ingredients.length === 1}
                    >
                      <DeleteIcon sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
                    </IconButton>
                  </Grid>
                </Grid>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={addIngredient}
              variant="outlined"
              fullWidth
              size={isMobile ? 'large' : 'medium'}
              sx={{ mt: { xs: 1.5, md: 2 } }}
            >
              Add Ingredient
            </Button>
          </MotionBox>
        );

      case 2:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}
              >
                Cooking Instructions
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
              >
                Break down the cooking process into clear steps
              </Typography>
            </Box>

            {instructions.map((instruction, index) => (
              <Card key={index} sx={{ mb: { xs: 1.5, md: 2 }, p: { xs: 2, md: 2.5 } }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Chip
                      label={`Step ${instruction.step}`}
                      color="primary"
                      size={isMobile ? 'small' : 'medium'}
                      sx={{ fontSize: { xs: '0.75rem', md: '0.8125rem' } }}
                    />
                    <IconButton
                      color="error"
                      size={isMobile ? 'small' : 'medium'}
                      onClick={() => removeInstruction(index)}
                      disabled={instructions.length === 1}
                    >
                      <DeleteIcon sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' } }} />
                    </IconButton>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    minRows={4}
                    maxRows={10}
                    label={`Step ${instruction.step}`}
                    value={instruction.description}
                    onChange={(e) => updateInstruction(index, 'description', e.target.value)}
                    placeholder="Describe this step in detail..."
                    autoComplete="off"
                  />
                  <ImageUpload
                    value={instruction.image || ''}
                    onChange={(url) => updateInstruction(index, 'image', url)}
                    label={`Step ${instruction.step} Image (optional)`}
                    required={false}
                    compact
                  />
                </Box>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={addInstruction}
              variant="outlined"
              fullWidth
              size={isMobile ? 'large' : 'medium'}
              sx={{ mt: { xs: 1.5, md: 2 } }}
            >
              Add Step
            </Button>
          </MotionBox>
        );

      case 3:
        return (
          <MotionBox
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}
            >
              Review Your Recipe
            </Typography>

            <Card sx={{ mb: { xs: 1.5, md: 2 } }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Typography
                  variant="h5"
                  gutterBottom
                  sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
                >
                  {title}
                </Typography>
                <Typography
                  color="text.secondary"
                  paragraph
                  sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
                >
                  {description}
                </Typography>

                <Box
                  sx={{
                    display: 'flex',
                    gap: { xs: 0.5, md: 1 },
                    mb: { xs: 1.5, md: 2 },
                    flexWrap: 'wrap',
                  }}
                >
                  <Chip
                    label={difficulty}
                    size="small"
                    color="primary"
                    sx={{ fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
                  />
                  <Chip
                    label={`${Number(prepTime) + Number(cookingTime)} min total`}
                    size="small"
                    sx={{ fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
                  />
                  <Chip
                    label={`${servings} servings`}
                    size="small"
                    sx={{ fontSize: { xs: '0.7rem', md: '0.8125rem' } }}
                  />
                </Box>

                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ fontSize: { xs: '0.9375rem', md: '1rem' } }}
                >
                  Ingredients ({ingredients.filter((i) => i.name).length})
                </Typography>
                <Box sx={{ mb: { xs: 1.5, md: 2 } }}>
                  {ingredients
                    .filter((i) => i.name)
                    .map((ing, i) => (
                      <Typography
                        key={i}
                        variant="body2"
                        sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
                      >
                        • {ing.amount} {ing.unit} {ing.name}
                      </Typography>
                    ))}
                </Box>

                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ fontSize: { xs: '0.9375rem', md: '1rem' } }}
                >
                  Instructions ({instructions.filter((i) => i.description).length} steps)
                </Typography>
                <Box>
                  {instructions
                    .filter((i) => i.description)
                    .map((inst, i) => (
                      <Typography
                        key={i}
                        variant="body2"
                        paragraph
                        sx={{ fontSize: { xs: '0.8125rem', md: '0.875rem' } }}
                      >
                        {inst.step}. {inst.description}
                      </Typography>
                    ))}
                </Box>
              </CardContent>
            </Card>
          </MotionBox>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Desktop Stepper */}
      {!isMobile && (
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {/* Mobile Stepper */}
      {isMobile && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 1 }}>
            Step {activeStep + 1} of {steps.length}: {steps[activeStep]}
          </Typography>
          <MobileStepper
            variant="progress"
            steps={steps.length}
            position="static"
            activeStep={activeStep}
            sx={{ flexGrow: 1, backgroundColor: 'transparent' }}
            nextButton={<Box />}
            backButton={<Box />}
          />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <AnimatePresence mode="wait">{renderStepContent()}</AnimatePresence>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          justifyContent: 'space-between',
          gap: { xs: 1, sm: 0 },
          mt: { xs: 3, md: 4 },
        }}
      >
        <Button
          startIcon={<ArrowBack />}
          onClick={activeStep === 0 ? onCancel : handleBack}
          disabled={loading}
          fullWidth={isMobile}
          size={isMobile ? 'large' : 'medium'}
        >
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        {activeStep < steps.length - 1 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={handleNext}
            disabled={loading}
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<Check />}
            onClick={handleSubmit}
            disabled={loading}
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
          >
            {loading ? 'Creating...' : 'Create Recipe'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
