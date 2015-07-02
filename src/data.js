c3_chart_internal_fn.isX = function C3_INTERNAL_isX(key) {
    var $$ = this, 
        config = $$.config;
    return (config.data_x && key === config.data_x) || (notEmpty(config.data_xs) && hasValue(config.data_xs, key));
};
c3_chart_internal_fn.isNotX = function C3_INTERNAL_isNotX(key) {
    return !this.isX(key);
};
c3_chart_internal_fn.getXKey = function C3_INTERNAL_getXKey(id) {
    var $$ = this, 
        config = $$.config;
    return config.data_x ? config.data_x : notEmpty(config.data_xs) ? config.data_xs[id] : null;
};
c3_chart_internal_fn.getXValuesOfXKey = function C3_INTERNAL_getXValuesOfXKey(key, targets) {
    var $$ = this,
        xValues, 
        ids = targets && notEmpty(targets) ? $$.mapToIds(targets) : [];
    ids.forEach(function (id) {
        if ($$.getXKey(id) === key) {
            xValues = $$.data.xs[id];
        }
    });
    return xValues;
};
c3_chart_internal_fn.getIndexByX = function C3_INTERNAL_getIndexByX(x) {
    var $$ = this,
        data = $$.filterByX($$.data.targets, x);
    return data.length ? data[0].index : null;
};
c3_chart_internal_fn.getXValue = function C3_INTERNAL_getXValue(id, i) {
    var $$ = this;
    return id in $$.data.xs && $$.data.xs[id] && isValue($$.data.xs[id][i]) ? $$.data.xs[id][i] : i;
};
c3_chart_internal_fn.getOtherTargetXs = function C3_INTERNAL_getOtherTargetXs() {
    var $$ = this,
        idsForX = Object.keys($$.data.xs);
    return idsForX.length ? $$.data.xs[idsForX[0]] : null;
};
c3_chart_internal_fn.getOtherTargetX = function C3_INTERNAL_getOtherTargetX(index) {
    var xs = this.getOtherTargetXs();
    return xs && index < xs.length ? xs[index] : null;
};
c3_chart_internal_fn.addXs = function C3_INTERNAL_addXs(xs) {
    var $$ = this;
    Object.keys(xs).forEach(function (id) {
        $$.config.data_xs[id] = xs[id];
    });
};
c3_chart_internal_fn.hasMultipleX = function C3_INTERNAL_hasMultipleX(xs) {
    return this.d3.set(Object.keys(xs).map(function (id) { 
        return xs[id]; 
    })).size() > 1;
};
c3_chart_internal_fn.isMultipleX = function C3_INTERNAL_isMultipleX() {
    return notEmpty(this.config.data_xs) || !this.config.data_xSort || this.hasType('scatter');
};
c3_chart_internal_fn.addName = function C3_INTERNAL_addName(data) {
    var $$ = this, 
        name;
    if (data) {
        name = $$.config.data_names[data.id];
        data.name = name !== undefined ? name : data.id;
    }
    return data;
};
c3_chart_internal_fn.getValueOnIndex = function C3_INTERNAL_getValueOnIndex(values, index) {
    var valueOnIndex = values.filter(function (v) { 
        return v.index === index; 
    });
    return valueOnIndex.length ? valueOnIndex[0] : null;
};
c3_chart_internal_fn.updateTargetX = function C3_INTERNAL_updateTargetX(targets, x) {
    var $$ = this;
    targets.forEach(function (t) {
        t.values.forEach(function (v, i) {
            v.x = $$.generateTargetX(x[i], t.id, i);
        });
        $$.data.xs[t.id] = x;
    });
};
c3_chart_internal_fn.updateTargetXs = function C3_INTERNAL_updateTargetXs(targets, xs) {
    var $$ = this;
    targets.forEach(function (t) {
        if (xs[t.id]) {
            $$.updateTargetX([t], xs[t.id]);
        }
    });
};
c3_chart_internal_fn.generateTargetX = function C3_INTERNAL_generateTargetX(rawX, id, index) {
    var $$ = this, x;
    if ($$.isTimeSeries()) {
        x = rawX ? $$.parseDate(rawX) : $$.parseDate($$.getXValue(id, index));
    }
    else if ($$.isCustomX() && !$$.isCategorized()) {
        x = isValue(rawX) ? +rawX : $$.getXValue(id, index);
    }
    else {
        x = index;
    }
    return x;
};
c3_chart_internal_fn.cloneTarget = function C3_INTERNAL_cloneTarget(target) {
    return {
        id: target.id,
        id_org: target.id_org,
        values: target.values.map(function (d) {
            return {
                x: d.x, 
                value: d.value, 
                id: d.id
            };
        })
    };
};
c3_chart_internal_fn.updateXs = function C3_INTERNAL_updateXs() {
    var $$ = this;
    if ($$.data.targets.length) {
        $$.xs = [];
        $$.data.targets[0].values.forEach(function (v) {
            $$.xs[v.index] = v.x;
        });
    }
};
c3_chart_internal_fn.getPrevX = function C3_INTERNAL_getPrevX(i) {
    var x = this.xs[i - 1];
    return typeof x !== 'undefined' ? x : null;
};
c3_chart_internal_fn.getNextX = function C3_INTERNAL_getNextX(i) {
    var x = this.xs[i + 1];
    return typeof x !== 'undefined' ? x : null;
};
c3_chart_internal_fn.getMaxDataCount = function C3_INTERNAL_getMaxDataCount() {
    var $$ = this;
    return $$.d3.max($$.data.targets, function (t) { 
        return t.values.length; 
    });
};
c3_chart_internal_fn.getMaxDataCountTarget = function C3_INTERNAL_getMaxDataCountTarget(targets) {
    var length = targets.length, 
        max = 0, 
        maxTarget;
    if (length > 1) {
        targets.forEach(function (t) {
            if (t.values.length > max) {
                maxTarget = t;
                max = t.values.length;
            }
        });
    } else {
        maxTarget = length ? targets[0] : null;
    }
    return maxTarget;
};
c3_chart_internal_fn.getEdgeX = function C3_INTERNAL_getEdgeX(targets) {
    var $$ = this;
    return !targets.length ? [0, 0] : [
        $$.d3.min(targets, function (t) { 
            return t.values[0].x; 
        }),
        $$.d3.max(targets, function (t) { 
            return t.values[t.values.length - 1].x; 
        })
    ];
};
c3_chart_internal_fn.mapToIds = function C3_INTERNAL_mapToIds(targets) {
    return targets.map(function (d) { 
        return d.id; 
    });
};
c3_chart_internal_fn.mapToTargetIds = function C3_INTERNAL_mapToTargetIds(ids) {
    var $$ = this;
    return ids ? (isString(ids) ? [ids] : ids) : $$.mapToIds($$.data.targets);
};
c3_chart_internal_fn.hasTarget = function C3_INTERNAL_hasTarget(targets, id) {
    var ids = this.mapToIds(targets), i;
    for (i = 0; i < ids.length; i++) {
        if (ids[i] === id) {
            return true;
        }
    }
    return false;
};
c3_chart_internal_fn.isTargetToShow = function C3_INTERNAL_isTargetToShow(targetId) {
    return this.hiddenTargetIds.indexOf(targetId) < 0;
};
c3_chart_internal_fn.isLegendToShow = function C3_INTERNAL_isLegendToShow(targetId) {
    return this.hiddenLegendIds.indexOf(targetId) < 0;
};
c3_chart_internal_fn.filterTargetsToShow = function C3_INTERNAL_filterTargetsToShow(targets) {
    var $$ = this;
    return targets.filter(function (t) { 
        return $$.isTargetToShow(t.id); 
    });
};
c3_chart_internal_fn.mapTargetsToUniqueXs = function C3_INTERNAL_mapTargetsToUniqueXs(targets) {
    var $$ = this;
    var xs = $$.d3.set($$.d3.merge(targets.map(function (t) { 
        return t.values.map(function (v) { 
            return +v.x; 
        }); 
    }))).values();
    return $$.isTimeSeries() ? xs.map(function (x) { 
        return new Date(+x); 
    }) : xs.map(function (x) { 
        return +x; 
    });
};
c3_chart_internal_fn.addHiddenTargetIds = function C3_INTERNAL_addHiddenTargetIds(targetIds) {
    this.hiddenTargetIds = this.hiddenTargetIds.concat(targetIds);
};
c3_chart_internal_fn.removeHiddenTargetIds = function C3_INTERNAL_removeHiddenTargetIds(targetIds) {
    this.hiddenTargetIds = this.hiddenTargetIds.filter(function (id) { 
        return targetIds.indexOf(id) < 0; 
    });
};
c3_chart_internal_fn.addHiddenLegendIds = function C3_INTERNAL_addHiddenLegendIds(targetIds) {
    this.hiddenLegendIds = this.hiddenLegendIds.concat(targetIds);
};
c3_chart_internal_fn.removeHiddenLegendIds = function C3_INTERNAL_removeHiddenLegendIds(targetIds) {
    this.hiddenLegendIds = this.hiddenLegendIds.filter(function (id) { 
        return targetIds.indexOf(id) < 0; 
    });
};
c3_chart_internal_fn.getValuesAsIdKeyed = function C3_INTERNAL_getValuesAsIdKeyed(targets) {
    var ys = {};
    targets.forEach(function (t) {
        ys[t.id] = [];
        t.values.forEach(function (v) {
            ys[t.id].push(v.value);
        });
    });
    return ys;
};
c3_chart_internal_fn.checkValueInTargets = function C3_INTERNAL_checkValueInTargets(targets, checker) {
    var ids = Object.keys(targets), 
        i, j, values;
    for (i = 0; i < ids.length; i++) {
        values = targets[ids[i]].values;
        for (j = 0; j < values.length; j++) {
            if (checker(values[j].value)) {
                return true;
            }
        }
    }
    return false;
};
c3_chart_internal_fn.hasNegativeValueInTargets = function C3_INTERNAL_hasNegativeValueInTargets(targets) {
    return this.checkValueInTargets(targets, function (v) { 
        return v < 0; 
    });
};
c3_chart_internal_fn.hasPositiveValueInTargets = function C3_INTERNAL_hasPositiveValueInTargets(targets) {
    return this.checkValueInTargets(targets, function (v) { 
        return v > 0; 
    });
};
c3_chart_internal_fn.isOrderDesc = function C3_INTERNAL_isOrderDesc() {
    var config = this.config;
    return typeof(config.data_order) === 'string' && config.data_order.toLowerCase() === 'desc';
};
c3_chart_internal_fn.isOrderAsc = function C3_INTERNAL_isOrderAsc() {
    var config = this.config;
    return typeof(config.data_order) === 'string' && config.data_order.toLowerCase() === 'asc';
};
c3_chart_internal_fn.orderTargets = function C3_INTERNAL_orderTargets(targets) {
    var $$ = this, 
        config = $$.config, 
        orderAsc = $$.isOrderAsc(), 
        orderDesc = $$.isOrderDesc();
    if (orderAsc || orderDesc) {
        targets.sort(function (t1, t2) {
            var reducer = function (p, c) { 
                return p + Math.abs(c.value); 
            };
            var t1Sum = t1.values.reduce(reducer, 0),
                t2Sum = t2.values.reduce(reducer, 0);
            return orderAsc ? t2Sum - t1Sum : t1Sum - t2Sum;
        });
    } else if (isFunction(config.data_order)) {
        targets.sort(config.data_order);
    } // TODO: accept name array for order
    return targets;
};
c3_chart_internal_fn.filterByX = function C3_INTERNAL_filterByX(targets, x) {
    return this.d3.merge(targets.map(function (t) { 
        return t.values; 
    }))
    .filter(function (v) { 
        return v.x - x === 0; 
    });
};
c3_chart_internal_fn.filterRemoveNull = function C3_INTERNAL_filterRemoveNull(data) {
    return data.filter(function (d) { 
        return isValue(d.value); 
    });
};
c3_chart_internal_fn.filterByXDomain = function C3_INTERNAL_filterByXDomain(targets, xDomain) {
    return targets.map(function (t) {
        return {
            id: t.id,
            id_org: t.id_org,
            values: t.values.filter(function (v) {
                return xDomain[0] <= v.x && v.x <= xDomain[1];
            })
        };
    });
};
c3_chart_internal_fn.hasDataLabel = function C3_INTERNAL_hasDataLabel() {
    var config = this.config;
    if (typeof config.data_labels === 'boolean' && config.data_labels) {
        return true;
    } else if (typeof config.data_labels === 'object' && notEmpty(config.data_labels)) {
        return true;
    }
    return false;
};
c3_chart_internal_fn.getDataLabelLength = function C3_INTERNAL_getDataLabelLength(min, max, key) {
    var $$ = this,
        lengths = [0, 0], 
        paddingCoef = 1.3;
    $$.selectChart.select('svg').selectAll('.dummy')
        .data([min, max])
        .enter().append('text')
        .text(function (d) { 
            return $$.dataLabelFormat(d.id)(d); 
        })
        .each(function (d, i) {
            lengths[i] = this.getBoundingClientRect()[key] * paddingCoef;
        })
        .remove();
    return lengths;
};
c3_chart_internal_fn.isNoneArc = function C3_INTERNAL_isNoneArc(d) {
    return this.hasTarget(this.data.targets, d.id);
},
c3_chart_internal_fn.isArc = function C3_INTERNAL_isArc(d) {
    return d.data && this.hasTarget(this.data.targets, d.data.id);
};
c3_chart_internal_fn.findSameXOfValues = function C3_INTERNAL_findSameXOfValues(values, index) {
    var i, 
        targetX = values[index].x, 
        sames = [];
    for (i = index - 1; i >= 0; i--) {
        if (targetX !== values[i].x) { 
            break; 
        }
        sames.push(values[i]);
    }
    for (i = index; i < values.length; i++) {
        if (targetX !== values[i].x) { 
            break; 
        }
        sames.push(values[i]);
    }
    return sames;
};

c3_chart_internal_fn.findClosestFromTargets = function C3_INTERNAL_findClosestFromTargets(targets, pos) {
    var $$ = this, 
        candidates;

    // map to array of closest points of each target
    candidates = targets.map(function (target) {
        return $$.findClosest(target.values, pos);
    });

    // decide closest point and return
    return $$.findClosest(candidates, pos);
};
c3_chart_internal_fn.findClosest = function C3_INTERNAL_findClosest(values, pos) {
    var $$ = this, 
        minDist = $$.config.point_sensitivity, 
        closest;

    // find mouseovering bar
    values.filter(function (v) { 
        return v && $$.isBarType(v.id); 
    }).forEach(function (v) {
        var shape = $$.main.select('.' + CLASS.bars + $$.getTargetSelectorSuffix(v.id) + ' .' + CLASS.bar + '-' + v.index).node();
        if (!closest && $$.isWithinBar(shape)) {
            closest = v;
        }
    });

    // find closest point from non-bar
    values.filter(function (v) { 
        return v && !$$.isBarType(v.id); 
    }).forEach(function (v) {
        var d = $$.dist(v, pos);
        if (d < minDist) {
            minDist = d;
            closest = v;
        }
    });

    return closest;
};
c3_chart_internal_fn.dist = function C3_INTERNAL_dist(data, pos) {
    var $$ = this, 
        config = $$.config,
        xIndex = config.axis_rotated ? 1 : 0,
        yIndex = config.axis_rotated ? 0 : 1,
        y = $$.circleY(data, data.index),
        x = $$.x(data.x);
    return Math.sqrt(Math.pow(x - pos[xIndex], 2) + Math.pow(y - pos[yIndex], 2));
};
c3_chart_internal_fn.convertValuesToStep = function C3_INTERNAL_convertValuesToStep(values) {
    var converted = [].concat(values), 
        i;

    if (!this.isCategorized()) {
        return values;
    }

    for (i = values.length + 1; 0 < i; i--) {
        converted[i] = converted[i - 1];
    }

    converted[0] = {
        x: converted[0].x - 1,
        value: converted[0].value,
        id: converted[0].id
    };
    converted[values.length + 1] = {
        x: converted[values.length].x + 1,
        value: converted[values.length].value,
        id: converted[values.length].id
    };

    return converted;
};
c3_chart_internal_fn.updateDataAttributes = function C3_INTERNAL_updateDataAttributes(name, attrs) {
    var $$ = this, 
        config = $$.config, 
        current = config['data_' + name];
    if (typeof attrs === 'undefined') { 
        return current; 
    }
    Object.keys(attrs).forEach(function (id) {
        current[id] = attrs[id];
    });
    $$.redraw({withLegend: true});
    return current;
};
