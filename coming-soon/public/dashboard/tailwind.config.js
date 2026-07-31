/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{ts,tsx}'],
    darkMode: ['selector', '[data-theme="dark"]'],
    theme: {
        extend: {
            colors: {
                border: 'var(--border)',
                input: 'var(--border)',
                ring: 'var(--primary)',
                background: 'var(--background)',
                foreground: 'var(--text-primary)',
                'foreground-secondary': 'var(--text-secondary)',
                'foreground-muted': 'var(--text-muted)',
                primary: {
                    DEFAULT: 'var(--primary)',
                    hover: 'var(--primary-hover)',
                    subtle: 'var(--primary-subtle)',
                    foreground: 'var(--text-inverse)'
                },
                secondary: {
                    DEFAULT: 'var(--surface-hover)',
                    foreground: 'var(--text-primary)'
                },
                destructive: {
                    DEFAULT: 'var(--danger)',
                    foreground: 'var(--text-inverse)'
                },
                success: {
                    DEFAULT: 'var(--success)',
                    subtle: 'var(--success-bg)'
                },
                warning: {
                    DEFAULT: 'var(--warning)',
                    subtle: 'var(--warning-bg)'
                },
                danger: {
                    DEFAULT: 'var(--danger)',
                    subtle: 'var(--danger-bg)'
                },
                info: {
                    DEFAULT: 'var(--info)',
                    subtle: 'var(--info-bg)'
                },
                accent: {
                    DEFAULT: 'var(--accent)'
                },
                card: {
                    DEFAULT: 'var(--surface)',
                    foreground: 'var(--text-primary)',
                    hover: 'var(--surface-hover)'
                },
                popover: {
                    DEFAULT: 'var(--surface-elevated)',
                    foreground: 'var(--text-primary)'
                },
                muted: {
                    DEFAULT: 'var(--surface-hover)',
                    foreground: 'var(--text-muted)'
                }
            },
            fontFamily: {
                sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace']
            },
            fontSize: {
                xs: ['var(--font-size-xs)', { lineHeight: 'var(--leading-normal)' }],
                sm: ['var(--font-size-sm)', { lineHeight: 'var(--leading-normal)' }],
                base: ['var(--font-size-base)', { lineHeight: 'var(--leading-normal)' }],
                lg: ['var(--font-size-lg)', { lineHeight: 'var(--leading-tight)' }],
                xl: ['var(--font-size-xl)', { lineHeight: 'var(--leading-tight)' }],
                '2xl': ['var(--font-size-2xl)', { lineHeight: 'var(--leading-tight)' }],
                '3xl': ['var(--font-size-3xl)', { lineHeight: 'var(--leading-tight)' }],
                '4xl': ['var(--font-size-4xl)', { lineHeight: 'var(--leading-tight)' }]
            },
            borderRadius: {
                sm: 'var(--radius-sm)',
                md: 'var(--radius-md)',
                lg: 'var(--radius-lg)',
                xl: 'var(--radius-xl)',
                '2xl': 'var(--radius-2xl)'
            },
            boxShadow: {
                DEFAULT: 'var(--shadow)',
                md: 'var(--shadow-md)',
                lg: 'var(--shadow-lg)',
                xl: 'var(--shadow-xl)'
            },
            spacing: {
                1: 'var(--space-1)',
                2: 'var(--space-2)',
                3: 'var(--space-3)',
                4: 'var(--space-4)',
                5: 'var(--space-5)',
                6: 'var(--space-6)',
                8: 'var(--space-8)',
                10: 'var(--space-10)',
                12: 'var(--space-12)',
                16: 'var(--space-16)'
            },
            transitionDuration: {
                DEFAULT: '180ms',
                slow: '250ms'
            },
            width: {
                nav: 'var(--nav-width)'
            },
            height: {
                header: 'var(--header-height)'
            }
        }
    },
    plugins: []
};
