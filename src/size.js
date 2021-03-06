c3_chart_internal_fn.getCurrentWidth = function C3_INTERNAL_getCurrentWidth() {
    var $$ = this, 
        config = $$.config;
    return config.size_width ? config.size_width : $$.getParentWidth();
};
c3_chart_internal_fn.getCurrentHeight = function C3_INTERNAL_getCurrentHeight() {
    var $$ = this, 
        config = $$.config,
        h = config.size_height ? config.size_height : $$.getParentHeight();
    return h > 0 ? h : 320 / ($$.hasType('gauge') && !config.gauge_fullCircle ? 2 : 1); 
};
c3_chart_internal_fn.getCurrentPaddingTop = function C3_INTERNAL_getCurrentPaddingTop() {
    var $$ = this,
        config = $$.config,
        padding = isValue(config.padding_top) ? config.padding_top : 0;
    if ($$.config.header_show) {
        padding += $$.config.header_height;
    }
    if ($$.title && $$.title.node() && $$.config.title_position.indexOf('bottom') === -1) {
        padding += $$.getTitlePadding();
    }
    return padding;
};
c3_chart_internal_fn.getCurrentPaddingBottom = function C3_INTERNAL_getCurrentPaddingBottom() {
    var $$ = this,
        config = this.config,
        padding = isValue(config.padding_bottom) ? config.padding_bottom : 0;
    if ($$.config.footer_show) {
        padding += $$.config.footer_height;
    }
    if ($$.title && $$.title.node() && $$.config.title_position.indexOf('bottom') !== -1) {
        padding += $$.getTitlePadding();
    }
    return padding;
};
c3_chart_internal_fn.getCurrentPaddingLeft = function C3_INTERNAL_getCurrentPaddingLeft(withoutRecompute) {
    var $$ = this, 
        config = $$.config;
    if (isValue(config.padding_left)) {
        return config.padding_left;
    } else if (config.axis_rotated) {
        return !config.axis_x_show ? 1 : Math.max(ceil10($$.getAxisWidthByAxisId('x', withoutRecompute)), 40);
    } else if (!config.axis_y_show || config.axis_y_inner) { // && !config.axis_rotated
        return $$.axis.getYAxisLabelPosition().isOuter ? 30 : 1;
    } else {
        return Math.ceil($$.getAxisWidthByAxisId('y', withoutRecompute));
    }
};
c3_chart_internal_fn.getCurrentPaddingRight = function C3_INTERNAL_getCurrentPaddingRight() {
    var $$ = this, 
        config = $$.config,
        defaultPadding = 10, 
        legendWidthOnRight = $$.isLegendRight ? $$.getLegendWidth() + 20 : 0;
    if (isValue(config.padding_right)) {
        return config.padding_right + 1; // 1 is needed not to hide tick line
    } else if (config.axis_rotated) {
        return defaultPadding + legendWidthOnRight;
    } else if (!config.axis_y2_show || config.axis_y2_inner) { // && !config.axis_rotated
        return 2 + legendWidthOnRight + ($$.axis.getY2AxisLabelPosition().isOuter ? 20 : 0);
    } else {
        return Math.ceil($$.getAxisWidthByAxisId('y2')) + legendWidthOnRight;
    }
};

c3_chart_internal_fn.getParentRectValue = function C3_INTERNAL_getParentRectValue(key) {
    var parent = this.selectChart.node(), 
        v;
    while (parent && parent.tagName !== 'BODY') {
        try {
            v = parent.getBoundingClientRect()[key];
        } catch(e) {
            if (key === 'width') {
                // In IE in certain cases getBoundingClientRect
                // will cause an "unspecified error"
                v = parent.offsetWidth;
            }
        }
        if (v) {
            break;
        }
        parent = parent.parentNode;
    }
    return v;
};
c3_chart_internal_fn.getParentWidth = function C3_INTERNAL_getParentWidth() {
    return this.getParentRectValue('width');
};
c3_chart_internal_fn.getParentHeight = function C3_INTERNAL_getParentHeight() {
    var h = this.selectChart.style('height');
    return h.indexOf('px') > 0 ? +h.replace('px', '') : 0;
};


c3_chart_internal_fn.getSvgLeft = function C3_INTERNAL_getSvgLeft(withoutRecompute) {
    var $$ = this, 
        config = $$.config,
        hasLeftAxisRect = config.axis_rotated || (!config.axis_rotated && !config.axis_y_inner),
        leftAxisClass = config.axis_rotated ? CLASS.axisX : CLASS.axisY,
        leftAxis = $$.main.select('.' + leftAxisClass).node(),
        svgRect = leftAxis && hasLeftAxisRect ? leftAxis.getBoundingClientRect() : {right: 0},
        chartRect = $$.selectChart.node().getBoundingClientRect(),
        hasArc = $$.hasArcType(),
        svgLeft = svgRect.right - chartRect.left - (hasArc ? 0 : $$.getCurrentPaddingLeft(withoutRecompute));
    return svgLeft > 0 ? svgLeft : 0;
};


c3_chart_internal_fn.getAxisWidthByAxisId = function C3_INTERNAL_getAxisWidthByAxisId(id, withoutRecompute) {
    var $$ = this, 
        position = $$.axis.getLabelPositionById(id);
    return $$.axis.getMaxTickWidth(id, withoutRecompute) + (position.isInner ? 10 : 20);
};

c3_chart_internal_fn.getHorizontalAxisHeight = function C3_INTERNAL_getHorizontalAxisHeight(axisId) {
    var $$ = this, 
        config = $$.config, 
        h = 30;
    if (axisId === 'x' && !config.axis_x_show) { 
        return 8; 
    }
    if (axisId === 'x' && config.axis_x_height) { 
        return config.axis_x_height; 
    }
    if (axisId === 'y' && !config.axis_y_show) { 
        return config.legend_show && !$$.isLegendRight && !$$.isLegendInset ? 10 : 1; 
    }
    if (axisId === 'y2' && !config.axis_y2_show) { 
        return $$.rotated_padding_top; 
    }
    // Calculate x axis height when tick rotated
    if (axisId === 'x' && !config.axis_rotated && config.axis_x_tick_rotate) {
        h += $$.axis.getMaxTickWidth(axisId) * Math.cos(Math.PI * (90 - Math.abs(config.axis_x_tick_rotate)) / 180);
    }
    // Calculate y axis height when tick rotated
    if (axisId === 'y' && config.axis_rotated && config.axis_y_tick_rotate) {
        h += $$.axis.getMaxTickWidth(axisId) * Math.cos(Math.PI * (90 - Math.abs(config.axis_y_tick_rotate)) / 180);
    }
    return h + ($$.axis.getLabelPositionById(axisId).isInner ? 0 : 10) + (axisId === 'y2' ? -10 : 0);
};

c3_chart_internal_fn.getEventRectWidth = function C3_INTERNAL_getEventRectWidth() {
    return Math.max(0, this.xAxis.tickInterval());
};
