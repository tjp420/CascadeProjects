/**
 * SimpleBeacon 2.0 Design System
 * Comprehensive design tokens and utilities for consistent UI/UX
 */

export interface DesignTokens {
  colors: {
    primary: {
      50: string;
      100: string;
      500: string;
      600: string;
      700: string;
      900: string;
    };
    secondary: {
      50: string;
      100: string;
      500: string;
      600: string;
      700: string;
      900: string;
    };
    accent: {
      50: string;
      100: string;
      500: string;
      600: string;
      700: string;
      900: string;
    };
    neutral: {
      50: string;
      100: string;
      200: string;
      300: string;
      400: string;
      500: string;
      600: string;
      700: string;
      800: string;
      900: string;
    };
    success: {
      50: string;
      100: string;
      500: string;
      600: string;
      700: string;
      900: string;
    };
    warning: {
      50: string;
      100: string;
      500: string;
      600: string;
      700: string;
      900: string;
    };
    error: {
      50: string;
      100: string;
      500: string;
      600: string;
      700: string;
      900: string;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    '4xl': string;
    '5xl': string;
    '6xl': string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
      '5xl': string;
      '6xl': string;
      '7xl': string;
      '8xl': string;
      '9xl': string;
    };
    fontWeight: {
      thin: string;
      light: string;
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
      extrabold: string;
      black: string;
    };
    lineHeight: {
      tight: string;
      snug: string;
      normal: string;
      relaxed: string;
      loose: string;
      extraLoose: string;
    };
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
  zIndex: {
    hide: string;
    auto: string;
    base: string;
    docked: string;
    sticky: string;
    banner: string;
    dropdown: string;
    modal: string;
    popover: string;
    overlay: string;
    tooltip: string;
  };
}

export const designTokens: DesignTokens = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      900: '#1e3a8a',
    },
    secondary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      900: '#064e3b',
    },
    accent: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      900: '#991b1b',
    },
    neutral: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      900: '#065f46',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      900: '#92400e',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      900: '#991b1b',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '40px',
    '6xl': '48px',
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
      '7xl': '4.5rem',
      '8xl': '6rem',
      '9xl': '8rem',
    },
    fontWeight: {
      thin: '100',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    lineHeight: {
      tight: '1.25',
      snug: '1.375',
      normal: '1.5',
      relaxed: '1.625',
      loose: '1.75',
      extraLoose: '2',
    },
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    md: '0.25rem',
    lg: '0.375rem',
    xl: '0.5rem',
    '2xl': '0.75rem',
    full: '9999px',
  },
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  zIndex: {
    hide: '-1',
    auto: 'auto',
    base: '0',
    docked: '10',
    sticky: '100',
    banner: '1100',
    dropdown: '1000',
    modal: '1050',
    popover: '1060',
    overlay: '1070',
    tooltip: '1080',
  },
};

export const themeColors = {
  light: {
    background: designTokens.colors.neutral[50],
    foreground: designTokens.colors.neutral[900],
    panel: designTokens.colors.neutral[100],
    border: designTokens.colors.neutral[200],
    input: designTokens.colors.neutral[100],
    button: designTokens.colors.neutral[200],
    focus: designTokens.colors.primary[500],
    success: designTokens.colors.success[500],
    warning: designTokens.colors.warning[500],
    error: designTokens.colors.error[500],
  },
  dark: {
    background: designTokens.colors.neutral[900],
    foreground: designTokens.colors.neutral[50],
    panel: designTokens.colors.neutral[800],
    border: designTokens.colors.neutral[700],
    input: designTokens.colors.neutral[800],
    button: designTokens.colors.neutral[700],
    focus: designTokens.colors.primary[600],
    success: designTokens.colors.success[600],
    warning: designTokens.colors.warning[600],
    error: designTokens.colors.error[600],
  },
};

export const spacing = designTokens.spacing;
export const typography = designTokens.typography;
export const shadows = designTokens.shadows;
export const borderRadius = designTokens.borderRadius;
export const transitions = designTokens.transitions;
export const zIndex = designTokens.zIndex;
