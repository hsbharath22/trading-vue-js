# Mobile Crosshair Control

This document explains the mobile-friendly crosshair control feature implemented in TradingVue.js.

## Overview

On mobile devices, the standard crosshair behavior of appearing exactly under your finger obscures the data you're trying to see. This feature implements a relative control system similar to TradingView's mobile version, where you can touch anywhere on the screen to control the crosshair through relative dragging.

## How It Works

### Activation

On mobile devices:
- **Long-press** (press and hold) anywhere on the chart to activate "aim" mode
- The crosshair appears at the long-press location

### Deactivation

- **Tap** anywhere on the chart to exit "aim" mode and return to "explore" mode
- The crosshair disappears

### While Active

- **Touch anywhere** on the screen to start dragging
- The crosshair moves by the **same amount** as your finger movement (relative control)
- You can lift your finger and touch elsewhere to continue controlling the crosshair
- The crosshair position is clamped within chart bounds
- **You don't have to touch the crosshair itself** - control it from anywhere on the screen!

## Usage

The mobile crosshair control is enabled automatically on mobile devices. No configuration is required - simply use TradingVue as normal:

```vue
<template>
  <trading-vue
    :data="chart"
    :width="width"
    :height="height"
  />
</template>

<script>
import TradingVue from 'trading-vue-js'

export default {
  components: { TradingVue },
  data() {
    return {
      chart: { /* your chart data */ },
      width: window.innerWidth,
      height: window.innerHeight
    }
  }
}
</script>
```

## Implementation Details

### Files Modified

1. **src/components/Chart.vue**
   - Extended cursor state to track handle position for internal tracking

2. **src/components/js/grid.js**
   - Added `emit_cursor_coord_relative()` method for relative positioning
   - Modified `panstart` handler to track initial crosshair and touch positions
   - Updated `panmove` handler to calculate drag deltas and apply relative movement
   - Updated `panend` handler to clear drag tracking state
   - Modified `press` handler to initialize crosshair at press location
   - Updated tap handler to clear handle position when exiting aim mode
   - Added automatic clamping to keep crosshair within chart bounds

### Cursor Modes

The library uses three cursor modes:

- **`explore`** (mobile default): No crosshair, pan/zoom only
- **`default`** (desktop): Crosshair follows mouse directly
- **`aim`** (mobile long-press): Crosshair with relative drag control

### Event Flow

**Initial Activation:**
```
Long-press on mobile
    ↓
Grid.js detects 'press' event
    ↓
Emits cursor-changed with initial crosshair position
    ↓
Chart.vue updates cursor state to 'aim' mode
    ↓
Crosshair.vue renders crosshair at press location
```

**Dragging:**
```
User touches and drags
    ↓
Grid.js detects 'panstart' → stores initial crosshair and touch positions
    ↓
Grid.js detects 'panmove' → calculates drag delta
    ↓
emit_cursor_coord_relative() applies delta to crosshair position
    ↓
Emits cursor-changed with new crosshair position
    ↓
Chart.vue updates cursor state
    ↓
Crosshair.vue renders crosshair at new position
```

**Key Insight:** The crosshair position changes by the drag delta, not by jumping to the touch point. This allows you to touch anywhere on the screen to control the crosshair through relative movement.

## Visual Elements

When in "aim" mode on mobile, the crosshair is displayed:

- **Crosshair Lines** (dashed)
  - Horizontal line across the grid
  - Vertical line across the grid
  - Uses the `colors.cross` theme color
  - Standard dashed line style [5px dash, 5px gap]

## Mobile Detection

The feature automatically activates only on mobile devices. Detection is based on:
- Touch event support
- Orientation change support
- Maximum touch points
- DocumentTouch interface

This is handled automatically by `Utils.is_mobile` in `src/stuff/utils.js`.

## Benefits

1. **Improved Visibility**: Crosshair doesn't hide under your finger
2. **Touch Anywhere**: Control the crosshair from any position on the screen
3. **Precise Control**: See exactly what data point you're selecting
4. **Familiar UX**: Matches TradingView mobile behavior with relative dragging
5. **Flexible Positioning**: Crosshair can be positioned anywhere through relative movement
6. **Clean Interface**: No extra visual clutter - just the crosshair
7. **Non-intrusive**: Only active when you long-press; doesn't interfere with normal pan/zoom

## Browser Compatibility

Works on any mobile device with:
- Touch event support
- HTML5 Canvas support
- Gesture recognition (via Hammer.js)

Tested on:
- iOS Safari
- Android Chrome
- Mobile Firefox
- Progressive Web Apps (PWAs)
