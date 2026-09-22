import { Grid, Skeleton } from '@mui/material';

/**
 * Where a grid of recipe cards will be, before it is — sized and laid out like the grid it
 * becomes, so nothing below it jumps when the cards arrive.
 *
 * The same breakpoints and spacing as every recipe grid in the app. A screen that rendered
 * nothing while it loaded let the footer rise into the gap and drop again, which is part
 * of what hid the scroll bug documented in ScrollReset.
 */
export default function RecipeGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
      {Array.from({ length: count }, (_, i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Skeleton variant="rounded" height={340} />
        </Grid>
      ))}
    </Grid>
  );
}
