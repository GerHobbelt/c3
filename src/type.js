c3_chart_internal_fn.setTargetType = function C3_INTERNAL_setTargetType(targetIds, type) {
    var $$ = this, config = $$.config;
    $$.mapToTargetIds(targetIds).forEach(function (id) {
        $$.withoutFadeIn[id] = (type === config.data_types[id]);
        config.data_types[id] = type;
    });
    if (!targetIds) {
        config.data_type = type;
    }
};
c3_chart_internal_fn.hasType = function C3_INTERNAL_hasType(type, targets) {
    var $$ = this, types = $$.config.data_types, has = false;
    targets = targets || $$.data.targets;
    if (targets && targets.length) {
        targets.forEach(function (target) {
            var t = types[target.id];
            if ((t && t.indexOf(type) >= 0) || (!t && type === 'line')) {
                has = true;
            }
        });
    } else if (Object.keys(types).length) {
        Object.keys(types).forEach(function (id) {
            if (types[id] === type) {
                has = true;
            }
        });
    } else {
        has = $$.config.data_type === type;
    }
    return has;
};
c3_chart_internal_fn.hasArcType = function C3_INTERNAL_hasArcType(targets) {
    return this.hasType('pie', targets) || this.hasType('donut', targets) || this.hasType('gauge', targets);
};
c3_chart_internal_fn.isLineType = function C3_INTERNAL_isLineType(d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return !dataType ||
        ['line', 'spline', 'area', 'area-spline', 'step', 'area-step'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isStepType = function C3_INTERNAL_isStepType(d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return ['step', 'area-step'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isSplineType = function C3_INTERNAL_isSplineType(d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return ['spline', 'area-spline'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isAreaType = function C3_INTERNAL_isAreaType(d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return ['area', 'area-spline', 'area-step'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isBarType = function C3_INTERNAL_isBarType(d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return dataType === 'bar';
};
c3_chart_internal_fn.isScatterType = function C3_INTERNAL_isScatterType(d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return dataType === 'scatter';
};
c3_chart_internal_fn.isPieType = function C3_INTERNAL_isPieType(d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'pie';
};
c3_chart_internal_fn.isGaugeType = function C3_INTERNAL_isGaugeType(d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'gauge';
};
c3_chart_internal_fn.isDonutType = function C3_INTERNAL_isDonutType(d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'donut';
};
c3_chart_internal_fn.isArcType = function C3_INTERNAL_isArcType(d) {
    return this.isPieType(d) || this.isDonutType(d) || this.isGaugeType(d);
};
c3_chart_internal_fn.lineData = function C3_INTERNAL_lineData(d, isSub) {
    return this.isLineType(d, isSub) ? [d] : [];
};
c3_chart_internal_fn.arcData = function C3_INTERNAL_arcData(d) {
    return this.isArcType(d.data) ? [d] : [];
};
/* not used
 function scatterData(d) {
 return isScatterType(d) ? d.values : [];
 }
 */
c3_chart_internal_fn.barData = function C3_INTERNAL_barData(d, isSub) {
    return this.isBarType(d, isSub) ? d.values : [];
};
c3_chart_internal_fn.lineOrScatterData = function C3_INTERNAL_lineOrScatterData(d, isSub) {
    return this.isLineType(d, isSub) || this.isScatterType(d, isSub) ? d.values : [];
};
c3_chart_internal_fn.barOrLineData = function C3_INTERNAL_barOrLineData(d, isSub) {
    return this.isBarType(d, isSub) || this.isLineType(d, isSub) ? d.values : [];
};
c3_chart_internal_fn.isInterpolationType = function (type) {
    return ['linear', 'linear-closed', 'basis', 'basis-open', 'basis-closed', 'bundle', 'cardinal', 'cardinal-open', 'cardinal-closed', 'monotone'].indexOf(type) >= 0;
};
