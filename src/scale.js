c3_chart_internal_fn.getScale = function C3_INTERNAL_getScale(min, max, scaleType) {
    // keep compatibility
    if (typeof scaleType === 'boolean' && scaleType === true) {
        scaleType = 'timeseries';
    } else if (typeof scaleType === 'boolean') {
        scaleType = 'linear';
    }

    var customScale;
    // meybe customized scale
    if (typeof scaleType === 'function') {
        customScale = scaleType;
        scaleType = 'custom';
    } else if (typeof scaleType === 'string' && typeof this.d3.scale[scaleType] === 'function') {
        customScale = this.d3.scale[scaleType];
        scaleType = 'custom';
    }

    var scale;
    switch (scaleType) {
        case 'timeseries':
            scale = this.d3.time.scale();
            break;
        case 'custom':
            scale = customScale();
            break;
        default:
            scale = this.d3.scale.linear();
            break;
    }
    return scale.range([min, max]);
};
c3_chart_internal_fn.getScaleType = function () {
    return this.config.axis_x_scale_type;
};
c3_chart_internal_fn.getScaleTypeY = function () {
    return this.config.axis_y_scale_type;
};
c3_chart_internal_fn.getX = function C3_INTERNAL_getX(min, max, domain, offset) {
    var $$ = this,
        scale = $$.getScale(min, max, $$.isTimeSeries() ? true : $$.getScaleType()),
        _scale = domain ? scale.domain(domain) : scale, 
        key;
    // Define customized scale if categorized axis
    if ($$.isCategorized()) {
        offset = offset || function () { 
            return 0; 
        };
        scale = function (d, raw) {
            var v = _scale(d) + offset(d);
            return raw ? v : Math.ceil(v);
        };
    } else {
        scale = function (d, raw) {
            var v = _scale(d);
            return raw ? v : Math.ceil(v);
        };
    }
    // define functions
    for (key in _scale) {
        scale[key] = _scale[key];
    }
    scale.orgDomain = function () {
        return _scale.domain();
    };
    // define custom domain() for categorized axis
    if ($$.isCategorized()) {
        scale.domain = function (domain) {
            if (!arguments.length) {
                domain = this.orgDomain();
                return [domain[0], domain[1] + 1];
            }
            _scale.domain(domain);
            return scale;
        };
    }
    return scale;
};
c3_chart_internal_fn.getY = function C3_INTERNAL_getY(min, max, domain) {
    var scale = this.getScale(min, max, this.isTimeSeriesY() ? true : this.getScaleTypeY());
    if (domain) { 
        scale.domain(domain); 
    }
    return scale;
};
c3_chart_internal_fn.getYScale = function C3_INTERNAL_getYScale(id) {
    return this.axis.getId(id) === 'y2' ? this.y2 : this.y;
};
c3_chart_internal_fn.getSubYScale = function C3_INTERNAL_getSubYScale(id) {
    return this.axis.getId(id) === 'y2' ? this.subY2 : this.subY;
};
c3_chart_internal_fn.updateScales = function C3_INTERNAL_updateScales() {
    var $$ = this, 
        config = $$.config,
        forInit = !$$.x;
    // update edges
    $$.xMin = config.axis_rotated ? 1 : 0;
    $$.xMax = config.axis_rotated ? $$.height : $$.width;
    $$.yMin = config.axis_rotated ? 0 : $$.height;
    $$.yMax = config.axis_rotated ? $$.width : 1;
    $$.subXMin = $$.xMin;
    $$.subXMax = $$.xMax;
    $$.subYMin = config.axis_rotated ? 0 : $$.height2;
    $$.subYMax = config.axis_rotated ? $$.width2 : 1;
    // update scales
    $$.x = $$.getX($$.xMin, $$.xMax, forInit ? undefined : $$.x.orgDomain(), function () { 
        return $$.xAxis.tickOffset(); 
    });
    $$.y = $$.getY($$.yMin, $$.yMax, forInit ? config.axis_y_default : $$.y.domain());
    $$.y2 = $$.getY($$.yMin, $$.yMax, forInit ? config.axis_y2_default : $$.y2.domain());
    $$.subX = $$.getX($$.xMin, $$.xMax, $$.orgXDomain, function (d) { 
        return d % 1 ? 0 : $$.subXAxis.tickOffset(); 
    });
    $$.subY = $$.getY($$.subYMin, $$.subYMax, forInit ? config.axis_y_default : $$.subY.domain());
    $$.subY2 = $$.getY($$.subYMin, $$.subYMax, forInit ? config.axis_y2_default : $$.subY2.domain());
    // update axes
    $$.xAxisTickFormat = $$.axis.getXAxisTickFormat();
    $$.xAxisTickValues = $$.axis.getXAxisTickValues();
    $$.yAxisTickValues = $$.axis.getYAxisTickValues();
    $$.y2AxisTickValues = $$.axis.getY2AxisTickValues();

    $$.xAxis = $$.axis.getXAxis($$.x, $$.xOrient, $$.xAxisTickFormat, $$.xAxisTickValues, config.axis_x_tick_outer, false, false);
    $$.subXAxis = $$.axis.getXAxis($$.subX, $$.subXOrient, $$.xAxisTickFormat, $$.xAxisTickValues, config.axis_x_tick_outer, false, false);
    $$.yAxis = $$.axis.getYAxis($$.y, $$.yOrient, config.axis_y_tick_format, $$.yAxisTickValues, config.axis_y_tick_outer, false, false, false);
    $$.y2Axis = $$.axis.getYAxis($$.y2, $$.y2Orient, config.axis_y2_tick_format, $$.y2AxisTickValues, config.axis_y2_tick_outer, false, false, true);

    // Set initialized scales to brush and zoom
    if (!forInit) {
        if ($$.brush) { 
            $$.brush.scale($$.subX); 
        }
        if (config.zoom_enabled) { 
            $$.zoom.scale($$.x); 
        }
    }
    // update for arc
    if ($$.updateArc) { 
        $$.updateArc(); 
    }
};
