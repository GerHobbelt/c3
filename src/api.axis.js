c3_chart_fn.axis = function C3_API_Axis() {};
c3_chart_fn.axis.labels = function C3_API_Axis_Labels(labels) {
    var $$ = this.internal;
    if (arguments.length) {
        Object.keys(labels).forEach(function (axisId) {
            $$.axis.setLabelText(axisId, labels[axisId]);
        });
        $$.axis.updateLabels();
    }
    // TODO: return some values?
};
c3_chart_fn.axis.max = function C3_API_Axis_Max(max) {
    var $$ = this.internal, config = $$.config;
    if (arguments.length) {
        if (typeof max === 'object') {
            if (max.hasOwnProperty('x')) { config.axis_x_max = max.x; }
            if (max.hasOwnProperty('y')) { config.axis_y_max = max.y; }
            if (max.hasOwnProperty('y2')) { config.axis_y2_max = max.y2; }
        } else {
            config.axis_y_max = config.axis_y2_max = max;
        }
        $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true});
    } else {
        return {
            x: config.axis_x_max,
            y: config.axis_y_max,
            y2: config.axis_y2_max
        };
    }
};
c3_chart_fn.axis.min = function C3_API_Axis_Min(min) {
    var $$ = this.internal, config = $$.config;
    if (arguments.length) {
        if (typeof min === 'object') {
            if (min.hasOwnProperty('x')) { config.axis_x_min = min.x; }
            if (min.hasOwnProperty('y')) { config.axis_y_min = min.y; }
            if (min.hasOwnProperty('y2')) { config.axis_y2_min = min.y2; }
        } else {
            config.axis_y_min = config.axis_y2_min = min;
        }
        $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true});
    } else {
        return {
            x: config.axis_x_min,
            y: config.axis_y_min,
            y2: config.axis_y2_min
        };
    }
};
c3_chart_fn.axis.range = function C3_API_Axis_Range(range) {
    if (arguments.length) {
        if (isDefined(range.max)) { this.axis.max(range.max); }
        if (isDefined(range.min)) { this.axis.min(range.min); }
    } else {
        return {
            max: this.axis.max(),
            min: this.axis.min()
        };
    }
};
