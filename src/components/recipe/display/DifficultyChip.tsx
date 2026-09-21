'use client';
import { Chip, ChipProps } from '@mui/material';
import { alpha, SxProps, Theme } from '@mui/material/styles';
import { useTranslations } from 'next-intl';
import { getDifficultyColor } from '@/lib/utils/recipe';
import { tokensFor } from '@/theme/tokens';
import { useTokens } from '@/theme/useTokens';

/**
 * A badge over a photograph never sees the page behind it, so the scrim is
 * `rgba(0, 0, 0, 0.62)` and the ink is `#FFFFFF` in BOTH modes — the rule the time pill
 * already follows. The accent has to obey the same logic: the ground is dark either way,
 * so it cannot come from the current mode's palette. Light mode's deep green measures
 * 1.21:1 against that scrim and the rule simply disappears; the dark set is the one
 * calibrated for a dark ground. Measured in `theme/__tests__/contrast.test.ts`.
 */
const onCoverTokens = tokensFor('dark');
const ON_COVER_TONE = {
  success: onCoverTokens.state.success,
  warning: onCoverTokens.state.warning,
  error: onCoverTokens.state.danger,
} as const;

/**
 * Where the chip is standing, which decides how it can carry its colour.
 *
 * `soft` tints the card's own surface: a 16% fill composites against whatever is behind
 * it, so it only works where that is a known, flat colour.
 *
 * `onCover` is for badges over a photograph, where the thing behind is the food. A tint
 * there composites against the image — legible on a dark stew, invisible on pasta — so
 * the fill becomes an opaque scrim and the difficulty is carried by a rule down the side
 * instead. It is the same reasoning the time pill beside it already uses.
 */
export type DifficultyChipAppearance = 'soft' | 'onCover';

export interface DifficultyChipProps {
  /** The value as it is STORED ('easy' / 'medium' / 'hard'); only the label is translated */
  difficulty: string;
  appearance?: DifficultyChipAppearance;
  size?: ChipProps['size'];
  sx?: SxProps<Theme>;
}

/**
 * 'Easy' / 'Medium' / 'Hard', tinted with the difficulty colour — never filled with it.
 *
 * The ink stays `text.primary` and a border plus the weight carry the emphasis. Filling
 * the chip is what forces the ink question, and both answers are wrong: white reads on
 * light mode's deep fills and measures 2.16:1 on the lighter ones dark mode uses, while
 * contrastText is calibrated for 100% opacity and turns white over a 16% tint.
 *
 * This rule is not new — `form/AtAGlance.tsx` has used it for the difficulty selector all
 * along, and this is that pattern promoted from one field to every difficulty in the app.
 * The alphas are taken from it deliberately so the two can never disagree.
 */
export default function DifficultyChip({
  difficulty,
  appearance = 'soft',
  size = 'medium',
  sx,
}: DifficultyChipProps) {
  const t = useTranslations('recipe');
  const tokens = useTokens();

  // A row written before the list was closed can hold anything, and the column is still
  // `String?`. `getDifficultyColor` answers 'default' for those; there is no
  // `palette.default`, so an unknown value simply gets no tint and no rule.
  const tone = getDifficultyColor(difficulty);
  const toned = tone === 'default' ? null : tone;

  const base = {
    fontWeight: 600,
    textTransform: 'capitalize' as const,
  };

  const appearanceSx =
    appearance === 'onCover'
      ? {
          ...base,
          height: 28,
          borderRadius: 14,
          backgroundColor: tokens.surface.overlay,
          color: tokens.text.onOverlay,
          borderLeft: `3px solid ${toned ? ON_COVER_TONE[toned] : onCoverTokens.border.strong}`,
          '& .MuiChip-label': { px: 1.5 },
        }
      : {
          ...base,
          ...(toned && {
            // The BORDER carries the tone at full strength; the fill is a whisper and the
            // ink is neutral. Each of those three is a measured decision:
            //
            // - The fill cannot carry it. At 16% the three tints land 6 to 27 RGB units
            //   apart depending on mode — warning and danger are 6 apart on a dark card,
            //   which is to say identical. A tint alone leaves the colour idle.
            // - The ink cannot carry it either, tempting as it looks. The tone at full
            //   strength on a 16% bed of itself measures 4.13 / 4.27 / 4.37 in light and
            //   4.21 on dark danger — four of six below AA. Neutral ink is 8.73 to 14.36.
            // - The border can: at full strength it is 4.13-4.75 against the fill it
            //   bounds and 5.13-6.45 against the card, both well over the 3:1 a boundary
            //   needs, and the three tones sit 37 to 174 apart.
            //
            // `theme/__tests__/contrast.test.ts` holds all of it.
            color: 'text.primary',
            backgroundColor: (theme: Theme) => alpha(theme.palette[toned].main, 0.16),
            border: (theme: Theme) => `1px solid ${theme.palette[toned].main}`,
          }),
        };

  return (
    <Chip
      // The message echoes an unrecognised value rather than printing a missing-key path
      label={t('meta.difficulty', { level: difficulty })}
      // `default`, never `color={tone}`: asking MUI for the tone paints palette[tone].main
      // at full opacity underneath and hands the label that colour's contrastText, so the
      // tint below would be fighting a fill it then has to cover. With `default` the
      // theme's `{ variant: 'filled', color: 'default' }` entry supplies the correct ink
      // for free, and because that entry lives in `variants` — the same specificity level
      // as the base class — this `sx` wins over its background.
      color="default"
      variant="filled"
      size={size}
      sx={[appearanceSx, ...(Array.isArray(sx) ? sx : [sx])]}
    />
  );
}
