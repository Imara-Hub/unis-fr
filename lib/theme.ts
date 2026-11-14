import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

// Frosted glass: a see-through white panel that blurs the soft navy and gold glow behind it.
const GLASS = {
  bg: "glass.bg",
  backdropFilter: "blur(18px) saturate(160%)",
  borderWidth: "1px",
  borderColor: "glass.border",
  boxShadow: "glass",
};

// Change part of a built-in slot recipe; createSystem merges it with Chakra's default.
const extendSlots = (name: string, recipe: object) => ({
  slots: defaultConfig.theme?.slotRecipes?.[name]?.slots ?? [],
  ...recipe,
});

// "The illuminated page": the deep blue of the UNIS logo (brand.900 = #1A234E), gold leaf used
// only for lines and marks, cool paper white. Red is kept for "failed" and errors.
const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#EEF0F8" },
          100: { value: "#D6DBEE" },
          200: { value: "#AEB7DC" },
          300: { value: "#8090C4" },
          400: { value: "#5568A8" },
          500: { value: "#3A4C8C" },
          600: { value: "#2C3A73" },
          700: { value: "#23305F" },
          800: { value: "#1E2956" },
          900: { value: "#1A234E" },
          950: { value: "#10163A" },
        },
        gold: {
          50: { value: "#FBF5E6" },
          100: { value: "#F4E6C2" },
          200: { value: "#E9CF8C" },
          300: { value: "#DDB65A" },
          400: { value: "#C99A35" },
          500: { value: "#B3832A" },
          600: { value: "#946A22" },
          700: { value: "#73521C" },
          800: { value: "#553D16" },
          900: { value: "#3A2A10" },
          950: { value: "#21180A" },
        },
      },
      // A little bigger than Chakra's defaults (16px base → 17px): Source Sans is drawn smaller than
      // most fonts at the same size, and the app is read on phones and on tablets at arm's length.
      fontSizes: {
        "2xs": { value: "0.75rem" }, // 12px
        xs: { value: "0.8125rem" }, // 13px
        sm: { value: "0.9375rem" }, // 15px
        md: { value: "1.0625rem" }, // 17px
        lg: { value: "1.1875rem" }, // 19px
        xl: { value: "1.3125rem" }, // 21px
        "2xl": { value: "1.5rem" }, // 24px
        "3xl": { value: "1.875rem" }, // 30px
        "4xl": { value: "2.25rem" }, // 36px
        "5xl": { value: "2.875rem" }, // 46px
        "6xl": { value: "3.625rem" }, // 58px
        "7xl": { value: "4.5rem" }, // 72px
      },
      fonts: {
        body: { value: "var(--font-body), system-ui, sans-serif" },
        heading: { value: "var(--font-body), system-ui, sans-serif" },
        display: { value: "var(--font-display), system-ui, sans-serif" },
        arabic: { value: "var(--font-arabic), 'Traditional Arabic', serif" },
        bismillah: { value: "var(--font-bismillah), 'Traditional Arabic', serif" },
        // Phone numbers and codes: the text font, with equal-width digits (see globalCss), not a typewriter font.
        mono: { value: "var(--font-body), system-ui, sans-serif" },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.600}" },
          contrast: { value: "white" },
          fg: { value: "{colors.brand.700}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.50}" },
          emphasized: { value: "{colors.brand.200}" },
          focusRing: { value: "{colors.brand.500}" },
        },
        gold: {
          solid: { value: "{colors.gold.500}" },
          contrast: { value: "white" },
          fg: { value: "{colors.gold.700}" },
          muted: { value: "{colors.gold.100}" },
          subtle: { value: "{colors.gold.50}" },
          emphasized: { value: "{colors.gold.200}" },
          focusRing: { value: "{colors.gold.500}" },
        },
        bg: {
          // See-through, so strips and boxes inside glass cards stay frosted too.
          subtle: { value: "rgba(238,240,248,0.55)" },
        },
        glass: {
          bg: { value: "rgba(255,255,255,0.62)" },
          strong: { value: "rgba(255,255,255,0.82)" },
          border: { value: "rgba(255,255,255,0.75)" },
        },
      },
      shadows: {
        glass: {
          value:
            "0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 2px rgba(16,22,58,0.04), 0 10px 30px -12px rgba(16,22,58,0.16)",
        },
      },
    },
    layerStyles: {
      // For hand-made panels: <Box layerStyle="glass">.
      glass: { value: GLASS },
    },
    slotRecipes: {
      card: extendSlots("card", {
        variants: {
          variant: {
            outline: { root: GLASS },
            elevated: { root: GLASS },
          },
        },
      }),
      dialog: extendSlots("dialog", { base: { content: { ...GLASS, bg: "glass.strong" } } }),
      drawer: extendSlots("drawer", { base: { content: { backdropFilter: "blur(18px) saturate(160%)" } } }),
      menu: extendSlots("menu", { base: { content: { "--menu-bg": "colors.glass.strong", backdropFilter: "blur(18px) saturate(160%)" } } }),
      popover: extendSlots("popover", { base: { content: { "--popover-bg": "colors.glass.strong", backdropFilter: "blur(18px) saturate(160%)" } } }),
      // Rows let the card's glass show through instead of painting white stripes.
      table: extendSlots("table", { variants: { variant: { line: { row: { bg: "transparent" } } } } }),
    },
    recipes: {
      // Rounder buttons with a little depth: soft shadow, lift on hover, press down on click.
      button: {
        base: {
          borderRadius: "xl",
          fontWeight: "semibold",
          transition: "background 0.15s, box-shadow 0.15s, transform 0.1s, color 0.15s",
          _active: { transform: "translateY(0.5px) scale(0.99)" },
        },
        variants: {
          size: {
            "2xs": { borderRadius: "md" },
            xs: { borderRadius: "lg" },
            sm: { borderRadius: "lg" },
          },
          variant: {
            solid: {
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 2px rgba(16,22,58,0.18), 0 6px 14px -8px rgba(16,22,58,0.5)",
              _hover: {
                bg: "colorPalette.solid/92",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 2px 4px rgba(16,22,58,0.18), 0 10px 20px -10px rgba(16,22,58,0.55)",
                transform: "translateY(-1px)",
              },
              _disabled: { boxShadow: "none", transform: "none" },
            },
            outline: {
              bg: "white/60",
              backdropFilter: "blur(8px)",
              boxShadow: "0 1px 2px rgba(16,22,58,0.06)",
              _hover: { bg: "colorPalette.subtle" },
            },
          },
        },
      },
      // Fields: a little more solid than the card, so they still read as places to type.
      input: { base: { borderRadius: "lg" }, variants: { variant: { outline: { bg: "white/70" } } } },
      textarea: { base: { borderRadius: "lg" }, variants: { variant: { outline: { bg: "white/70" } } } },
    },
  },
  globalCss: {
    // Normal (proportional) digits in text, so it reads like print, not a typewriter. Places where
    // numbers must line up (tables, scores, counters) set tabular-nums themselves.
    "html, body": { color: "fg", fontSize: "md", fontVariantNumeric: "lining-nums", textRendering: "optimizeLegibility" },
    // Tables: equal-width digits so the columns line up.
    "table, input[type=tel], input[type=number]": { fontVariantNumeric: "lining-nums tabular-nums" },
    // The glow the glass blurs: navy from the top corners, a touch of gold low down, on paper white.
    body: {
      bg: "#F2F3F8",
      backgroundImage: [
        "radial-gradient(60rem 40rem at 100% -10%, rgba(58,76,140,0.22), transparent 60%)",
        "radial-gradient(50rem 35rem at -10% 10%, rgba(26,35,78,0.14), transparent 60%)",
        "radial-gradient(45rem 30rem at 80% 110%, rgba(201,154,53,0.16), transparent 60%)",
      ].join(", "),
      backgroundAttachment: "fixed",
    },
    "::selection": { bg: "gold.200" },
  },
});

export const system = createSystem(defaultConfig, config);
