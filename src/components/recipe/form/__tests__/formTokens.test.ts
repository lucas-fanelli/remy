import { createTheme } from '@mui/material/styles';
import { attentionColor, counterEmphasisSx, formSpacing, getFieldCounter } from '../formTokens';

describe('formSpacing', () => {
  it('should be 24px between groups, 16px between fields and 8px label-to-field', () => {
    const theme = createTheme();

    const pixels = {
      group: theme.spacing(formSpacing.group),
      field: theme.spacing(formSpacing.field),
      label: theme.spacing(formSpacing.label),
    };

    expect(pixels).toEqual({ group: '24px', field: '16px', label: '8px' });
  });
});

describe('attentionColor', () => {
  it('should use warning.dark on light paper, where warning.main is below 3:1', () => {
    const theme = createTheme({ palette: { mode: 'light' } });

    expect(attentionColor(theme)).toBe(theme.palette.warning.dark);
  });

  it('should use warning.main on dark paper', () => {
    const theme = createTheme({ palette: { mode: 'dark' } });

    expect(attentionColor(theme)).toBe(theme.palette.warning.main);
  });
});

describe('getFieldCounter', () => {
  it('should stay hidden below 80% of the limit', () => {
    expect(getFieldCounter(79, 100)).toEqual({
      text: '79/100',
      visible: false,
      emphasised: false,
    });
  });

  it('should show from 80% of the limit', () => {
    expect(getFieldCounter(80, 100).visible).toBe(true);
  });

  it('should always show when asked to, as the description does', () => {
    expect(getFieldCounter(0, 500, true).visible).toBe(true);
  });

  it('should not be emphasised below 90% of the limit', () => {
    expect(getFieldCounter(89, 100).emphasised).toBe(false);
  });

  it('should be emphasised from 90% of the limit', () => {
    expect(getFieldCounter(90, 100).emphasised).toBe(true);
  });

  it('should emphasise with weight and text colour, never with orange text', () => {
    expect(counterEmphasisSx).toEqual({ fontWeight: 600, color: 'text.primary' });
  });
});
