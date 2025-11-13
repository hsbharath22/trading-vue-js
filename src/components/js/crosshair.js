

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

        // Draw mobile control handle and connection line
        this.draw_mobile_handle(ctx)

    }

    draw_mobile_handle(ctx) {
        const cursor = this.$p.cursor
        const config = this.$p.config

        // Only draw handle in 'aim' mode on mobile with handle position
        if (cursor.mode !== 'aim' ||
            cursor.handle_x == null ||
            cursor.handle_y == null) {
            return
        }

        const handle_x = cursor.handle_x
        const handle_y = cursor.handle_y - this.layout.offset
        const handle_r = config.MOBILE_CURSOR_HANDLE_R || 10
        const line_w = config.MOBILE_CURSOR_LINE_W || 1.5

        ctx.save()

        // Draw connection line from handle to crosshair
        ctx.strokeStyle = this.$p.colors.cross
        ctx.lineWidth = line_w
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(handle_x, handle_y)
        ctx.lineTo(this.x, this.y)
        ctx.stroke()

        // Draw control handle (filled circle with border)
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(handle_x, handle_y, handle_r, 0, Math.PI * 2)

        // Fill with semi-transparent background
        ctx.fillStyle = this.$p.colors.back || '#000'
        ctx.globalAlpha = 0.8
        ctx.fill()

        // Draw border
        ctx.globalAlpha = 1
        ctx.strokeStyle = this.$p.colors.cross
        ctx.lineWidth = 2
        ctx.stroke()

        // Draw center dot for better visibility
        ctx.beginPath()
        ctx.arc(handle_x, handle_y, 3, 0, Math.PI * 2)
        ctx.fillStyle = this.$p.colors.cross
        ctx.fill()

        ctx.restore()
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
