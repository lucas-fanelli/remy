'use client';
import { WarningAmber } from '@mui/icons-material';
import { Box, ButtonBase, Chip, Typography } from '@mui/material';
import { useId } from 'react';
import IngredientLine from '@/components/recipe/display/IngredientLine';
import { UNIT_TO_TASTE } from '@/lib/constants';
import { attentionColor } from './formTokens';
import { isBlankIngredientRow, isToTasteRow, normaliseIngredientRow } from './formValues';
import ParsedReadout from './ParsedReadout';
import { IngredientRowValue } from './types';

export interface ParsedIngredientsReadoutProps {
  /** `form.values.ingredients`; blank rows are skipped */
  rows: IngredientRowValue[];
  /** Row id -> why the parser was unsure (`useTextCapture().checks`) */
  checks: Readonly<Record<string, string>>;
  /** A flagged row was activated: show it on the other tab */
  onCheckRow: (rowId: string) => void;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** '8 ingredients - 1 to check': also what the editor's live region announces */
export function ingredientsSummary(rows: IngredientRowValue[], checkCount: number): string {
  const filled = rows.filter((row) => !isBlankIngredientRow(row)).length;
  const summary = plural(filled, 'ingredient', 'ingredients');
  return checkCount > 0 ? `${summary} - ${checkCount} to check` : summary;
}

/** The row as toPayload will send it, so the line reads exactly like the published one */
const toPublishedIngredient = (row: IngredientRowValue) => {
  const normalised = normaliseIngredientRow(row);
  return isToTasteRow(normalised)
    ? { name: normalised.name.trim(), amount: '', unit: UNIT_TO_TASTE }
    : { name: normalised.name.trim(), amount: normalised.amount, unit: normalised.unit };
};

function CheckRow({
  row,
  reason,
  onCheckRow,
}: {
  row: IngredientRowValue;
  reason: string;
  onCheckRow: (rowId: string) => void;
}) {
  const reasonId = useId();

  return (
    <Box component="li" sx={{ mb: 0.75 }}>
      <ButtonBase
        type="button"
        aria-label={`Check ${row.name.trim() || 'this ingredient'} on the next tab`}
        aria-describedby={reasonId}
        onClick={() => onCheckRow(row.id)}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: '100%',
          textAlign: 'left',
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
        }}
      >
        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <IngredientLine ingredient={toPublishedIngredient(row)} dense component="span" />
          {/* Never colour alone: an icon and the word */}
          <Chip
            size="small"
            variant="outlined"
            label="Check"
            icon={<WarningAmber />}
            sx={{ flexShrink: 0, '& .MuiChip-icon': { color: attentionColor } }}
          />
        </Box>
        <Typography id={reasonId} component="span" variant="caption" color="text.secondary">
          {reason}
        </Typography>
      </ButtonBase>
    </Box>
  );
}

/** What Remy understood from the Ingredients box, one published line per row */
export default function ParsedIngredientsReadout({
  rows,
  checks,
  onCheckRow,
}: ParsedIngredientsReadoutProps) {
  const filled = rows.filter((row) => !isBlankIngredientRow(row));
  if (filled.length === 0) return null;

  const checkCount = filled.filter((row) => row.id in checks).length;

  return (
    <ParsedReadout summary={ingredientsSummary(filled, checkCount)}>
      {filled.map((row) =>
        row.id in checks ? (
          <CheckRow key={row.id} row={row} reason={checks[row.id]} onCheckRow={onCheckRow} />
        ) : (
          <Box component="li" key={row.id} sx={{ mb: 0.75 }}>
            <IngredientLine ingredient={toPublishedIngredient(row)} dense component="span" />
          </Box>
        )
      )}
    </ParsedReadout>
  );
}
