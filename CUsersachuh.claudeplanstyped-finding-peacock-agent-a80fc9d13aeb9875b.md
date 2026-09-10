# Design Plan: Mobile Responsiveness for QPrint Drop

## Goal
Make the QPrint Drop application properly mobile responsive, ensuring a native-like feel on mobile devices, eliminating layout shifts caused by browser address bars, and optimizing the layout for small screens.

## Current Issues
1. **Viewport Height**: Use of `h-screen` and `min-h-screen` causes issues with mobile address bars.
2. **Rigid Queue Card**: In `Receive.tsx`, the Queue card has fixed heights (`h-[65vh]`, `min-h-[450px]`) that are too restrictive for mobile.
3. **Navbar Positioning**: Absolute positioning of the Navbar in `Receive.tsx` may cause overlap or spacing issues on mobile.
4. **Density**: Padding and font sizes in `Receive.tsx` and `Send.tsx` need refinement for smaller viewports.

## Implementation Strategy

### 1. Layout & Viewport Fixes
- **Dynamic Viewport Height**: Replace all instances of `h-screen` and `min-h-screen` with `min-h-dvh`. This ensures the application fills the actual visible area of the browser, accounting for the dynamic nature of mobile address bars.
- **Overflow Management**: Review `overflow-hidden` usage on main containers to ensure that content exceeding the viewport on mobile remains accessible via scrolling.

### 2. `Receive.tsx` Enhancements
- **Navbar**:
  - Adjust `top-6` to be more flexible or change to `fixed` if it helps with positioning.
  - Ensure the Navbar doesn't overlap the hero text on small screens.
- **Hero Section**:
  - Refine padding (e.g., change `pt-20` to `pt-24 sm:pt-20`) to give the Navbar more room.
  - Verify that the title font sizes (`text-[3rem]`) scale correctly on the smallest devices.
- **Queue Card**:
  - **Height**: Change `h-[65vh]` and `min-h-[450px]` to `h-auto min-h-0` on mobile, and keep the original constraints on `lg:` screens.
  - **Padding**: Reduce `p-8` to `p-6` on mobile.
  - **Scrolling**: Ensure the `overflow-y-auto` container behaves correctly when the card height is automatic.
- **Footer Logos**:
  - Ensure the "Trusted by networks" section is accessible at the bottom of the page without being cut off.

### 3. `Send.tsx` Enhancements
- **Viewport**: Replace `min-h-screen` with `min-h-dvh`.
- **Upload Area**:
  - Reduce padding from `p-10` to `p-8` on mobile.
  - Ensure the "Tap to select files" area is easily reachable for one-handed use.
- **Settings Card**:
  - Adjust internal padding `p-5` to `p-4` on mobile.
  - Ensure the `select` inputs are touch-friendly and consistent in size.

### 4. Verification Steps
- **Device Emulation**: Use Chrome DevTools to test across:
  - iPhone SE (Smallest)
  - Pixel 7 (Medium)
  - iPad Mini (Tablet)
- **Real Device Testing**: Verify `dvh` behavior on Safari (iOS) and Chrome (Android) to confirm address bars don't cause layout jumps.
- **Interaction Check**:
  - Ensure the Queue card in `Receive.tsx` can be scrolled independently if it contains many items.
  - Confirm that all buttons and selects in `Send.tsx` are easy to tap.

## Critical Files for Implementation
- `src/pages/Receive.tsx`
- `src/pages/Send.tsx`
- `src/index.css`
