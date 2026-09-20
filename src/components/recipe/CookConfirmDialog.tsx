'use client';
import { CheckCircleOutline, ErrorOutline, RemoveCircleOutline } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useUnitLabels } from '@/i18n/units';
import type { IngredientPlan, PantryPlan } from '@/lib/cooking/pantryPlan';

/**
 * What cooking this recipe will take out of your pantry, shown before it happens.
 *
 * The dialog it replaces was titled "Insufficient Ingredients" and appeared only when
 * something was short. It could not mention an ingredient you had none of — those were
 * skipped without a word — so it routinely asked "cook anyway?" while listing one problem
 * out of five. This lists the whole plan, and it is the only way the deduction runs.
 */
interface CookConfirmDialogProps {
  open: boolean;
  plan: PantryPlan | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Rounded for reading: 0.5333 tbsp of oil is noise, 0.53 is a quantity. */
function readableAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export default function CookConfirmDialog({
  open,
  plan,
  busy,
  onCancel,
  onConfirm,
}: CookConfirmDialogProps) {
  const t = useTranslations('recipe');
  const units = useUnitLabels();

  const taking = plan?.ingredients.filter((i) => i.deduct > 0) ?? [];
  const missing = plan?.ingredients.filter((i) => i.status === 'missing') ?? [];
  const short = plan?.ingredients.filter((i) => i.status === 'short') ?? [];

  const label = (amount: number, unit: string) =>
    `${readableAmount(amount)} ${units.label(unit, amount)}`;

  /** What you have, said in whichever unit can actually be said. */
  const haveText = (i: IngredientPlan) =>
    i.available !== null
      ? label(i.available, i.unit)
      : i.pantryQuantity !== null && i.pantryUnit !== null
        ? label(i.pantryQuantity, i.pantryUnit)
        : null;

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t('cookDialog.title')}</DialogTitle>
      <DialogContent>
        {taking.length > 0 && (
          <>
            <DialogContentText sx={{ mb: 1 }}>{t('cookDialog.taking')}</DialogContentText>
            <List dense disablePadding>
              {taking.map((i, index) => (
                <ListItem key={`take-${i.name}-${index}`} disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <RemoveCircleOutline fontSize="small" color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={i.name}
                    secondary={label(i.deduct, i.pantryUnit ?? i.unit)}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {short.length > 0 && (
          <>
            <DialogContentText sx={{ mt: 2, mb: 1 }}>{t('cookDialog.short')}</DialogContentText>
            <List dense disablePadding>
              {short.map((i, index) => (
                <ListItem key={`short-${i.name}-${index}`} disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <ErrorOutline fontSize="small" color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={i.name}
                    secondary={t('cookDialog.shortRow', {
                      needed: i.required !== null ? label(i.required, i.unit) : '',
                      have: haveText(i) ?? '',
                    })}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {missing.length > 0 && (
          <>
            <DialogContentText sx={{ mt: 2, mb: 1 }}>{t('cookDialog.missing')}</DialogContentText>
            <List dense disablePadding>
              {missing.map((i, index) => (
                <ListItem key={`missing-${i.name}-${index}`} disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <ErrorOutline fontSize="small" color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={i.name}
                    secondary={
                      // An ingredient can be "missing" because you have none, or because
                      // you hold it in a unit that cannot be compared to the recipe's —
                      // 50 g of pepper against half a teaspoon. Say which.
                      i.pantryQuantity !== null
                        ? t('cookDialog.missingUnitRow', {
                            needed: i.required !== null ? label(i.required, i.unit) : '',
                            have: label(i.pantryQuantity, i.pantryUnit ?? ''),
                          })
                        : i.required !== null
                          ? t('cookDialog.missingRow', { needed: label(i.required, i.unit) })
                          : undefined
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        {taking.length === 0 && missing.length === 0 && short.length === 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
            <CheckCircleOutline fontSize="small" color="success" />
            <Typography variant="body2" color="text.secondary">
              {t('cookDialog.nothingToDeduct')}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {t('cookDialog.cancel')}
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={busy}>
          {busy ? t('actions.marking') : t('cookDialog.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
