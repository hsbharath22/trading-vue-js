// Grid.js listens to various user-generated events,
// emits Vue-events if something has changed (e.g. range)
// Think of it as an I/O system for Grid.vue

import FrameAnimation from '../../stuff/frame.js'
import * as Hammer from 'hammerjs'
import Hamster from 'hamsterjs'
import Utils from '../../stuff/utils.js'
import math from '../../stuff/math.js'

// Grid is good.
export default class Grid {

    constructor(canvas, comp) {

        this.MIN_ZOOM = comp.config.MIN_ZOOM
        this.MAX_ZOOM = comp.config.MAX_ZOOM

        if (Utils.is_mobile) this.MIN_ZOOM *= 0.5

        this.canvas = canvas
        this.ctx = canvas.getContext('2d')
        this.comp = comp
        this.$p = comp.$props
        this.data = this.$p.sub
        this.range = this.$p.range
        this.id = this.$p.grid_id
        this.layout = this.$p.layout.grids[this.id]
        this.interval = this.$p.interval
        this.cursor = comp.$props.cursor
        this.offset_x = 0
        this.offset_y = 0
        this.deltas = 0 // Wheel delta events
        this.wmode = this.$p.config.SCROLL_WHEEL

        this.listeners()
        this.overlays = []

    }

    listeners() {

        this.hm = Hamster(this.canvas)
        this.hm.wheel((event, delta) => this.mousezoom(-delta * 50, event))

        let mc = this.mc = new Hammer.Manager(this.canvas)
        let T = Utils.is_mobile ? 10 : 0
        mc.add(new Hammer.Pan({ threshold: T}))
        mc.add(new Hammer.Tap())
        mc.add(new Hammer.Pinch({ threshold: 0}))
        mc.get('pinch').set({ enable: true })
        if (Utils.is_mobile) mc.add(new Hammer.Press())

        mc.on('panstart', event => {
            if (this.cursor.scroll_lock) return
            if (this.cursor.mode === 'aim') {
                // Store initial crosshair and touch positions for relative dragging
                // Only store if we have valid cursor position (not NaN or null)
                if (this.cursor.x != null && !isNaN(this.cursor.x) &&
                    this.cursor.y != null && !isNaN(this.cursor.y)) {
                    this.aim_drag = {
                        start_touch_x: event.center.x + this.offset_x,
                        start_touch_y: event.center.y + this.offset_y,
                        start_cross_x: this.cursor.x,
                        start_cross_y: this.cursor.y
                    }
                    console.log('[PANSTART] Stored aim_drag state:', this.aim_drag)
                } else {
                    console.log('[PANSTART] Skipping aim_drag - invalid cursor position:', this.cursor.x, this.cursor.y)
                }
                return
            }
            let tfrm = this.$p.y_transform
            this.drug = {
                x: event.center.x + this.offset_x,
                y: event.center.y + this.offset_y,
                r: this.range.slice(),
                t: this.range[1] - this.range[0],
                o: tfrm ?
                    (tfrm.offset || 0) : 0,
                y_r: tfrm && tfrm.range ?
                    tfrm.range.slice() : undefined,
                B: this.layout.B,
                t0: Utils.now()
            }
            this.comp.$emit('cursor-changed', {
                grid_id: this.id,
                x: event.center.x + this.offset_x,
                y: event.center.y + this.offset_y
            })
            this.comp.$emit('cursor-locked', true)
        })

        mc.on('panmove', event => {
            if (Utils.is_mobile) {
                this.calc_offset()
                this.propagate('mousemove', this.touch2mouse(event))
            }
            if (this.drug) {
                this.mousedrag(
                    this.drug.x + event.deltaX,
                    this.drug.y + event.deltaY,
                )
                this.comp.$emit('cursor-changed', {
                    grid_id: this.id,
                    x: event.center.x + this.offset_x,
                    y: event.center.y + this.offset_y
                })
            } else if (this.cursor.mode === 'aim' && this.aim_drag) {
                // Relative dragging: move crosshair by touch delta
                const current_touch_x = event.center.x + this.offset_x
                const current_touch_y = event.center.y + this.offset_y

                const delta_x = current_touch_x - this.aim_drag.start_touch_x
                const delta_y = current_touch_y - this.aim_drag.start_touch_y

                const new_cross_x = this.aim_drag.start_cross_x + delta_x
                const new_cross_y = this.aim_drag.start_cross_y + delta_y

                // Validate - don't emit if positions are NaN
                if (isNaN(new_cross_x) || isNaN(new_cross_y)) {
                    console.log('[PANMOVE] Skipping - NaN crosshair position')
                    return
                }

                // Clamp crosshair position within bounds
                const clamped_x = Math.max(0, Math.min(this.layout.width, new_cross_x))
                const clamped_y = Math.max(0, Math.min(this.layout.height + this.layout.offset, new_cross_y))

                // Build event object with cursor position
                const cursorEvent = {
                    mode: 'aim',  // Explicitly maintain aim mode
                    grid_id: this.id,
                    x: clamped_x,
                    y: clamped_y,
                    handle_x: current_touch_x,
                    handle_y: current_touch_y
                }

                // If measuring, also include m_p2 in the SAME event
                if (this.cursor.measuring) {
                    const layout = this.$p.layout.grids[this.id]
                    const t = layout.screen2t(new_cross_x)
                    const y$ = layout.screen2$(new_cross_y)
                    cursorEvent.m_p2 = [t, y$]
                }

                // Single emission with all data
                this.comp.$emit('cursor-changed', cursorEvent)
            }
        })

        mc.on('panend', event => {
            if (Utils.is_mobile && this.drug) {
                this.pan_fade(event)
            }

            // Track when pan ends during measurement to prevent accidental tap detection
            if (this.cursor.mode === 'aim' && this.cursor.measuring && this.aim_drag) {
                this.measurement_panend_timestamp = Utils.now()
                console.log('[PANEND] During measurement - blocking tap for 300ms')
            }

            this.drug = null
            this.aim_drag = null
            this.comp.$emit('cursor-locked', false)
        })

        mc.on('tap', event => {
            if (!Utils.is_mobile) return

            console.log('========== TAP EVENT START [Grid ' + this.id + '] ==========')

            // Refresh cursor reference to ensure we have latest value
            this.cursor = this.comp.$props.cursor

            console.log('[TAP] Grid ID:', this.id)
            console.log('[TAP] cursor object:', this.cursor)
            console.log('[TAP] mode:', this.cursor?.mode, 'measuring:', this.cursor?.measuring)
            console.log('[TAP] press_timestamp:', this.press_timestamp, 'time_since_press:', this.press_timestamp ? (Utils.now() - this.press_timestamp) : 'N/A')

            // If in aim mode, handle measurement
            if (this.cursor && this.cursor.mode === 'aim') {
                console.log('[TAP] ✓ Entered aim mode block')

                // Ignore tap immediately after press when not measuring (prevent exit on finger lift)
                if (!this.cursor.measuring && this.press_timestamp &&
                    (Utils.now() - this.press_timestamp < 500)) {
                    console.log('[TAP] ✗ Blocked - too soon after press (within 500ms)')
                    return
                }

                // Ignore tap immediately after panend when measuring (finger lift after drag)
                if (this.cursor.measuring && this.measurement_panend_timestamp &&
                    (Utils.now() - this.measurement_panend_timestamp < 300)) {
                    console.log('[TAP] ✗ Blocked - finger lift after drag (within 300ms of panend)')
                    return
                }

                this.calc_offset()
                const layout = this.$p.layout.grids[this.id]

                if (!this.cursor.measuring) {
                    console.log('[TAP] ✓ Starting measurement')
                    console.log('[TAP] Current cursor position:', this.cursor.x, this.cursor.y)

                    // Use current crosshair screen position
                    // If cursor position is invalid, skip measurement
                    if (this.cursor.x == null || isNaN(this.cursor.x) ||
                        this.cursor.y == null || isNaN(this.cursor.y)) {
                        console.log('[TAP] ✗ Cannot start measurement - invalid cursor position')
                        return
                    }

                    // Clear panend timestamp when starting new measurement
                    this.measurement_panend_timestamp = null

                    const t = layout.screen2t(this.cursor.x)
                    const y$ = layout.screen2$(this.cursor.y - this.layout.offset)

                    this.comp.$emit('cursor-changed', {
                        mode: 'aim',
                        x: this.cursor.x,      // Maintain cursor position
                        y: this.cursor.y,
                        handle_x: this.cursor.handle_x,
                        handle_y: this.cursor.handle_y,
                        measuring: true,
                        m_p1: [t, y$],
                        m_p2: [t, y$]
                    })
                    console.log('[TAP] ✓ Emitted cursor-changed with mode=aim, measuring=true, x:', this.cursor.x, 'y:', this.cursor.y)
                } else {
                    console.log('[TAP] ✓ Finishing measurement')

                    // Use current crosshair screen position
                    if (this.cursor.x == null || isNaN(this.cursor.x) ||
                        this.cursor.y == null || isNaN(this.cursor.y)) {
                        console.log('[TAP] ✗ Cannot finish measurement - invalid cursor position')
                        return
                    }

                    // Clear panend timestamp when finishing measurement
                    this.measurement_panend_timestamp = null

                    const t = layout.screen2t(this.cursor.x)
                    const y$ = layout.screen2$(this.cursor.y - this.layout.offset)

                    this.comp.$emit('cursor-changed', {
                        mode: 'aim',
                        x: this.cursor.x,      // Maintain cursor position
                        y: this.cursor.y,
                        handle_x: this.cursor.handle_x,
                        handle_y: this.cursor.handle_y,
                        m_p2: [t, y$]
                    })
                    // Keep measuring active to show the result
                    // User must long-press to exit and clear
                }
                this.update()
                console.log('[TAP] ✓ Done handling in aim mode, returning')
                // Prevent event from propagating to other handlers
                if (event.srcEvent) event.srcEvent.stopPropagation()
                event.preventDefault()
                return
            }

            console.log('[TAP] ✗ NOT in aim mode - executing default explore mode behavior')
            console.log('[TAP] ✗ cursor.mode is:', this.cursor?.mode)
            // Default tap behavior for explore mode
            this.sim_mousedown(event)
            if (this.fade) this.fade.stop()
            this.comp.$emit('cursor-changed', {})
            this.update()
            console.log('========== TAP EVENT END [Grid ' + this.id + '] ==========')
        })

        mc.on('pinchstart', () =>  {
            this.drug = null
            this.pinch = {
                t: this.range[1] - this.range[0],
                r: this.range.slice()
            }
        })

        mc.on('pinchend', () =>  {
            this.pinch = null
        })

        mc.on('pinch', event => {
            if (this.pinch) this.pinchzoom(event.scale)
        })

        mc.on('press', event => {
            if (!Utils.is_mobile) return
            if (this.fade) this.fade.stop()
            this.calc_offset()

            // Track press timestamp to prevent immediate tap trigger
            this.press_timestamp = Utils.now()
            console.log('[PRESS] Grid ID:', this.id, 'timestamp:', this.press_timestamp)
            console.log('[PRESS] Current mode:', this.cursor.mode, 'measuring:', this.cursor.measuring)

            // If already in aim mode with active measurement, exit aim mode
            if (this.cursor.mode === 'aim' && this.cursor.measuring) {
                console.log('[PRESS] ✓ Exiting aim mode (was measuring)')
                this.comp.$emit('cursor-changed', {
                    mode: 'explore',
                    handle_x: null,
                    handle_y: null,
                    measuring: false,
                    m_p1: null,
                    m_p2: null
                })
                this.update()
                return
            }

            // If in aim mode but not measuring, ignore (don't exit)
            if (this.cursor.mode === 'aim') {
                console.log('[PRESS] ✓ Already in aim mode, not measuring - ignoring')
                return
            }

            // Initialize crosshair at press location (enter aim mode)
            const touch_x = event.center.x + this.offset_x
            const touch_y = event.center.y + this.offset_y + this.layout.offset

            console.log('[PRESS] ✓ Entering aim mode at position:', touch_x, touch_y)
            this.comp.$emit('cursor-changed', {
                grid_id: this.id,
                x: touch_x,
                y: touch_y,
                handle_x: touch_x,
                handle_y: touch_y,
                mode: 'aim',
                measuring: false,
                m_p1: null,
                m_p2: null
            })
            console.log('[PRESS] ✓ Emitted cursor-changed with mode=aim')

            setTimeout(() => this.update())
            // Don't call sim_mousedown when entering aim mode - it interferes with cursor position
            // this.sim_mousedown(event)
        })

        let add = addEventListener
        add("gesturestart", this.gesturestart)
        add("gesturechange", this.gesturechange)
        add("gestureend", this.gestureend)

    }

    gesturestart(event) { event.preventDefault() }
    gesturechange(event) { event.preventDefault() }
    gestureend(event) { event.preventDefault() }

    mousemove(event) {
        if (Utils.is_mobile) return
        this.comp.$emit('cursor-changed', {
            grid_id: this.id,
            x: event.layerX,
            y: event.layerY + this.layout.offset
        })
        this.calc_offset()
        this.propagate('mousemove', event)
    }

    mouseout(event) {
        if (Utils.is_mobile) return
        this.comp.$emit('cursor-changed', {})
        this.propagate('mouseout', event)
    }

    mouseup(event) {
        this.drug = null
        this.comp.$emit('cursor-locked', false)
        this.propagate('mouseup', event)
    }

    mousedown(event) {
        if (Utils.is_mobile) return
        this.propagate('mousedown', event)
        this.comp.$emit('cursor-locked', true)
        if (event.defaultPrevented) return
        this.comp.$emit('custom-event', {
            event: 'grid-mousedown', args: [this.id, event]
        })
    }

    // Simulated mousedown (for mobile)
    sim_mousedown(event) {
        if (event.srcEvent.defaultPrevented) return
        this.comp.$emit('custom-event', {
            event: 'grid-mousedown',
            args: [this.id, event]
        })
        this.propagate('mousemove', this.touch2mouse(event))
        this.update()
        this.propagate('mousedown', this.touch2mouse(event))
        setTimeout(() => {
            this.propagate('click', this.touch2mouse(event))
        })
    }

    // Convert touch to "mouse" event
    touch2mouse(e) {
        this.calc_offset()
        return {
            original: e.srcEvent,
            layerX: e.center.x + this.offset_x,
            layerY: e.center.y + this.offset_y,
            preventDefault: function() {
                this.original.preventDefault()
            }
        }
    }

    click(event) {
        this.propagate('click', event)
    }

    emit_cursor_coord(event, add = {}) {
        // Desktop or explore mode - direct position
        this.comp.$emit('cursor-changed', Object.assign({
            grid_id: this.id,
            x: event.center.x + this.offset_x,
            y: event.center.y + this.offset_y + this.layout.offset
        }, add))
    }

    // Emit cursor coordinates with relative control (mobile aim mode)
    emit_cursor_coord_relative(handle_x, handle_y, cross_x, cross_y) {
        // Validate inputs - don't emit NaN values
        if (isNaN(cross_x) || isNaN(cross_y)) {
            console.log('[emit_cursor_coord_relative] Skipping emit - NaN values:', cross_x, cross_y)
            return
        }

        // Clamp crosshair position within bounds
        const clamped_x = Math.max(0, Math.min(
            this.layout.width,
            cross_x
        ))
        const clamped_y = Math.max(0, Math.min(
            this.layout.height + this.layout.offset,
            cross_y
        ))

        this.comp.$emit('cursor-changed', {
            grid_id: this.id,
            x: clamped_x,
            y: clamped_y,
            handle_x: handle_x,
            handle_y: handle_y
        })
    }

    pan_fade(event) {
        let dt = Utils.now() - this.drug.t0
        let dx = this.range[1] - this.drug.r[1]
        let v = 42 * dx / dt
        let v0 = Math.abs(v * 0.01)
        if (dt > 500) return
        if (this.fade) this.fade.stop()
        this.fade = new FrameAnimation(self => {
            v *= 0.85
            if (Math.abs(v) < v0) {
                self.stop()
            }
            this.range[0] += v
            this.range[1] += v
            this.change_range()
        })
    }

    calc_offset() {
        let rect = this.canvas.getBoundingClientRect()
        this.offset_x = -rect.x
        this.offset_y = -rect.y
    }

    new_layer(layer) {
        if (layer.name === 'crosshair') {
            this.crosshair = layer
        } else {
            this.overlays.push(layer)
        }
        this.update()
    }

    del_layer(id) {
        this.overlays = this.overlays.filter(x => x.id !== id)
        this.update()
    }

    show_hide_layer(event) {
        let l = this.overlays.filter(x => x.id === event.id)
        if (l.length) l[0].display = event.display
    }

    update() {
        // Update reference to the grid
        // TODO: check what happens if data changes interval
        this.layout = this.$p.layout.grids[this.id]
        this.interval = this.$p.interval

        if (!this.layout) return

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        if (this.$p.shaders.length) this.apply_shaders()

        this.grid()

        let overlays = []
        overlays.push(...this.overlays)

        // z-index sorting
        overlays.sort((l1, l2) => l1.z - l2.z)

        overlays.forEach(l => {
            if (!l.display) return
            this.ctx.save()
            let r = l.renderer
            if (r.pre_draw) r.pre_draw(this.ctx)
            r.draw(this.ctx)
            if (r.post_draw) r.post_draw(this.ctx)
            this.ctx.restore()
        })

        if (this.crosshair) {
            this.crosshair.renderer.draw(this.ctx)
        }
    }

    apply_shaders() {
        let layout = this.$p.layout.grids[this.id]
        let props = {
            layout: layout,
            range: this.range,
            interval: this.interval,
            tf: layout.ti_map.tf,
            cursor: this.cursor,
            colors: this.$p.colors,
            sub: this.data,
            font: this.$p.font,
            config: this.$p.config,
            meta: this.$p.meta
        }
        for (var s of this.$p.shaders) {
            this.ctx.save()
            s.draw(this.ctx, props)
            this.ctx.restore()
        }
    }

    // Actually draws the grid (for real)
    grid() {

        this.ctx.strokeStyle = this.$p.colors.grid
        this.ctx.beginPath()

        const ymax = this.layout.height
        for (var [x, p] of this.layout.xs) {

            this.ctx.moveTo(x - 0.5, 0)
            this.ctx.lineTo(x - 0.5, ymax)

        }

        for (var [y, y$] of this.layout.ys) {

            this.ctx.moveTo(0, y - 0.5)
            this.ctx.lineTo(this.layout.width, y - 0.5)

        }

        this.ctx.stroke()

        if (this.$p.grid_id) this.upper_border()

    }

    upper_border() {
        this.ctx.strokeStyle = this.$p.colors.scale
        this.ctx.beginPath()
        this.ctx.moveTo(0, 0.5)
        this.ctx.lineTo(this.layout.width, 0.5)
        this.ctx.stroke()
    }

    mousezoom(delta, event) {

        // TODO: for mobile
        if (this.wmode !== 'pass') {
            if (this.wmode === 'click' && !this.$p.meta.activated) {
                return
            }
            event.originalEvent.preventDefault()
            event.preventDefault()
        }

        event.deltaX = event.deltaX || Utils.get_deltaX(event)
        event.deltaY = event.deltaY || Utils.get_deltaY(event)

        if (Math.abs(event.deltaX) > 0) {
            this.trackpad = true
            if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
                delta *= 0.1
            }
            this.trackpad_scroll(event)
        }

        if (this.trackpad) delta *= 0.032

        delta = Utils.smart_wheel(delta)

        // TODO: mouse zooming is a little jerky,
        // needs to follow f(mouse_wheel_speed) and
        // if speed is low, scroll shoud be slower
        if (delta < 0 && this.data.length <= this.MIN_ZOOM) return
        if (delta > 0 && this.data.length > this.MAX_ZOOM) return
        let k = this.interval / 1000
        let diff = delta * k * this.data.length
        let tl = this.comp.config.ZOOM_MODE === 'tl'
        if (event.originalEvent.ctrlKey || tl) {
            let offset = event.originalEvent.offsetX
            let diff1 = offset / (this.canvas.width-1) * diff
            let diff2 = diff - diff1
            this.range[0] -= diff1
            this.range[1] += diff2
        } else {
            this.range[0] -= diff
        }

        if (tl) {
            let offset = event.originalEvent.offsetY
            let diff1 = offset / (this.canvas.height-1) * 2
            let diff2 = 2 - diff1
            let z = diff / (this.range[1] - this.range[0])
            //rezoom_range(z, diff_x, diff_y)
            this.comp.$emit('rezoom-range', {
                grid_id: this.id, z, diff1, diff2
            })
        }

        this.change_range()

    }

    mousedrag(x, y) {

        let dt = this.drug.t * (this.drug.x - x) / this.layout.width

        let d$ = this.layout.$_hi - this.layout.$_lo
        d$ *= (this.drug.y - y) / this.layout.height
        let offset = this.drug.o + d$

        let ls = this.layout.grid.logScale

        if (ls && this.drug.y_r) {
            let dy = this.drug.y - y
            var range = this.drug.y_r.slice()
            range[0] = math.exp((0 - this.drug.B + dy) /
                this.layout.A)
            range[1] = math.exp(
                (this.layout.height - this.drug.B + dy) /
                this.layout.A)
        }

        if (this.drug.y_r && this.$p.y_transform &&
            !this.$p.y_transform.auto) {
            this.comp.$emit('sidebar-transform', {
                grid_id: this.id,
                range: ls ? (range || this.drug.y_r) : [
                    this.drug.y_r[0] - offset,
                    this.drug.y_r[1] - offset,
                ]
            })
        }

        this.range[0] = this.drug.r[0] + dt
        this.range[1] = this.drug.r[1] + dt

        this.change_range()

    }

    pinchzoom(scale) {

        if (scale > 1 && this.data.length <= this.MIN_ZOOM) return
        if (scale < 1 && this.data.length > this.MAX_ZOOM) return

        let t = this.pinch.t
        let nt = t * 1 / scale

        this.range[0] = this.pinch.r[0] - (nt - t) * 0.5
        this.range[1] = this.pinch.r[1] + (nt - t) * 0.5

        this.change_range()

    }

    trackpad_scroll(event) {

        let dt = this.range[1] - this.range[0]

        this.range[0] += event.deltaX * dt * 0.011
        this.range[1] += event.deltaX * dt * 0.011

        this.change_range()


    }

    change_range() {

        // TODO: better way to limit the view. Problem:
        // when you are at the dead end of the data,
        // and keep scrolling,
        // the chart continues to scale down a little.
        // Solution: I don't know yet

        if (!this.range.length || this.data.length < 2) return

        let l = this.data.length - 1
        let data = this.data
        let range = this.range

        range[0] = Utils.clamp(
            range[0],
            -Infinity, data[l][0] - this.interval * 5.5,
        )

        range[1] = Utils.clamp(
            range[1],
            data[0][0] + this.interval * 5.5, Infinity
        )

        // TODO: IMPORTANT scrolling is jerky The Problem caused
        // by the long round trip of 'range-changed' event.
        // First it propagates up to update layout in Chart.vue,
        // then it moves back as watch() update. It takes 1-5 ms.
        // And because the delay is different each time we see
        // the lag. No smooth movement and it's annoying.
        // Solution: we could try to calc the layout immediatly
        // somewhere here. Still will hurt the sidebar & bottombar
        this.comp.$emit('range-changed', range)
    }

    // Propagate mouse event to overlays
    propagate(name, event) {
        for (var layer of this.overlays) {
            if (layer.renderer[name]) {
                layer.renderer[name](event)
            }
            const mouse = layer.renderer.mouse
            const keys = layer.renderer.keys
            if (mouse.listeners) {
                mouse.emit(name, event)
            }
            if (keys && keys.listeners) {
                keys.emit(name, event)
            }
        }
    }

    destroy() {
        let rm = removeEventListener
        rm("gesturestart", this.gesturestart)
        rm("gesturechange", this.gesturechange)
        rm("gestureend", this.gestureend)
        if (this.mc) this.mc.destroy()
        if (this.hm) this.hm.unwheel()
    }
}
