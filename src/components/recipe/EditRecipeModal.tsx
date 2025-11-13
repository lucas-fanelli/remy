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

const cuisines = [
  'Italian', 'Mexican', 'Japanese', 'Chinese', 'Indian', 'French',
  'Thai', 'Mediterranean', 'American', 'Korean', 'Vietnamese', 'Other'
];

const commonUnits = [
  'cups', 'tbsp', 'tsp', 'g', 'kg', 'oz', 'lb',
  'ml', 'L', 'pieces', 'pinch', 'to taste', 'whole'
];

export default function EditRecipeModal({ open, recipe, onClose, onSuccess }: EditRecipeModalProps) {
  const { token } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cookingTime, setCookingTime] = useState(30);
  const [prepTime, setPrepTime] = useState(15);
  const [servings, setServings] = useState(4);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [cuisine, setCuisine] = useState('Italian');
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
      setCuisine(recipe.cuisine);
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
               cookingTime > 0 &&
               prepTime >= 0 &&
               servings > 0;
      case 1:
        return ingredients.every(ing =>
          ing.name.trim() !== '' &&
          ing.amount.trim() !== '' &&
          ing.unit.trim() !== ''
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
        cookingTime,
        prepTime,
        servings,
        difficulty,
        cuisine,
        ingredients,
        instructions,
        caption: caption || undefined,
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
                  onChange={(e) => setCookingTime(Number(e.target.value))}
                  fullWidth
                  required
                  inputProps={{ min: 1, max: 720 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Prep Time (minutes)"
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(Number(e.target.value))}
                  fullWidth
                  required
                  inputProps={{ min: 0, max: 480 }}
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Servings"
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  fullWidth
                  required
                  inputProps={{ min: 1, max: 100 }}
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
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required>
                  <InputLabel>Cuisine</InputLabel>
                  <Select
                    value={cuisine}
                    label="Cuisine"
                    onChange={(e) => setCuisine(e.target.value)}
                  >
                    {cuisines.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
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
            />
          </Box>
        );

      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Add all ingredients needed for this recipe
            </Typography>

            {ingredients.map((ingredient, index) => (
              <Card key={index} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <TextField
                      label="Ingredient"
                      value={ingredient.name}
                      onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                      fullWidth
                      required
                      placeholder="e.g., Tomatoes"
                      size="small"
                    />
                    <TextField
                      label="Amount"
                      value={ingredient.amount}
                      onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                      required
                      placeholder="2"
                      size="small"
                      sx={{ width: 100 }}
                    />
                    <FormControl size="small" sx={{ minWidth: 120 }} required>
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
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={handleAddIngredient}
              variant="outlined"
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
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <Chip label={`Step ${instruction.step}`} color="primary" />
                    <Box sx={{ flex: 1 }}>
                      <TextField
                        label="Instruction"
                        value={instruction.description}
                        onChange={(e) => handleInstructionChange(index, 'description', e.target.value)}
                        fullWidth
                        required
                        multiline
                        rows={2}
                        placeholder="Describe this step..."
                        size="small"
                      />
                      <TextField
                        label="Image URL (optional)"
                        value={instruction.image || ''}
                        onChange={(e) => handleInstructionChange(index, 'image', e.target.value)}
                        fullWidth
                        placeholder="https://example.com/step-image.jpg"
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    <IconButton
                      onClick={() => handleRemoveInstruction(index)}
                      color="error"
                      disabled={instructions.length === 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={handleAddInstruction}
              variant="outlined"
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
              <Typography><strong>Cuisine:</strong> {cuisine}</Typography>
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
      PaperProps={{
        sx: { maxHeight: '90vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Edit Recipe</Typography>
          <IconButton onClick={handleClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Stepper */}
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              onClick={activeStep === 0 ? handleClose : handleBack}
              startIcon={activeStep === 0 ? undefined : <ArrowBack />}
              disabled={loading}
            >
              {activeStep === 0 ? 'Cancel' : 'Back'}
            </Button>

            <Button
              variant="contained"
              onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
              endIcon={activeStep === steps.length - 1 ? <Check /> : <ArrowForward />}
              disabled={!canProceed() || loading}
            >
              {loading ? 'Updating...' : activeStep === steps.length - 1 ? 'Update Recipe' : 'Next'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
