import * as Schema from 'effect/Schema'

export const ThemeColorScheme = Schema.Union(
  Schema.Literal('light'),
  Schema.Literal('dark'),
  Schema.Literal('light dark'),
)
export type ThemeColorScheme = Schema.Schema.Type<typeof ThemeColorScheme>
export const isThemeColorScheme = Schema.is(ThemeColorScheme)

/**
 * Porto theme definition.
 */
export type Theme<
  ColorScheme extends ThemeColorScheme,
  SchemeColor = ColorScheme extends 'light dark' ? LightDarkColor : Color,
> = {
  colorScheme: ColorScheme

  accent: SchemeColor
  focus: SchemeColor
  link: SchemeColor
  separator: SchemeColor

  radiusSmall: number
  radiusMedium: number
  radiusLarge: number

  baseBackground: SchemeColor
  baseAltBackground: SchemeColor
  basePlaneBackground: SchemeColor
  baseBorder: SchemeColor
  baseContent: SchemeColor
  baseContentSecondary: SchemeColor
  baseContentTertiary: SchemeColor
  baseContentPositive: SchemeColor
  baseContentNegative: SchemeColor
  baseHoveredBackground: SchemeColor

  frameBackground: SchemeColor
  frameBorder: SchemeColor
  frameContent: SchemeColor
  frameRadius: number

  badgeBackground: SchemeColor
  badgeContent: SchemeColor
  badgeStrongBackground: SchemeColor
  badgeStrongContent: SchemeColor
  badgeInfoBackground: SchemeColor
  badgeInfoContent: SchemeColor
  badgeNegativeBackground: SchemeColor
  badgeNegativeContent: SchemeColor
  badgePositiveBackground: SchemeColor
  badgePositiveContent: SchemeColor
  badgeWarningBackground: SchemeColor
  badgeWarningContent: SchemeColor

  primaryBackground: SchemeColor
  primaryContent: SchemeColor
  primaryBorder: SchemeColor
  primaryHoveredBackground: SchemeColor
  primaryHoveredBorder: SchemeColor

  secondaryBackground: SchemeColor
  secondaryContent: SchemeColor
  secondaryBorder: SchemeColor
  secondaryHoveredBackground: SchemeColor
  secondaryHoveredBorder: SchemeColor

  disabledBackground: SchemeColor
  disabledBorder: SchemeColor
  disabledContent: SchemeColor

  negativeBackground: SchemeColor
  negativeContent: SchemeColor
  negativeBorder: SchemeColor

  negativeSecondaryBackground: SchemeColor
  negativeSecondaryContent: SchemeColor
  negativeSecondaryBorder: SchemeColor

  positiveBackground: SchemeColor
  positiveContent: SchemeColor
  positiveBorder: SchemeColor

  strongBackground: SchemeColor
  strongContent: SchemeColor
  strongBorder: SchemeColor

  fieldBackground: SchemeColor
  fieldContent: SchemeColor
  fieldContentSecondary: SchemeColor
  fieldBorder: SchemeColor
  fieldErrorBorder: SchemeColor
  fieldFocusedBackground: SchemeColor
  fieldFocusedContent: SchemeColor
}

type PartialTheme<Th extends Theme<ThemeColorScheme>> = Partial<
  Omit<Th, 'colorScheme'>
> & {
  colorScheme: Th['colorScheme']
}

/**
 * A Porto theme fragment, used to extend themes with partial definitions.
 * `light dark` only accepts color pairs (`LightDarkColor`), while `light`
 * and `dark` only accept single colors (`Color`).
 */
export type ThemeFragment =
  | PartialTheme<Theme<'light'>>
  | PartialTheme<Theme<'dark'>>
  | PartialTheme<Theme<'light dark'>>

export const Color = Schema.Union(
  Schema.Literal('transparent'),
  Schema.String.pipe(
    Schema.pattern(/^#([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/),
  ),
)

export const LightDarkColor = Schema.Tuple(Color, Color)

/**
 * A color to be used in themes.
 *
 * This schema allows:
 * - Hex color with 6 or 3 digits (RRGGBB or RGB).
 * - Hex color + alpha with 8 digits (RRGGBBAA).
 * - The string "transparent".
 */
export type Color = Schema.Schema.Type<typeof Color>
export const isColor = Schema.is(Color)

/**
 * A light + dark color pair to be used in themes.
 *
 * The order must be `[light, dark]`, where:
 *   - `light` is the color used in light mode.
 *   - `dark` is the color used in dark mode.
 */
export type LightDarkColor = Schema.Schema.Type<typeof LightDarkColor>
export const isLightDarkColor = Schema.is(LightDarkColor)
