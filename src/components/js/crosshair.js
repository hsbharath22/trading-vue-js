

export default class Crosshair {

    constructor(comp) {

        this.comp = comp
        this.$p = comp.$props
        this.data = this.$p.sub
        this._visible = false
        this.locked = false
        this.layout = this.$p.layout

    }

    draw(ctx) {
        // Update reference to the grid
        this.layout = this.$p.layout

        const cursor = this.comp.$props.cursor
        if (!this.visible && cursor.mode === 'explore') return

        this.x = this.$p.cursor.x
        this.y = this.$p.cursor.y

        ctx.save()
        ctx.strokeStyle = this.$p.colors.cross
        ctx.beginPath()
        ctx.setLineDash([5])

        // H
        if (this.$p.cursor.grid_id === this.layout.id) {
            ctx.moveTo(0, this.y)
            ctx.lineTo(this.layout.width - 0.5, this.y)
        }

        // V
        ctx.moveTo(this.x, 0)
        ctx.lineTo(this.x, this.layout.height)
        ctx.stroke()
        ctx.restore()

        // Draw mobile measurement if active
        this.draw_measurement(ctx)

    }

    draw_measurement(ctx) {
        const cursor = this.$p.cursor

        // Draw measurement box when we have both points (whether actively measuring or finalized)
        if (!cursor.m_p1 || !cursor.m_p2) return

        const layout = this.$p.layout
        const colors = this.$p.colors

        // Convert points to screen coordinates
        const x1 = layout.t2screen(cursor.m_p1[0])
        const y1 = layout.$2screen(cursor.m_p1[1])
        const x2 = layout.t2screen(cursor.m_p2[0])
        const y2 = layout.$2screen(cursor.m_p2[1])

        ctx.save()

        // Draw measurement box background
        ctx.fillStyle = colors.cross + '16'  // Semi-transparent
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1)

        // Draw measurement box border
        ctx.strokeStyle = colors.cross
        ctx.lineWidth = 1
        ctx.setLineDash([])
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

        // Calculate center for dashed lines
        const xm = (x1 + x2) / 2
        const ym = (y1 + y2) / 2

        // Draw vertical dashed line
        ctx.beginPath()
        ctx.setLineDash([5, 5])
        ctx.moveTo(xm, y1)
        ctx.lineTo(xm, y2)
        ctx.stroke()

        // Draw horizontal dashed line
        ctx.beginPath()
        ctx.moveTo(x1, ym)
        ctx.lineTo(x2, ym)
        ctx.stroke()

        // Draw measurement values
        this.draw_measurement_values(ctx, cursor, layout, colors, x1, y1, x2, y2, xm)

        ctx.restore()
    }

    draw_measurement_values(ctx, cursor, layout, colors, x1, y1, x2, y2, xm) {
        // Calculate deltas
        const d$ = cursor.m_p2[1] - cursor.m_p1[1]
        const p = (100 * (cursor.m_p2[1] / cursor.m_p1[1] - 1)).toFixed(2)

        // Time delta
        const dt = cursor.m_p2[0] - cursor.m_p1[0]
        const dtStr = this.format_time_delta(dt)

        // Format text
        const priceText = `${d$.toFixed(2)} (${p}%)`
        const timeText = dtStr

        // Setup text style
        ctx.font = this.$p.font
        ctx.textAlign = 'center'
        ctx.fillStyle = colors.text

        // Calculate text dimensions
        const lines = [priceText, timeText]
        const lineHeight = 18

        // Position text outside (below) the measurement box
        const bottomY = Math.max(y1, y2)
        const textStartY = bottomY + 15  // 15px padding below the box

        // Draw text directly without background
        ctx.globalAlpha = 1
        ctx.fillStyle = colors.text
        lines.forEach((line, i) => {
            ctx.fillText(line, xm, textStartY + lineHeight * i)
        })
    }

    format_time_delta(dt) {
        const sign = dt < 0 ? '-' : ''
        const abs = Math.abs(dt)

        const second = 1000
        const minute = second * 60
        const hour = minute * 60
        const day = hour * 24

        if (abs < minute) {
            return `${sign}${Math.floor(abs / second)}s`
        } else if (abs < hour) {
            return `${sign}${Math.floor(abs / minute)}m`
        } else if (abs < day) {
            const h = Math.floor(abs / hour)
            const m = Math.floor((abs % hour) / minute)
            return m > 0 ? `${sign}${h}h ${m}m` : `${sign}${h}h`
        } else {
            const d = Math.floor(abs / day)
            const h = Math.floor((abs % day) / hour)
            return h > 0 ? `${sign}${d}d ${h}h` : `${sign}${d}d`
        }
    }

    hide() {
        this.visible = false
        this.x = undefined
        this.y = undefined
    }

    get visible() {
        return this._visible
    }

    set visible(val) {
        this._visible = val
    }

}
