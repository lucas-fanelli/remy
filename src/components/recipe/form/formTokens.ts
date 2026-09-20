import { Theme } from '@mui/material/styles';

/**
 * Spacing between form parts, in theme spacing units (1 unit = 8px) so they can go
 * straight into `sx` (`gap: formSpacing.field`, `mt: formSpacing.group`).
 */
export const formSpacing = {
  /** 24px between groups (a heading + its fields) */
  group: 3,
  /** 16px between fields */
  field: 2,
  /** 8px between a label and its field, or a field and its quick picks */
  label: 1,
} as const;

/**
 * The ONE non-error 'look here' colour. Only for icons and bars (>= 3:1 on paper in both
 * themes) and always paired with text in text.secondary / text.primary - never for text:
 * light-mode warning.main is ~2.9:1 on white.
 */
export const attentionColor = (theme: Theme): string =>
  theme.palette.warning[theme.palette.mode === 'light' ? 'dark' : 'main'];

/** The 'n/max' counter shows from 80% of the limit and is emphasised from 90% */
export const COUNTER_VISIBLE_FROM = 0.8;
export const COUNTER_EMPHASIS_FROM = 0.9;

/** Emphasis is weight + text colour, never orange text */
export const counterEmphasisSx = { fontWeight: 600, color: 'text.primary' } as const;

export interface FieldCounter {
  /** 'n/max' */
  text: string;
  visible: boolean;
  emphasised: boolean;
}

/** `always` keeps the counter on screen below 80% (the description shows it at all times) */
export function getFieldCounter(length: number, max: number, always = false): FieldCounter {
  return {
    text: `${length}/${max}`,
    visible: always || length >= max * COUNTER_VISIBLE_FROM,
    emphasised: length >= max * COUNTER_EMPHASIS_FROM,
  };
}
