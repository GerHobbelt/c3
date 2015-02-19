c3_chart_internal_fn.setTargetType = function (targetIds, type) {
    var $$ = this, config = $$.config;
    $$.mapToTargetIds(targetIds).forEach(function (id) {
        $$.withoutFadeIn[id] = (type === config.data_types[id]);
        config.data_types[id] = type;
    });
    if (!targetIds) {
        config.data_type = type;
    }
};
c3_chart_internal_fn.hasType = function (type, targets) {
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
c3_chart_internal_fn.hasArcType = function (targets) {
    return this.hasType('pie', targets) || this.hasType('donut', targets) || this.hasType('gauge', targets);
};
c3_chart_internal_fn.isLineType = function (d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return !dataType ||
        ['line', 'spline', 'area', 'area-spline', 'step', 'area-step'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isStepType = function (d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return ['step', 'area-step'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isSplineType = function (d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return ['spline', 'area-spline'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isAreaType = function (d, isSub) {
    var config = this.config,
        id = isString(d) ? d : d.id;
    var dataType = (isSub && config.subchart_types ? config.subchart_types[id] : undefined) || config.data_types[id];
    return ['area', 'area-spline', 'area-step'].indexOf(dataType) >= 0;
};
c3_chart_internal_fn.isBarType = function (d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'bar';
};
c3_chart_internal_fn.isScatterType = function (d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'scatter';
};
c3_chart_internal_fn.isPieType = function (d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'pie';
};
c3_chart_internal_fn.isGaugeType = function (d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'gauge';
};
c3_chart_internal_fn.isDonutType = function (d) {
    var id = isString(d) ? d : d.id;
    return this.config.data_types[id] === 'donut';
};
c3_chart_internal_fn.isArcType = function (d) {
    return this.isPieType(d) || this.isDonutType(d) || this.isGaugeType(d);
};
c3_chart_internal_fn.lineData = function (d, isSub) {
    return this.isLineType(d, isSub) ? [d] : [];
};
c3_chart_internal_fn.arcData = function (d) {
    return this.isArcType(d.data) ? [d] : [];
};
/* not used
 function scatterData(d) {
 return isScatterType(d) ? d.values : [];
 }
 */
c3_chart_internal_fn.barData = function (d) {
    return this.isBarType(d) ? d.values : [];
};
c3_chart_internal_fn.lineOrScatterData = function (d, isSub) {
    return this.isLineType(d, isSub) || this.isScatterType(d) ? d.values : [];
};
c3_chart_internal_fn.barOrLineData = function (d, isSub) {
    return this.isBarType(d) || this.isLineType(d, isSub) ? d.values : [];
};
