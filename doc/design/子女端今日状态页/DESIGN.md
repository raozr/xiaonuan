---
name: Warm Companion
colors:
  surface: '#fff8f5'
  surface-dim: '#e7d7cc'
  surface-bright: '#fff8f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1e8'
  surface-container: '#fcebe0'
  surface-container-high: '#f6e5da'
  surface-container-highest: '#f0dfd5'
  on-surface: '#221a13'
  on-surface-variant: '#544437'
  inverse-surface: '#382f27'
  inverse-on-surface: '#ffeee3'
  outline: '#877365'
  outline-variant: '#dac2b1'
  surface-tint: '#8f4e00'
  primary: '#8f4e00'
  on-primary: '#ffffff'
  primary-container: '#ff9f43'
  on-primary-container: '#6d3a00'
  inverse-primary: '#ffb77a'
  secondary: '#4a626d'
  on-secondary: '#ffffff'
  secondary-container: '#cde6f4'
  on-secondary-container: '#506873'
  tertiary: '#006879'
  on-tertiary: '#ffffff'
  tertiary-container: '#0fc7e6'
  on-tertiary-container: '#004f5c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcc2'
  primary-fixed-dim: '#ffb77a'
  on-primary-fixed: '#2e1500'
  on-primary-fixed-variant: '#6d3a00'
  secondary-fixed: '#cde6f4'
  secondary-fixed-dim: '#b1cad7'
  on-secondary-fixed: '#051e28'
  on-secondary-fixed-variant: '#334a55'
  tertiary-fixed: '#aaedff'
  tertiary-fixed-dim: '#39d8f7'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#fff8f5'
  on-background: '#221a13'
  surface-variant: '#f0dfd5'
typography:
  headline-xl:
    fontFamily: Nunito Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 52px
  headline-lg:
    fontFamily: Nunito Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 44px
  headline-md:
    fontFamily: Nunito Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 22px
    fontWeight: '500'
    lineHeight: 32px
  body-md:
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  label-lg:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 24px
    letterSpacing: 0.5px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  margin-mobile: 24px
  gutter-mobile: 16px
  touch-target-min: 64px
  elderly-fab-size: 120px
---

## Brand & Style
The design system is centered on the concept of "Digital Companionship." It aims to bridge the gap between complex AI technology and the emotional needs of elderly users living independently. The brand personality is empathetic, patient, and inviting, moving away from "clinical" or "tech-heavy" aesthetics toward a tactile, home-like feel.

The style is a hybrid of **Minimalism** and **Tactile/Skeuomorphic** design. By using soft shadows and high-contrast (yet non-harsh) focal points, the interface mimics physical objects that are easy to understand and "press." The emotional response should be one of safety and warmth, reducing the anxiety often associated with modern smartphones.

## Colors
The palette is built on a base of soft cream (#FFF9F0) to eliminate the glare and harshness of pure white backgrounds, which can be straining for aging eyes. 

- **Primary Action:** Warm Orange (#FF9F43) is used exclusively for interactive elements and calls to action, signaling "energy" and "warmth."
- **Secondary Elements:** Calming Sage Green (#78909C) is utilized for non-urgent information, status indicators, and supporting icons to provide a sense of stability.
- **Typography:** Deep Charcoal (#2D3436) replaces pure black to ensure high legibility while maintaining a "soft" edge to the text rendering.

## Typography
This design system utilizes **Nunito Sans** for its rounded terminals and open counters, which maximize legibility for users with visual impairments. 

The type scale is intentionally oversized. The base body size starts at 22px for the elderly-facing interface to ensure effortless reading without the need for zooming. Line heights are generous (1.4x+) to prevent text lines from crowding. Bold weights are used frequently for structural clarity, ensuring that headings and labels are instantly distinguishable from body content.

## Layout & Spacing
The layout philosophy prioritizes "Spatial Breathing." It uses a **Fluid Grid** with significantly wider margins (24px) than standard applications to prevent accidental edge-taps and to focus the eye on the center of the screen.

- **Elderly Interface:** Uses a single-column layout. Elements are stacked vertically with large vertical gaps (32px+) to distinguish between different interaction zones.
- **Children's Interface:** Utilizes a multi-column card-based grid to provide a high-level overview of health data and activity logs, allowing for higher information density.
- **Hit Areas:** All interactive elements must maintain a minimum touch target of 64px, even if the visual element is smaller.

## Elevation & Depth
Depth is conveyed through **Ambient Shadows**. This design system avoids the flat-design trend in favor of subtle 3D cues that indicate "pressability."

Shadows are extra-diffused with a low opacity (10-15%) and are slightly tinted with the Primary Orange or Sage Green to maintain color harmony. Surface levels are kept to a minimum (Base, Raised, and Floating) to avoid confusing the user with complex hierarchies. Floating elements, particularly the 120px action button, use the highest elevation to appear as if they are hovering physically above the cream surface.

## Shapes
The shape language is defined by "The Friendly Radius." Every corner is rounded to at least 16px to remove any "sharpness" or perceived technical coldness. 

- **Standard Containers:** 16px (rounded-lg).
- **Large Action Buttons:** 32px or fully pill-shaped.
- **Image Containers:** 24px (rounded-xl) to create a soft, framed look for family photos or avatar icons.

## Components
- **The Core FAB:** A 120px circular Floating Action Button, always in Primary Orange, serving as the "Home" or "AI Talk" trigger. It features a high-contrast icon and a 3D shadow.
- **Instructional Cards:** Used on the children's side; these feature a white background with a Sage Green border to denote "Safe Information."
- **Status Chips:** Large-format chips (48px height) with rounded corners, used to show connectivity or health status (e.g., "Connected" or "Sleeping").
- **Avatar System:** The central AI character resides in a circular frame. Its expressions (Smiling, Attentive, Thinking) are communicated through simple eye and mouth movements in warm, hand-drawn styles.
- **The "Big List":** List items for the elderly side must have a minimum height of 88px, featuring large icons on the left and bold text on the right, separated by subtle dividers.