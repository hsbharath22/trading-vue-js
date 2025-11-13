# Mobile Crosshair Control

This document explains the mobile-friendly crosshair control feature implemented in TradingVue.js.

## Overview

On mobile devices, the standard crosshair behavior of appearing exactly under your finger obscures the data you're trying to see. This feature implements an offset control handle similar to TradingView's mobile version, where:

1. **Control Handle**: A draggable circle appears at your touch point
2. **Offset Crosshair**: The actual crosshair appears at an offset position above and to the left of your finger
3. **Connection Line**: A dashed line connects the handle to the crosshair for visual clarity
4. **Smooth Dragging**: Move your finger and both the handle and crosshair move together

## How It Works

### Activation

On mobile devices:
- **Long-press** (press and hold) anywhere on the chart to activate "aim" mode
- The crosshair appears at an offset position from your touch point
- A control handle (circle) appears at your touch location
- A dashed connection line links the handle to the crosshair

### Deactivation

- **Tap** anywhere on the chart to exit "aim" mode and return to "explore" mode
- The crosshair and handle disappear

### While Active

- **Drag** your finger to move both the handle and crosshair together
- The crosshair maintains the same offset relative to your touch point
- The crosshair position is clamped within chart bounds

## Configuration

You can customize the mobile crosshair behavior via the chart configuration:

```javascript
const chartConfig = {
  // Distance crosshair appears from touch point (negative = left/up)
  MOBILE_CURSOR_OFFSET_X: -50,   // px, default: -50
  MOBILE_CURSOR_OFFSET_Y: -120,  // px, default: -120

  // Visual styling
  MOBILE_CURSOR_HANDLE_R: 10,    // Handle radius in px, default: 10
  MOBILE_CURSOR_LINE_W: 1.5,     // Connection line width, default: 1.5
}
```

### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `MOBILE_CURSOR_OFFSET_X` | number | -50 | Horizontal offset in pixels. Negative values move crosshair left of touch point |
| `MOBILE_CURSOR_OFFSET_Y` | number | -120 | Vertical offset in pixels. Negative values move crosshair above touch point |
| `MOBILE_CURSOR_HANDLE_R` | number | 10 | Radius of the control handle circle in pixels |
| `MOBILE_CURSOR_LINE_W` | number | 1.5 | Width of the connection line in pixels |

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
        // Customize mobile crosshair behavior
        MOBILE_CURSOR_OFFSET_X: -60,
        MOBILE_CURSOR_OFFSET_Y: -100,
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
   - Added configuration constants for mobile crosshair offset and styling

2. **src/components/Chart.vue**
   - Extended cursor state to track handle position (`handle_x`, `handle_y`)

3. **src/components/js/grid.js**
   - Modified `emit_cursor_coord()` to calculate offset positions on mobile
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

```
Long-press on mobile
    ↓
Grid.js detects 'press' event
    ↓
emit_cursor_coord() calculates offset positions
    ↓
Emits cursor-changed with x, y, handle_x, handle_y
    ↓
Chart.vue updates cursor state
    ↓
Crosshair.vue renders crosshair + handle
```

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
2. **Precise Control**: See exactly what data point you're selecting
3. **Familiar UX**: Matches TradingView mobile behavior
4. **Configurable**: Adjust offset and styling to your needs
5. **Non-intrusive**: Only active when you long-press; doesn't interfere with normal pan/zoom

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
