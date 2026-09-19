'use client';
import { Box, Typography } from '@mui/material';
import StepNumber from '@/components/recipe/display/StepNumber';
import ParsedReadout from './ParsedReadout';
import { StepRowValue } from './types';

export interface ParsedStepsReadoutProps {
  /** `form.values.steps` */
  rows: StepRowValue[];
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * '6 steps', plus the photos whose paragraph was deleted: they are kept (a photo is never
 * dropped) and the author should hear about them before Publish names them.
 */
export function stepsSummary(rows: StepRowValue[]): string {
  const written = rows.filter((row) => row.description.trim() !== '').length;
  const orphans = rows.filter((row) => row.description.trim() === '' && row.image !== '').length;
  const summary = plural(written, 'step', 'steps');
  return orphans > 0
    ? `${summary} - ${plural(orphans, 'photo', 'photos')} without a step`
    : summary;
}

/** What Remy understood from the Method box: the numbered first line of every step */
export default function ParsedStepsReadout({ rows }: ParsedStepsReadoutProps) {
  if (rows.every((row) => row.description.trim() === '' && row.image === '')) return null;

  return (
    <ParsedReadout summary={stepsSummary(rows)}>
      {rows.map((row, index) =>
        row.description.trim() === '' ? null : (
          <Box
            component="li"
            key={row.id}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, minWidth: 0 }}
          >
            <StepNumber
              number={index + 1}
              responsive={false}
              sx={{ width: 24, height: 24, minWidth: 24, typography: 'caption', fontWeight: 700 }}
            />
            <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
              {row.description.trim().split('\n')[0]}
            </Typography>
          </Box>
        )
      )}
    </ParsedReadout>
  );
}
