c3_chart_internal_fn.getShapeIndices = function C3_INTERNAL_getShapeIndices(typeFilter) {
    var $$ = this, config = $$.config,
        indices = {}, i = 0, j, k;
    $$.filterTargetsToShow($$.data.targets.filter(typeFilter, $$)).forEach(function (d) {
        for (j = 0; j < config.data_groups.length; j++) {
            if (config.data_groups[j].indexOf(d.id) < 0) {
                continue;
            }
            for (k = 0; k < config.data_groups[j].length; k++) {
                if (config.data_groups[j][k] in indices) {
                    indices[d.id] = indices[config.data_groups[j][k]];
                    break;
                }
            }
        }
        if (isUndefined(indices[d.id])) {
            indices[d.id] = i++;
        }
    });
    indices.__max__ = i - 1;
    return indices;
};
c3_chart_internal_fn.getShapeX = function C3_INTERNAL_getShapeX(offset, targetsNum, indices, isSub) {
    var $$ = this, scale = isSub ? $$.subX : $$.x;
    return function (d) {
        var index = d.id in indices ? indices[d.id] : 0;
        return d.x || d.x === 0 ? scale(d.x) - offset * (targetsNum / 2 - index) : 0;
    };
};
c3_chart_internal_fn.getShapeY = function C3_INTERNAL_getShapeY(isSub) {
    var $$ = this;
    return function (d) {
        var scale = isSub ? $$.getSubYScale(d.id) : $$.getYScale(d.id);
        return scale(d.value);
    };
};
c3_chart_internal_fn.getShapeOffset = function C3_INTERNAL_getShapeOffset(typeFilter, indices, isSub) {
    var $$ = this,
        targets = $$.orderTargets($$.filterTargetsToShow($$.data.targets.filter(typeFilter, $$))),
        targetIds = targets.map(function (t) {
            return t.id;
        });
    return function (d, i) {
        var scale = isSub ? $$.getSubYScale(d.id) : $$.getYScale(d.id),
            y0 = scale(0), offset = y0;
        targets.forEach(function (t) {
            var values = $$.isStepType(d) ? $$.convertValuesToStep(t.values) : t.values;
            if (t.id === d.id || indices[t.id] !== indices[d.id]) {
                return;
            }
            if (targetIds.indexOf(t.id) < targetIds.indexOf(d.id)) {
                // check if the x values line up
                if (typeof values[i] === 'undefined' || values[i].x !== d.x) {
                    // if not, try to find the value that does line up
                    i = -1;
                    values.forEach(function (v, j) {
                        if (v.x === d.x) {
                            i = j;
                        }
                    });
                }
                if (i in values && values[i].value * d.value >= 0) {
                    offset += scale(values[i].value) - y0;
                }
            }
        });
        return offset;
    };
};
c3_chart_internal_fn.isWithinShape = function C3_INTERNAL_isWithinShape(that, d) {
    var $$ = this,
        shape = $$.d3.select(that), isWithin;
    if (!$$.isTargetToShow(d.id)) {
        isWithin = false;
    }
    else if (that.nodeName === 'circle') {
        isWithin = $$.isStepType(d) ? $$.isWithinStep(that, $$.getYScale(d.id)(d.value)) : $$.isWithinCircle(that, $$.pointSelectR(d) * 1.5);
    }
    else if (that.nodeName === 'path') {
        isWithin = shape.classed(CLASS.bar) ? $$.isWithinBar(that) : true;
    }
    return isWithin;
};


c3_chart_internal_fn.getInterpolate = function C3_INTERNAL_getInterpolate(d, isSub) {
    var $$ = this,
        interpolation = $$.isInterpolationType($$.config.spline_interpolation_type) ? $$.config.spline_interpolation_type : 'cardinal';

    if ($$.isSplineType(d, isSub)) {
        return (isSub ? $$.config.subchart_line_spline_type : undefined) ||
            $$.config.line_spline_type;
    } else if ($$.isStepType(d, isSub)) {
        return (isSub ? $$.config.subchart_line_step_type : undefined) ||
            $$.config.line_step_type;
    }
    return "linear";
};
