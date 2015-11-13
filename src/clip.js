c3_chart_internal_fn.getClipPath = function C3_INTERNAL_getClipPath(id) {
    var isIE9 = window.navigator.appVersion.toLowerCase().indexOf("msie 9.") >= 0;
    return "url(" + (isIE9 ? "" : document.URL.split('#')[0]) + "#" + id + ")";
};
c3_chart_internal_fn.appendClip = function C3_INTERNAL_appendClip(parent, id) {
    return parent.append("clipPath").attr("id", id).append("rect");
};
c3_chart_internal_fn.getAxisClipX = function C3_INTERNAL_getAxisClipX(forHorizontal) {
    var $$ = this;
    // axis line width + padding for left
    var left = Math.max(30, this.margin.left);
    if (forHorizontal) {
        return $$.config.axis_x_clip ? 0 : -(1 + left);
    } else {
        return -(left - 1);
    }
};
c3_chart_internal_fn.getAxisClipY = function C3_INTERNAL_getAxisClipY(forHorizontal) {
    return forHorizontal ? -20 : -this.margin.top;
};
c3_chart_internal_fn.getXAxisClipX = function C3_INTERNAL_getXAxisClipX() {
    var $$ = this;
    return $$.getAxisClipX(!$$.config.axis_rotated);
};
c3_chart_internal_fn.getXAxisClipY = function C3_INTERNAL_getXAxisClipY() {
    var $$ = this;
    return $$.getAxisClipY(!$$.config.axis_rotated);
};
c3_chart_internal_fn.getYAxisClipX = function C3_INTERNAL_getYAxisClipX() {
    var $$ = this;
    return $$.config.axis_y_inner ? -1 : $$.getAxisClipX($$.config.axis_rotated);
};
c3_chart_internal_fn.getYAxisClipY = function C3_INTERNAL_getYAxisClipY() {
    var $$ = this;
    return $$.getAxisClipY($$.config.axis_rotated);
};
c3_chart_internal_fn.getAxisClipWidth = function C3_INTERNAL_getAxisClipWidth(forHorizontal) {
    var $$ = this,
        left = Math.max(30, $$.margin.left),
        right = Math.max(30, $$.margin.right);
    // width + axis line width + padding for left/right
    if (forHorizontal) {
        return $$.config.axis_x_clip ? $$.width : $$.width + 2 + left + right;
    } else {
        return $$.margin.left + 20;
    }
};
c3_chart_internal_fn.getAxisClipHeight = function C3_INTERNAL_getAxisClipHeight(forHorizontal) {
    // less than 20 is not enough to show the axis label 'outer' without legend
    return (forHorizontal ? this.margin.bottom : (this.margin.top + this.height)) + 20;
};
c3_chart_internal_fn.getXAxisClipWidth = function C3_INTERNAL_getXAxisClipWidth() {
    var $$ = this;
    return $$.getAxisClipWidth(!$$.config.axis_rotated);
};
c3_chart_internal_fn.getXAxisClipHeight = function C3_INTERNAL_getXAxisClipHeight() {
    var $$ = this;
    return $$.getAxisClipHeight(!$$.config.axis_rotated);
};
c3_chart_internal_fn.getYAxisClipWidth = function C3_INTERNAL_getYAxisClipWidth() {
    var $$ = this;
    return $$.getAxisClipWidth($$.config.axis_rotated) + ($$.config.axis_y_inner ? 20 : 0);
};
c3_chart_internal_fn.getYAxisClipHeight = function C3_INTERNAL_getYAxisClipHeight() {
    var $$ = this;
    return $$.getAxisClipHeight($$.config.axis_rotated);
};
