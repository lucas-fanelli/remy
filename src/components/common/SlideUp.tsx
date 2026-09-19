'use client';
import { Slide } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import React from 'react';

/** Dialog transition for full-screen (phone) dialogs: the sheet rises from the bottom edge */
const SlideUp = React.forwardRef<
  HTMLDivElement,
  TransitionProps & { children: React.ReactElement }
>(function SlideUp(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default SlideUp;
