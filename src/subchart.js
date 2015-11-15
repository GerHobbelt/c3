c3_chart_internal_fn.initBrush = function C3_INTERNAL_initBrush() {
    var $$ = this, 
        d3 = $$.d3;
    $$.brush = d3.svg.brush().on("brush", function () { 
        $$.redrawForBrush(); 
    });
    $$.brush.update = function () {
        if ($$.context) { 
            $$.context.select('.' + CLASS.brush).call(this); 
        }
        return this;
    };
    $$.brush.scale = function (scale) {
        return $$.config.axis_rotated ? this.y(scale) : this.x(scale);
    };
};
c3_chart_internal_fn.initSubchart = function C3_INTERNAL_initSubchart() {
    var $$ = this, 
        config = $$.config,
        context = $$.context = $$.svg.append("g").attr("transform", $$.getTranslate('context')),
        visibility = config.subchart_show ? 'visible' : 'hidden';

    context.style('visibility', visibility);

    // Define g for chart area
    context.append('g')
        .attr("clip-path", $$.clipPathForSubchart)
        .attr('class', CLASS.chart);

    // Define g for bar chart area
    context.select('.' + CLASS.chart).append("g")
        .attr("class", CLASS.chartBars);

    // Define g for line chart area
    context.select('.' + CLASS.chart).append("g")
        .attr("class", CLASS.chartLines);

    // Add extent rect for Brush
    context.append("g")
        .attr("clip-path", $$.clipPath)
        .attr("class", CLASS.brush)
        .call($$.brush);

    // ATTENTION: This must be called AFTER chart added
    // Add Axis
    $$.axes.subx = context.append("g")
        .attr("class", CLASS.axisX)
        .attr("transform", $$.getTranslate('subx'))
        .attr("clip-path", config.axis_rotated ? "" : $$.clipPathForXAxis)
        .style("visibility", config.subchart_show && config.subchart_axis_x_show ? visibility : 'hidden');
};
c3_chart_internal_fn.updateTargetsForSubchart = function C3_INTERNAL_updateTargetsForSubchart(targets) {
    var $$ = this, 
        context = $$.context, 
        config = $$.config,
        contextLineEnter, contextLineUpdate, contextBarEnter, contextBarUpdate,
        classChartBar = $$.classChartBar.bind($$),
        classBars = $$.classBars.bind($$),
        classChartLine = $$.classChartLine.bind($$),
        classLines = $$.classLines.bind($$),
        classAreas = $$.classAreas.bind($$);

    if (config.subchart_show) {
        //-- Bar --//
        contextBarUpdate = context.select('.' + CLASS.chartBars).selectAll('.' + CLASS.chartBar)
            .data(targets)
            .attr('class', classChartBar);
        contextBarEnter = contextBarUpdate.enter().append('g')
            .style('opacity', 0)
            .attr('class', classChartBar);
        // Bars for each data
        contextBarEnter.append('g')
            .attr("class", classBars);

        //-- Line --//
        contextLineUpdate = context.select('.' + CLASS.chartLines).selectAll('.' + CLASS.chartLine)
            .data(targets)
            .attr('class', classChartLine);
        contextLineEnter = contextLineUpdate.enter().append('g')
            .style('opacity', 0)
            .attr('class', classChartLine);
        // Lines for each data
        contextLineEnter.append("g")
            .attr("class", classLines);
        // Area
        contextLineEnter.append("g")
            .attr("class", classAreas);

        //-- Brush --//
        context.selectAll('.' + CLASS.brush + ' rect')
            .attr(config.axis_rotated ? "width" : "height", config.axis_rotated ? $$.width2 : $$.height2);
    }
};
c3_chart_internal_fn.updateBarForSubchart = function C3_INTERNAL_updateBarForSubchart(durationForExit) {
    var $$ = this;
    $$.contextBar = $$.context.selectAll('.' + CLASS.bars).selectAll('.' + CLASS.bar)
        .data(function (d, i) {
            return $$.barData(d, true);
        });
    $$.contextBar.enter().append('path')
        .attr("class", $$.classBar.bind($$))
        .style("stroke", 'none')
        .style("fill", $$.color);
    $$.contextBar
        .style("opacity", $$.initialOpacity.bind($$));
    $$.contextBar.exit().transition().duration(durationForExit)
        .style('opacity', 0)
        .remove();
};
c3_chart_internal_fn.redrawBarForSubchart = function C3_INTERNAL_redrawBarForSubchart(drawBarOnSub, withTransition, duration) {
    console.count('redrawBarForSubchart');
    (withTransition ? this.contextBar.transition(Math.random().toString()).duration(duration) : this.contextBar)
        .attr('d', drawBarOnSub)
        .style('opacity', 1);
};
c3_chart_internal_fn.updateLineForSubchart = function C3_INTERNAL_updateLineForSubchart(durationForExit) {
    var $$ = this;
    $$.contextLine = $$.context.selectAll('.' + CLASS.lines).selectAll('.' + CLASS.line)
        .data(function (d, i) {
            return $$.lineData(d, true);
        });
    $$.contextLine.enter().append('path')
        .attr('class', $$.classLine.bind($$))
        .style('stroke', $$.color);
    $$.contextLine
        .style("opacity", $$.initialOpacity.bind($$));
    $$.contextLine.exit().transition().duration(durationForExit)
        .style('opacity', 0)
        .remove();
};
c3_chart_internal_fn.redrawLineForSubchart = function C3_INTERNAL_redrawLineForSubchart(drawLineOnSub, withTransition, duration) {
    console.count('redrawLineForSubchart');
    (withTransition ? this.contextLine.transition(Math.random().toString()).duration(duration) : this.contextLine)
        .attr("d", drawLineOnSub)
        .style('opacity', 1);
};
c3_chart_internal_fn.updateAreaForSubchart = function C3_INTERNAL_updateAreaForSubchart(durationForExit) {
    var $$ = this, 
        d3 = $$.d3;
    $$.contextArea = $$.context.selectAll('.' + CLASS.areas).selectAll('.' + CLASS.area)
        .data(function (d, i) {
            return $$.lineData(d, true);
        });
    $$.contextArea.enter().append('path')
        .attr("class", $$.classArea.bind($$))
        .style("fill", $$.color)
        .style("opacity", function () { 
            $$.orgAreaOpacity = +d3.select(this).style('opacity'); 
            return 0; 
        });
    $$.contextArea
        .style("opacity", 0);
    $$.contextArea.exit().transition().duration(durationForExit)
        .style('opacity', 0)
        .remove();
};
c3_chart_internal_fn.redrawAreaForSubchart = function C3_INTERNAL_redrawAreaForSubchart(drawAreaOnSub, withTransition, duration) {
    console.count('redrawAreaForSubchart');
    (withTransition ? this.contextArea.transition(Math.random().toString()).duration(duration) : this.contextArea)
        .attr("d", drawAreaOnSub)
        .style("fill", this.color)
        .style("opacity", this.orgAreaOpacity);
};
c3_chart_internal_fn.redrawSubchart = function C3_INTERNAL_redrawSubchart(withSubchart, transitions, duration, durationForExit, areaIndices, barIndices, lineIndices) {
    console.count('redrawSubchart');
    var $$ = this, 
        d3 = $$.d3, 
        config = $$.config,
        drawAreaOnSub, drawBarOnSub, drawLineOnSub;

    $$.context.style('visibility', config.subchart_show ? 'visible' : 'hidden');

    // subchart
    if (config.subchart_show) {
        // reflect main chart to extent on subchart if zoomed
        if (d3.event && d3.event.type === 'zoom') {
            $$.brush.extent($$.x.orgDomain()).update();
        }
        // update subchart elements if needed
        if (withSubchart) {
            // extent rect
            if (!$$.brush.empty()) {
                $$.brush.extent($$.x.orgDomain()).update();
            }
            // setup drawer - MEMO: this must be called after axis updated
            drawAreaOnSub = $$.generateDrawArea(areaIndices, true);
            drawBarOnSub = $$.generateDrawBar(barIndices, true);
            drawLineOnSub = $$.generateDrawLine(lineIndices, true);

            $$.updateBarForSubchart(duration);
            $$.updateLineForSubchart(duration);
            $$.updateAreaForSubchart(duration);

            $$.redrawBarForSubchart(drawBarOnSub, duration, duration);
            $$.redrawLineForSubchart(drawLineOnSub, duration, duration);
            $$.redrawAreaForSubchart(drawAreaOnSub, duration, duration);
        }
    }
};
c3_chart_internal_fn.redrawForBrush = function C3_INTERNAL_redrawForBrush() {
    console.count('redrawForBrush');
    var $$ = this, 
        x = $$.x;
    $$.redraw({
        withTransition: false,
        withY: $$.config.zoom_rescale,
        withSubchart: false,
        withUpdateXDomain: true,
        withDimension: false
    });
    $$.config.subchart_onbrush.call($$.api, x.orgDomain());
};
c3_chart_internal_fn.transformContext = function C3_INTERNAL_transformContext(withTransition, transitions) {
    var $$ = this, 
        subXAxis;
    if (transitions && transitions.axisSubX) {
        subXAxis = transitions.axisSubX;
    } else {
        subXAxis = $$.context.select('.' + CLASS.axisX);
        if (withTransition) { 
            subXAxis = subXAxis.transition(); 
        }
    }
    $$.context.attr("transform", $$.getTranslate('context'));
    subXAxis.attr("transform", $$.getTranslate('subx'));
};
c3_chart_internal_fn.getDefaultExtent = function C3_INTERNAL_getDefaultExtent() {
    var $$ = this, 
        config = $$.config,
        extent = isFunction(config.axis_x_extent) ? config.axis_x_extent($$.getXDomain($$.data.targets)) : config.axis_x_extent;
    if ($$.isTimeSeries()) {
        extent = [$$.parseDate(extent[0]), $$.parseDate(extent[1])];
    }
    return extent;
};
