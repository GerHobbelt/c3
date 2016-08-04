c3_chart_internal_fn.initBar = function C3_INTERNAL_initBar() {
    var $$ = this;
    $$.main.select('.' + CLASS.chart).append("g")
        .attr("class", CLASS.chartBars);
};
c3_chart_internal_fn.updateTargetsForBar = function C3_INTERNAL_updateTargetsForBar(targets) {
    var $$ = this, 
        config = $$.config,
        mainBarUpdate, mainBarEnter,
        classChartBar = $$.classChartBar.bind($$),
        classBars = $$.classBars.bind($$),
        classFocus = $$.classFocus.bind($$);
    mainBarUpdate = $$.main.select('.' + CLASS.chartBars).selectAll('.' + CLASS.chartBar)
        .data(targets)
        .attr('class', function (d) { 
            return classChartBar(d) + classFocus(d); 
        });
    mainBarEnter = mainBarUpdate.enter().append('g')
        .attr('class', classChartBar)
        .style('opacity', 0)
        .style("pointer-events", "none");
    // Bars for each data
    mainBarEnter.append('g')
        .attr("class", classBars)
        .style("cursor", function (d) { 
            return config.data_selection_isselectable(d) ? "pointer" : null; 
        });

};
c3_chart_internal_fn.updateBar = function C3_INTERNAL_updateBar(durationForExit) {
    var $$ = this,
        classBar = $$.classBar.bind($$),
        initialOpacity = $$.initialOpacity.bind($$),
        color = function (d) { 
            return $$.color(d.id); 
        };
    $$.mainBar = $$.main.selectAll('.' + CLASS.bars).selectAll('.' + CLASS.bar)
        .data(function (d, i) {
            return $$.barData(d);
        });

    var path = $$.mainBar.enter().append('path')
        .attr("class", function (path) {
          var extraClasses = $$.config.data_classes[path.id] ? ' ' + $$.config.data_classes[path.id] : '';
          return classBar(path) + extraClasses;
        })
        .style("stroke", color)
        .style("fill", color);

    if ($$.config.mask) {
        path.style("mask", "url(#diagonalMask)");
    }

    $$.mainBar
        .style("opacity", initialOpacity);
    $$.mainBar.exit().transition().duration(durationForExit)
        .style('opacity', 0)
        .remove();
};
c3_chart_internal_fn.redrawBar = function C3_INTERNAL_redrawBar(drawBar, withTransition) {
    console.count('redrawBar');
    return [
        (withTransition ? this.mainBar.transition(Math.random().toString()) : this.mainBar)
            .attr('d', drawBar)
            .style("fill", this.color)
            .style("opacity", this.opacity)
    ];
};
c3_chart_internal_fn.getBarW = function C3_INTERNAL_getBarW(axis, barTargetsNum) {
    var $$ = this, 
        config = $$.config, 
        w = 0;
    if (typeof config.bar_width === 'number') {
        w = config.bar_width;
    } else if (barTargetsNum) {
        var tickInterval = axis.tickInterval();
        if (config.axis_x_type === 'timeseries') {
            var time, timePerPx, min;
            $$.data.targets.forEach(function (target) {
                var data = $$.data.xs[target.id];
                // find each pixel represent how long time
                var diff = data[data.length - 1].getTime() - data[0].getTime();
                if (!time || diff > time) {
                    time = diff;
                }

                // find minimal time diff between ticks
                data.forEach(function (v, i) {
                    if (data[i + 1]) {
                        var diff = data[i + 1].getTime() - v.getTime();
                        if (!min || min > diff) {
                            min = diff;
                        }
                    }
                });
            });
            timePerPx = time / ($$.xMax - $$.xMin);
            tickInterval = Math.floor(min / timePerPx / 2);
        }

        w = (tickInterval * config.bar_width_ratio) / barTargetsNum;
    }

    if (config.bar_width_max && w > config.bar_width_max) {
        return config.bar_width_max;
    }

    if (w < 1) {
        return 1;
    }

    return  w;
};
c3_chart_internal_fn.getBars = function C3_INTERNAL_getBars(i, id) {
    var $$ = this;
    return (id ? $$.main.selectAll('.' + CLASS.bars + $$.getTargetSelectorSuffix(id)) : $$.main).selectAll('.' + CLASS.bar + (isValue(i) ? '-' + i : ''));
};
c3_chart_internal_fn.expandBars = function C3_INTERNAL_expandBars(i, id, reset) {
    var $$ = this;
    if (reset) { 
        $$.unexpandBars(); 
    }
    $$.getBars(i, id).classed(CLASS.EXPANDED, true);
};
c3_chart_internal_fn.unexpandBars = function C3_INTERNAL_unexpandBars(i) {
    var $$ = this;
    $$.getBars(i).classed(CLASS.EXPANDED, false);
};
c3_chart_internal_fn.generateDrawBar = function C3_INTERNAL_generateDrawBar(barIndices, isSub) {
    var $$ = this, 
        config = $$.config,
        getPoints = $$.generateGetBarPoints(barIndices, isSub);
    return function (d, i) {
        // 4 points that make a bar
        var points = getPoints(d, i);

        // switch points if axis is rotated, not applicable for sub chart
        var indexX = config.axis_rotated ? 1 : 0;
        var indexY = config.axis_rotated ? 0 : 1;

        var path = 'M ' + points[0][indexX] + ',' + points[0][indexY] + ' ' +
                'L' + points[1][indexX] + ',' + points[1][indexY] + ' ' +
                'L' + points[2][indexX] + ',' + points[2][indexY] + ' ' +
                'L' + points[3][indexX] + ',' + points[3][indexY] + ' ' +
                'z';

        return path;
    };
};
c3_chart_internal_fn.generateGetBarPoints = function C3_INTERNAL_generateGetBarPoints(barIndices, isSub) {
    var $$ = this,
        axis = isSub ? $$.subXAxis : $$.xAxis,
        barTargetsNum = barIndices.__max__ + 1,
        barW = $$.getBarW(axis, barTargetsNum),
        barX = $$.getShapeX(barW, barTargetsNum, barIndices, !!isSub),
        barY = $$.getShapeY(!!isSub),
        barOffset = $$.getShapeOffset($$.isBarType, barIndices, !!isSub),
        yScale = isSub ? $$.getSubYScale : $$.getYScale;
    return function (d, i) {
        var y0 = yScale.call($$, d.id)(0),
            offset = barOffset(d, i) || y0, // offset is for stacked bar chart
            posX = barX(d), posY = barY(d);
        // fix posY not to overflow opposite quadrant
        if ($$.config.axis_rotated) {
            if ((0 < d.value && posY < y0) || (d.value < 0 && y0 < posY)) { 
                posY = y0; 
            }
        }
        // 4 points that make a bar
        return [
            [posX, offset],
            [posX, posY - (y0 - offset)],
            [posX + barW, posY - (y0 - offset)],
            [posX + barW, offset]
        ];
    };
};
c3_chart_internal_fn.isWithinBar = function C3_INTERNAL_isWithinBar(that) {
    var mouse = this.d3.mouse(that),
        box = getPathBox(that), 
        offset = 2,
        sx = box.x - offset, 
        ex = box.x + box.width + offset, 
        sy = box.y + box.height + offset, 
        ey = box.y - offset;
    return sx < mouse[0] && mouse[0] < ex && ey < mouse[1] && mouse[1] < sy;
};
