'use client';
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
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
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowBack,
  ArrowForward,
  Check,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe, UpdateRecipeDTO, Ingredient, Instruction, DifficultyLevel } from '@/domain/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import ImageUpload from '@/components/common/ImageUpload';

const MotionBox = motion.create(Box);

interface EditRecipeModalProps {
  open: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onSuccess: (updatedRecipe: Recipe) => void;
}

const steps = ['Recipe Info', 'Ingredients', 'Instructions', 'Review'];

const commonUnits = [
  'cups', 'tbsp', 'tsp', 'g', 'kg', 'oz', 'lb',
  'ml', 'L', 'pieces', 'pinch', 'to taste', 'whole'
];

export default function EditRecipeModal({ open, recipe, onClose, onSuccess }: EditRecipeModalProps) {
  const { token } = useAuth();
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
  const [cookingTime, setCookingTime] = useState<number | ''>(30);
  const [prepTime, setPrepTime] = useState<number | ''>(15);
  const [servings, setServings] = useState<number | ''>(4);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [caption, setCaption] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', amount: '', unit: '' },
  ]);
  const [instructions, setInstructions] = useState<Instruction[]>([
    { step: 1, description: '', image: '' },
  ]);

  // Pre-fill form when recipe changes
  useEffect(() => {
    if (recipe) {
      setTitle(recipe.title);
      setDescription(recipe.description);
      setImageUrl(recipe.imageUrl);
      setCookingTime(recipe.cookingTime);
      setPrepTime(recipe.prepTime);
      setServings(recipe.servings);
      setDifficulty(recipe.difficulty);
      setCaption(recipe.caption || '');
      setIngredients(recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '', amount: '', unit: '' }]);
      setInstructions(recipe.instructions.length > 0 ? recipe.instructions : [{ step: 1, description: '', image: '' }]);
    }
  }, [recipe]);

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return title.trim() !== '' &&
               description.trim() !== '' &&
               imageUrl.trim() !== '' &&
               typeof cookingTime === 'number' && cookingTime > 0 &&
               typeof prepTime === 'number' && prepTime >= 0 &&
               typeof servings === 'number' && servings > 0;
      case 1:
        return ingredients.length > 0 && ingredients.every(ing =>
          ing.name.trim() !== '' &&
          ing.unit.trim() !== '' &&
          (ing.unit === 'to taste' || ing.amount.trim() !== '')
        );
      case 2:
        return instructions.every(inst => inst.description.trim() !== '');
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceed()) {
      setActiveStep((prev) => prev + 1);
      setError('');
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError('');
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', unit: '' }]);
  };

  const handleRemoveIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };

    // Clear amount when "to taste" is selected
    if (field === 'unit' && value === 'to taste') {
      newIngredients[index].amount = '';
    }

    setIngredients(newIngredients);
  };

  const handleAddInstruction = () => {
    setInstructions([
      ...instructions,
      { step: instructions.length + 1, description: '', image: '' },
    ]);
  };

  const handleRemoveInstruction = (index: number) => {
    if (instructions.length > 1) {
      const newInstructions = instructions
        .filter((_, i) => i !== index)
        .map((inst, i) => ({ ...inst, step: i + 1 }));
      setInstructions(newInstructions);
    }
  };

  const handleInstructionChange = (index: number, field: keyof Instruction, value: string | number) => {
    const newInstructions = [...instructions];
    newInstructions[index] = { ...newInstructions[index], [field]: value };
    setInstructions(newInstructions);
  };

  const handleSubmit = async () => {
    if (!recipe || !token) return;

    try {
      setLoading(true);
      setError('');

      const updateData: UpdateRecipeDTO = {
        title,
        description,
        imageUrl,
        cookingTime: typeof cookingTime === 'number' ? cookingTime : 30,
        prepTime: typeof prepTime === 'number' ? prepTime : 15,
        servings: typeof servings === 'number' ? servings : 4,
        difficulty,
        ingredients: ingredients.filter(i =>
          i.name.trim() !== '' && i.unit.trim() !== '' &&
          (i.unit === 'to taste' || i.amount.trim() !== '')
        ),
        instructions: instructions.filter(i => i.description.trim() !== ''),
        caption: caption.trim() === '' ? null : caption,
      };

      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update recipe');
      }

      const data = await response.json();
      onSuccess(data.recipe);
      handleClose();
    } catch (err) {
      console.error('Error updating recipe:', err);
      setError(err instanceof Error ? err.message : 'Failed to update recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setError('');
    onClose();
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Recipe Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Classic Spaghetti Carbonara"
              autoComplete="off"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              required
              multiline
              rows={3}
              placeholder="Brief description of your recipe"
              autoComplete="off"
            />

            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              label="Recipe Image"
              required
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Cooking Time (minutes)"
                  type="number"
                  value={cookingTime}
                  onChange={(e) => setCookingTime(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  required
                  inputProps={{ min: 1, max: 720 }}
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Prep Time (minutes)"
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  required
                  inputProps={{ min: 0, max: 480 }}
                  autoComplete="off"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Servings"
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  required
                  inputProps={{ min: 1, max: 100 }}
                  autoComplete="off"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    value={difficulty}
                    label="Difficulty"
                    onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                  >
                    <MenuItem value="easy">Easy</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="hard">Hard</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              label="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              fullWidth
              multiline
              rows={2}
              placeholder="A personal note about your recipe"
              autoComplete="off"
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Select &quot;to taste&quot; for ingredients without specific amounts. Amount is optional for &quot;to taste&quot; ingredients.
            </Typography>

            {ingredients.map((ingredient, index) => (
              <Card key={index} variant="outlined">
                <CardContent sx={{ p: { xs: 1.5, md: 2 }, '&:last-child': { pb: { xs: 1.5, md: 2 } } }}>
                  <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 1, md: 2 },
                    alignItems: { xs: 'stretch', sm: 'flex-start' }
                  }}>
                    <TextField
                      label="Ingredient"
                      value={ingredient.name}
                      onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                      fullWidth
                      required
                      placeholder="e.g., Tomatoes"
                      size="small"
                      autoComplete="off"
                      error={ingredient.name === '' && (ingredient.amount !== '' || ingredient.unit !== '')}
                    />
                    <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                      <TextField
                        label={ingredient.unit === 'to taste' ? 'Amount' : 'Amount'}
                        value={ingredient.amount}
                        onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                        required={ingredient.unit !== 'to taste'}
                        placeholder="2"
                        size="small"
                        sx={{ width: { xs: '100px', sm: '100px' } }}
                        autoComplete="off"
                        error={ingredient.amount === '' && ingredient.name !== '' && ingredient.unit !== 'to taste'}
                        disabled={ingredient.unit === 'to taste'}
                      />
                      <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 120 } }} required error={!ingredient.unit && ingredient.name !== ''}>
                        <InputLabel>Unit</InputLabel>
                        <Select
                          value={ingredient.unit}
                          label="Unit"
                          onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                        >
                          {commonUnits.map((unit) => (
                            <MenuItem key={unit} value={unit}>{unit}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <IconButton
                        onClick={() => handleRemoveIngredient(index)}
                        color="error"
                        disabled={ingredients.length === 1}
                        size={isMobile ? 'small' : 'medium'}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={handleAddIngredient}
              variant="outlined"
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
            >
              Add Ingredient
            </Button>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Add step-by-step instructions
            </Typography>

            {instructions.map((instruction, index) => (
              <Card key={index} variant="outlined">
                <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Chip
                        label={`Step ${instruction.step}`}
                        color="primary"
                        size={isMobile ? 'small' : 'medium'}
                      />
                      <IconButton
                        onClick={() => handleRemoveInstruction(index)}
                        color="error"
                        disabled={instructions.length === 1}
                        size={isMobile ? 'small' : 'medium'}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    <TextField
                      label="Instruction"
                      value={instruction.description}
                      onChange={(e) => handleInstructionChange(index, 'description', e.target.value)}
                      fullWidth
                      required
                      multiline
                      minRows={4}
                      maxRows={10}
                      placeholder="Describe this step in detail..."
                      autoComplete="off"
                    />
                    <ImageUpload
                      value={instruction.image || ''}
                      onChange={(url) => handleInstructionChange(index, 'image', url)}
                      label={`Step ${instruction.step} Image (optional)`}
                      required={false}
                      compact
                    />
                  </Box>
                </CardContent>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={handleAddInstruction}
              variant="outlined"
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
            >
              Add Step
            </Button>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Alert severity="info">
              Review your changes before updating
            </Alert>

            <Box>
              <Typography variant="h6" gutterBottom>Recipe Info</Typography>
              <Typography><strong>Title:</strong> {title}</Typography>
              <Typography><strong>Description:</strong> {description}</Typography>
              <Typography><strong>Time:</strong> {prepTime}min prep + {cookingTime}min cook</Typography>
              <Typography><strong>Servings:</strong> {servings}</Typography>
              <Typography><strong>Difficulty:</strong> {difficulty}</Typography>
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>Ingredients ({ingredients.length})</Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                {ingredients.map((ing, i) => (
                  <li key={i}>
                    {ing.amount} {ing.unit} {ing.name}
                  </li>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="h6" gutterBottom>Instructions ({instructions.length} steps)</Typography>
              <Box component="ol" sx={{ pl: 2 }}>
                {instructions.map((inst, i) => (
                  <li key={i}>{inst.description}</li>
                ))}
              </Box>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: { maxHeight: isMobile ? '100vh' : '90vh' }
      }}
    >
      <DialogTitle sx={{ pb: { xs: 1, md: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontSize: { xs: '1.125rem', md: '1.25rem' } }}>
            Edit Recipe
          </Typography>
          <IconButton onClick={handleClose} edge="end" size={isMobile ? 'small' : 'medium'}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: { xs: 1, md: 2 } }}>
          {/* Stepper - Desktop */}
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

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <MotionBox
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </MotionBox>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            justifyContent: 'space-between',
            gap: { xs: 1, sm: 0 },
            mt: { xs: 3, md: 4 }
          }}>
            <Button
              onClick={activeStep === 0 ? handleClose : handleBack}
              startIcon={activeStep === 0 ? undefined : <ArrowBack />}
              disabled={loading}
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
            >
              {activeStep === 0 ? 'Cancel' : 'Back'}
            </Button>

            <Button
              variant="contained"
              onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
              endIcon={activeStep === steps.length - 1 ? <Check /> : <ArrowForward />}
              disabled={!canProceed() || loading}
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
            >
              {loading ? 'Updating...' : activeStep === steps.length - 1 ? 'Update Recipe' : 'Next'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
