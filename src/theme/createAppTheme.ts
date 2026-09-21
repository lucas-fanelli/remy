import { createTheme, type Theme } from '@mui/material/styles';
import { tokensFor } from './tokens';

/**
 * Build the MUI theme from {@link tokensFor}.
 *
 * The theme this replaces declared `mode`, six intents, two backgrounds, three text
 * colours and one divider — and left `grey`, `action`, `common`, `shadows` and every
 * Paper elevation overlay to MUI's defaults. That is why an audit counted 32 neutral
 * fills in dark mode: components either invented their own or were handed one by MUI
 * that nobody had written.
 *
 * Two jobs here. Map the tokens onto the palette slots components already ask for, so
 * `color="primary"` and `'text.secondary'` keep working and start meaning something. And
 * override the components that reach past the palette for a colour the theme cannot see.
 */
export function createAppTheme(mode: 'light' | 'dark', animate = true): Theme {
  // Colour transitions are suppressed on the first render, or the correction from the
  // server's guess to the reader's actual mode animates in front of them.
  const fade = animate ? 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
  const fadeAll = animate
    ? 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)'
    : 'none';
  const t = tokensFor(mode);

  return createTheme({
    palette: {
      mode,
      primary: { main: t.brand.main, dark: t.brand.hover, contrastText: t.text.onBrand },
      secondary: { main: t.accent.gold, contrastText: t.text.primary },
      error: { main: t.state.danger, contrastText: t.state.onDanger },
      warning: { main: t.state.warning, contrastText: t.state.onWarning },
      info: { main: t.state.info, contrastText: t.state.onInfo },
      success: { main: t.state.success, contrastText: t.state.onSuccess },
      background: { default: t.surface.base, paper: t.surface.raised },
      text: { primary: t.text.primary, secondary: t.text.secondary, disabled: t.text.disabled },
      divider: t.border.subtle,
      // Declared rather than inherited. `action` was absent, so MUI's defaults decided
      // what a hover, a selected row and a disabled control looked like — including the
      // empty half of every star rating.
      action: {
        active: t.text.secondary,
        hover: t.brand.subtle,
        selected: t.brand.subtle,
        disabled: t.text.disabled,
        disabledBackground: t.surface.sunken,
        focus: t.brand.subtle,
      },
    },

    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h6: { fontWeight: 600 },
    },

    shape: { borderRadius: 8 },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // `color-scheme` makes the browser's own chrome — scrollbars, form controls,
          // the caret — follow the theme instead of staying light on a dark page.
          ':root': { colorScheme: mode },
          body: {
            backgroundColor: t.surface.base,
            color: t.text.primary,
            transition: fadeAll,
          },
          '*': { transition: fadeAll },
          '::selection': {
            backgroundColor: t.brand.subtle,
            color: t.text.primary,
          },
          // A focus ring that survives both modes and does not rely on the brand colour
          // alone, since focus can land on a brand-coloured fill.
          ':focus-visible': {
            outline: `2px solid ${t.border.focus}`,
            outlineOffset: 2,
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            transition: fade,
            backgroundColor: t.surface.raised,
            // The single most important line here. MUI's dark mode paints a white overlay
            // on Paper that gets stronger with elevation, so a component asking for
            // `background.paper` rendered #373737, #3F3F3F or #4B4B4B depending on where
            // it sat — eight greys that appear nowhere in this repo.
            backgroundImage: 'none',
          },
          outlined: { borderColor: t.border.subtle },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: t.surface.raised,
            backgroundImage: 'none',
            // A drop shadow is invisible on a dark page, so elevation there is carried by
            // a border instead of a shadow pretending to work.
            border: mode === 'dark' ? `1px solid ${t.border.subtle}` : 'none',
            boxShadow: mode === 'dark' ? 'none' : `0 2px 8px ${t.shadow.card}`,
            transition: fade,
          },
        },
      },

      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: t.surface.raised,
            backgroundImage: 'none',
            color: t.text.primary,
            // The bar used to be defined by a 1px divider at 1.35:1 and nothing else.
            borderBottom: `1px solid ${t.border.subtle}`,
            boxShadow: 'none',
            transition: fade,
          },
        },
      },

      MuiDivider: { styleOverrides: { root: { borderColor: t.border.subtle } } },

      MuiBackdrop: {
        styleOverrides: {
          root: {
            // MUI's own is a mode-invariant 50% black behind every dialog, drawer and menu.
            backgroundColor: t.surface.overlay,
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            // Derived from MUI's undeclared grey scale, and identical in both modes.
            backgroundColor: t.surface.raised,
            color: t.text.primary,
            border: `1px solid ${t.border.strong}`,
            fontSize: '0.8125rem',
          },
          arrow: { color: t.surface.raised },
        },
      },

      MuiAvatar: {
        styleOverrides: {
          root: {
            // Every user without a photo was an initial on MUI's default grey.
            backgroundColor: t.surface.sunken,
            color: t.text.secondary,
          },
        },
      },

      MuiRating: {
        styleOverrides: {
          // The filled star was a hex belonging to node_modules, the same in both modes
          // and the only gold dark mode had.
          iconFilled: { color: t.accent.gold },
          iconEmpty: { color: t.border.strong },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: { backgroundColor: t.border.subtle },
          bar: { backgroundColor: t.brand.main },
        },
      },

      MuiSkeleton: {
        styleOverrides: {
          // MUI's default tint is nearly invisible on a dark page.
          root: { backgroundColor: t.surface.sunken },
        },
      },

      MuiChip: {
        // `variants`, not a `&.MuiChip-colorDefault` selector inside styleOverrides.
        //
        // That selector matches two classes, which out-specifies the `sx` prop — so a
        // chip asking for a dark scrim and light ink over a photo lost its background
        // and its text to the theme while its icon (a descendant rule, and one of them
        // `!important`) kept the light ink. The result was a pale pill with a white
        // clock on it, unreadable, on top of the photo it was meant to sit over.
        //
        // Variants generate a class at the same level as the base, so `sx` wins again,
        // which is the contract `sx` is supposed to have.
        variants: [
          {
            props: { variant: 'filled', color: 'default' },
            style: { backgroundColor: t.surface.sunken, color: t.text.primary },
          },
          {
            props: { variant: 'outlined', color: 'default' },
            style: { borderColor: t.border.strong },
          },
        ],
      },

      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
          containedPrimary: {
            backgroundColor: t.brand.main,
            color: t.text.onBrand,
            '&:hover': { backgroundColor: t.brand.hover },
          },
          outlined: { borderColor: t.border.strong },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: t.surface.raised,
            backgroundImage: 'none',
            border: mode === 'dark' ? `1px solid ${t.border.subtle}` : 'none',
            borderRadius: 16,
          },
          paperFullScreen: { borderRadius: 0 },
        },
      },

      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: '1.25rem', fontWeight: 600, padding: '16px 24px' } },
      },

      MuiDialogActions: {
        styleOverrides: { root: { padding: '12px 24px 16px' } },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: t.surface.raised,
            backgroundImage: 'none',
            border: `1px solid ${t.border.subtle}`,
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: { borderColor: t.border.strong },
        },
      },
    },
  });
}
