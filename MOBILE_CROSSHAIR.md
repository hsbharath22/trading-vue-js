# Mobile Crosshair Control

This document explains the mobile-friendly crosshair control feature implemented in TradingVue.js.

## Overview

On mobile devices, the standard crosshair behavior of appearing exactly under your finger obscures the data you're trying to see. This feature implements a relative control system similar to TradingView's mobile version, where:

1. **Control Handle**: A draggable circle appears at your touch point
2. **Independent Crosshair**: The crosshair can be positioned anywhere on the chart
3. **Connection Line**: A dashed line connects the handle to the crosshair for visual clarity
4. **Relative Dragging**: Touch anywhere on the screen to control the crosshair - it moves relative to your drag motion

## How It Works

### Activation

On mobile devices:
- **Long-press** (press and hold) anywhere on the chart to activate "aim" mode
- The crosshair appears at the long-press location
- A control handle (circle) also appears at the same location
- A dashed connection line links the handle to the crosshair

### Deactivation

- **Tap** anywhere on the chart to exit "aim" mode and return to "explore" mode
- The crosshair and handle disappear

### While Active

- **Touch anywhere** on the screen to start dragging
- The crosshair moves by the **same amount** as your finger movement (relative control)
- The handle always shows your current touch position
- You can lift your finger and touch elsewhere to continue controlling the crosshair
- The crosshair position is clamped within chart bounds
- **You don't have to touch the crosshair itself** - control it from anywhere on the screen!

## Configuration

You can customize the visual styling of the mobile crosshair via the chart configuration:

```javascript
const chartConfig = {
  // Visual styling
  MOBILE_CURSOR_HANDLE_R: 10,    // Handle radius in px, default: 10
  MOBILE_CURSOR_LINE_W: 1.5,     // Connection line width, default: 1.5
}
```

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `MOBILE_CURSOR_HANDLE_R` | number | 10 | Radius of the control handle circle in pixels |
| `MOBILE_CURSOR_LINE_W` | number | 1.5 | Width of the connection line in pixels |

**Note:** The older `MOBILE_CURSOR_OFFSET_X` and `MOBILE_CURSOR_OFFSET_Y` parameters are deprecated and no longer used in the relative control mode.

## Usage Example

```vue
<template>
  <trading-vue
    :data="chart"
    :width="width"
    :height="height"
    :config="config"
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
      height: window.innerHeight,
      config: {
        // Customize mobile crosshair styling
        MOBILE_CURSOR_HANDLE_R: 12,
        MOBILE_CURSOR_LINE_W: 2
      }
    }
  }
}
</script>
```

## Implementation Details

### Files Modified

1. **src/stuff/constants.js**
   - Added configuration constants for mobile crosshair styling

2. **src/components/Chart.vue**
   - Extended cursor state to track handle position (`handle_x`, `handle_y`)

3. **src/components/js/grid.js**
   - Added `emit_cursor_coord_relative()` method for relative positioning
   - Modified `panstart` handler to track initial crosshair and touch positions
   - Updated `panmove` handler to calculate drag deltas and apply relative movement
   - Updated `panend` handler to clear drag tracking state
   - Modified `press` handler to initialize crosshair at press location
   - Updated tap handler to clear handle position when exiting aim mode
   - Added automatic clamping to keep crosshair within chart bounds

4. **src/components/js/crosshair.js**
   - Added `draw_mobile_handle()` method to render the control handle
   - Draws connection line between handle and crosshair
   - Draws filled circle with border for the handle
   - Draws center dot for better visibility

### Cursor Modes

The library uses three cursor modes:

- **`explore`** (mobile default): No crosshair, pan/zoom only
- **`default`** (desktop): Crosshair follows mouse directly
- **`aim`** (mobile long-press): Crosshair with offset control handle

### Event Flow

**Initial Activation:**
```
Long-press on mobile
    ↓
Grid.js detects 'press' event
    ↓
Emits cursor-changed with initial position (crosshair = handle)
    ↓
Chart.vue updates cursor state to 'aim' mode
    ↓
Crosshair.vue renders crosshair + handle at same location
```

**Dragging:**
```
User touches and drags
    ↓
Grid.js detects 'panstart' → stores initial positions
    ↓
Grid.js detects 'panmove' → calculates drag delta
    ↓
emit_cursor_coord_relative() applies delta to crosshair
    ↓
Emits cursor-changed with new crosshair position and current handle position
    ↓
Chart.vue updates cursor state
    ↓
Crosshair.vue renders crosshair at new position, handle at touch point
```

**Key Insight:** The crosshair position changes by the drag delta, not by jumping to an offset from the touch point. This allows you to touch anywhere on the screen to control the crosshair.

## Visual Elements

When in "aim" mode on mobile, the following elements are drawn:

1. **Crosshair Lines** (dashed, at offset position)
   - Horizontal line across the grid
   - Vertical line across the grid
   - Uses the `colors.cross` theme color

2. **Connection Line** (dashed)
   - Links the handle to the crosshair intersection
   - 3px dash, 3px gap pattern
   - Same color as crosshair

3. **Control Handle** (at touch point)
   - Outer circle with 2px border
   - Semi-transparent dark background (80% opacity)
   - Small center dot (3px radius) for precision
   - Uses `colors.cross` for border and dot
   - Uses `colors.back` for fill background

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
5. **Flexible Positioning**: Crosshair can be anywhere, not limited by fixed offsets
6. **Configurable**: Adjust styling to your needs
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
