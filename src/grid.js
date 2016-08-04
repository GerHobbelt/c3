c3_chart_internal_fn.initGrid = function C3_INTERNAL_initGrid() {
    var $$ = this, 
        config = $$.config, 
        d3 = $$.d3;
    $$.grid = $$.main.append('g')
        .attr("clip-path", $$.clipPathForGrid)
        .attr('class', CLASS.grid);
    if (config.grid_x_show) {
        $$.grid.append("g").attr("class", CLASS.xgrids);
    }
    if (config.grid_y_show) {
        $$.grid.append('g').attr('class', CLASS.ygrids);
    }
    if (config.grid_focus_show) {
        $$.grid.append('g')
            .attr("class", CLASS.xgridFocus)
            .append('line')
            .attr('class', CLASS.xgridFocus);
    }
    $$.xgrid = d3.selectAll([]);
    if (!config.grid_lines_front) { 
        $$.initGridLines(); 
    }
};
c3_chart_internal_fn.initGridLines = function C3_INTERNAL_initGridLines() {
    var $$ = this, 
        d3 = $$.d3;
    $$.gridLines = $$.main.append('g')
        .attr("clip-path", $$.clipPathForGrid)
        .attr('class', CLASS.grid + ' ' + CLASS.gridLines);
    $$.gridLines.append('g').attr("class", CLASS.xgridLines);
    $$.gridLines.append('g').attr('class', CLASS.ygridLines);
    $$.xgridLines = d3.selectAll([]);
};
c3_chart_internal_fn.updateXGrid = function C3_INTERNAL_updateXGrid(withoutUpdate) {
    var $$ = this, 
        config = $$.config, 
        d3 = $$.d3,
        xgridData = $$.generateGridData(config.grid_x_type, $$.x),
        tickOffset = $$.isCategorized() ? $$.xAxis.tickOffset() : 0;

    $$.xgridAttr = config.axis_rotated ? {
        'x1': 0,
        'x2': $$.width,
        'y1': function (d) { return $$.x(d) - tickOffset; },
        'y2': function (d) { return $$.x(d) - tickOffset; }
    } : {
        'x1': function (d) { return $$.x(d) + tickOffset; },
        'x2': function (d) { return $$.x(d) + tickOffset; },
        'y1': 0,
        'y2': $$.height
    };

    $$.xgrid = $$.main.select('.' + CLASS.xgrids).selectAll('.' + CLASS.xgrid)
        .data(xgridData);
    $$.xgrid.enter().append('line')
        .attr("class", CLASS.xgrid);
    if (!withoutUpdate) {
        $$.xgrid.attr($$.xgridAttr)
            .style("opacity", function () { 
                return +d3.select(this).attr(config.axis_rotated ? 'y1' : 'x1') === (config.axis_rotated ? $$.height : 0) ? 0 : 1; 
            });
    }
    $$.xgrid.exit().remove();
};

c3_chart_internal_fn.updateYGrid = function C3_INTERNAL_updateYGrid() {
    var $$ = this, 
        config = $$.config,
        gridValues = $$.yAxis.tickValues() || $$.y.ticks(config.grid_y_ticks);
    $$.ygrid = $$.main.select('.' + CLASS.ygrids).selectAll('.' + CLASS.ygrid)
        .data(gridValues);
    $$.ygrid.enter().append('line')
        .attr('class', CLASS.ygrid);
    $$.ygrid
        .attr("x1", config.axis_rotated ? $$.y : 0)
        .attr("x2", config.axis_rotated ? $$.y : $$.width)
        .attr("y1", config.axis_rotated ? 0 : $$.y)
        .attr("y2", config.axis_rotated ? $$.height : $$.y);
    $$.ygrid.exit().remove();
    $$.smoothLines($$.ygrid, 'grid');
};

c3_chart_internal_fn.gridTextAnchor = function C3_INTERNAL_gridTextAnchor(d) {
    return d.position ? d.position : "end";
};
c3_chart_internal_fn.gridTextDx = function C3_INTERNAL_gridTextDx(d) {
    return d.position === 'start' ? 4 : d.position === 'middle' ? 0 : -4;
};
c3_chart_internal_fn.xGridTextX = function C3_INTERNAL_xGridTextX(d) {
    return d.position === 'start' ? -this.height : d.position === 'middle' ? -this.height / 2 : 0;
};
c3_chart_internal_fn.yGridTextX = function C3_INTERNAL_yGridTextX(d) {
    return d.position === 'start' ? 0 : d.position === 'middle' ? this.width / 2 : this.width;
};
c3_chart_internal_fn.updateGrid = function C3_INTERNAL_updateGrid(duration) {
    var $$ = this, 
        main = $$.main, 
        config = $$.config,
        xgridLine, ygridLine;

    // hide if arc type
    $$.grid.style('visibility', $$.hasArcType() ? 'hidden' : 'visible');

    main.select('line.' + CLASS.xgridFocus).style("visibility", "hidden");
    if (config.grid_x_show) {
        $$.updateXGrid();
    }
    $$.xgridLines = main.select('.' + CLASS.xgridLines).selectAll('.' + CLASS.xgridLine)
        .remove()
        .data(config.grid_x_lines);
    // enter
    xgridLine = $$.xgridLines.enter().append('g')
        .attr("class", function (d) { 
            return CLASS.xgridLine + (d.class ? ' ' + d.class : ''); 
        });
    xgridLine.append('line')
        .style("opacity", 0);
    xgridLine.append('text')
        .attr("text-anchor", $$.gridTextAnchor)
        .attr("transform", config.axis_rotated ? "" : "rotate(-90)")
        .attr('dx', $$.gridTextDx)
        .attr('dy', -5)
        .style("opacity", 0);
    // update
    // done in d3.transition() at the end of this function
    // exit
    $$.xgridLines.exit().transition().duration(duration)
        .style("opacity", 0)
        .remove();

    // Y-Grid
    if (config.grid_y_show) {
        $$.updateYGrid();
    }
    $$.ygridLines = main.select('.' + CLASS.ygridLines).selectAll('.' + CLASS.ygridLine)
        .data(config.grid_y_lines);
    // enter
    var dy_pos = function dy_pos(d) {
        var yv = $$.yv(d);
        if (yv < 0) {
            return 9;
        } else {
            return -5;
        }
    };
    ygridLine = $$.ygridLines.enter().append('g')
        .attr("class", function (d) { 
            return CLASS.ygridLine + (d.class ? ' ' + d.class : ''); 
        });
    ygridLine.append('line')
        .style("opacity", 0);
    ygridLine.append('text')
        .attr("text-anchor", $$.gridTextAnchor)
        .attr("transform", config.axis_rotated ? "rotate(-90)" : "")
        .attr('dx', $$.gridTextDx)
        .attr('dy', dy_pos)
        .style("opacity", 0);
    // update
    // done in d3.transition() at the end of this function
    // exit
    $$.ygridLines.exit().transition().duration(duration)
        .style("opacity", 0)
        .remove();
};
c3_chart_internal_fn.redrawGrid = function C3_INTERNAL_redrawGrid(withTransition) {
    console.count('redrawGrid');
    var $$ = this, 
        config = $$.config, 
        xv = $$.xv.bind($$),
        lines = $$.xgridLines.select('line'),
        texts = $$.xgridLines.select('text');

    var height = (config.axis_rotated ? $$.width : $$.height);
    var yv_pos = function yv_pos(d) {
        var yv = $$.yv(d);
        if (yv < 0) {
            return 1;
        } else if (yv > height) {
            return height - 1;
        }
        return yv;
    };
    var y_lines = $$.ygridLines.select('line'),
        y_texts = $$.ygridLines.select('text');

    return [
        (withTransition ? lines.transition() : lines)
            .attr("x1", config.axis_rotated ? 0 : xv)
            .attr("x2", config.axis_rotated ? $$.width : xv)
            .attr("y1", config.axis_rotated ? xv : 0)
            .attr("y2", config.axis_rotated ? xv : $$.height)
            .style("opacity", 1),
        (withTransition ? texts.transition() : texts)
            .attr("x", config.axis_rotated ? $$.yGridTextX.bind($$) : $$.xGridTextX.bind($$))
            .attr("y", xv)
            .text(function (d) { 
                return d.text; 
            })
            .style("opacity", 1),

        (withTransition ? y_lines.transition() : y_lines)
            .attr("x1", config.axis_rotated ? yv_pos : 0)
            .attr("x2", config.axis_rotated ? yv_pos : $$.width)
            .attr("y1", config.axis_rotated ? 0 : yv_pos)
            .attr("y2", config.axis_rotated ? $$.height : yv_pos)
            .style("opacity", 1),
        (withTransition ? y_texts.transition() : y_texts)
            .attr("x", config.axis_rotated ? $$.xGridTextX.bind($$) : $$.yGridTextX.bind($$))
            .attr("y", yv_pos)
            .text(function (d) { 
                return d.text; 
            })
            .style("opacity", 1)
    ];
};
c3_chart_internal_fn.showXGridFocus = function C3_INTERNAL_showXGridFocus(selectedData) {
    var $$ = this, 
        config = $$.config,
        dataToShow = selectedData.filter(function (d) { 
            return d && isValue(d.value); 
        }),
        focusEl = $$.main.selectAll('line.' + CLASS.xgridFocus),
        xx = $$.xx.bind($$);
    if (!config.tooltip_show) { 
        return; 
    }
    // Hide when scatter plot exists
    if ($$.hasType('scatter') || $$.hasArcType()) { 
        return; 
    }
    focusEl
        .style("visibility", "visible")
        .data([dataToShow[0]])
        .attr(config.axis_rotated ? 'y1' : 'x1', xx)
        .attr(config.axis_rotated ? 'y2' : 'x2', xx);
    $$.smoothLines(focusEl, 'grid');
};
c3_chart_internal_fn.hideXGridFocus = function C3_INTERNAL_hideXGridFocus() {
    this.main.select('line.' + CLASS.xgridFocus).style("visibility", "hidden");
};
c3_chart_internal_fn.updateXgridFocus = function C3_INTERNAL_updateXgridFocus() {
    var $$ = this, 
        config = $$.config;
    $$.main.select('line.' + CLASS.xgridFocus)
        .attr("x1", config.axis_rotated ? 0 : -10)
        .attr("x2", config.axis_rotated ? $$.width : -10)
        .attr("y1", config.axis_rotated ? -10 : 0)
        .attr("y2", config.axis_rotated ? -10 : $$.height);
};
c3_chart_internal_fn.generateGridData = function C3_INTERNAL_generateGridData(type, scale) {
    var $$ = this,
        gridData = [], 
        xDomain, firstYear, lastYear, i,
        tickNum = $$.main.select("." + CLASS.axisX).selectAll('.tick').size();
    if (type === 'year') {
        xDomain = $$.getXDomain();
        firstYear = xDomain[0].getFullYear();
        lastYear = xDomain[1].getFullYear();
        for (i = firstYear; i <= lastYear; i++) {
            gridData.push(new Date(i + '-01-01 00:00:00'));
        }
    } else {
        gridData = scale.ticks(10);
        if (gridData.length > tickNum) { // use only int
            gridData = gridData.filter(function (d) { 
                return ('' + d).indexOf('.') < 0; 
            });
        }
    }
    return gridData;
};
c3_chart_internal_fn.getGridFilterToRemove = function C3_INTERNAL_getGridFilterToRemove(params) {
    return params ? function (line) {
        var found = false;
        [].concat(params).forEach(function (param) {
            if (((param.value != null && line.value === param.value) || (param.class != null && line.class === param.class))) {
                found = true;
            }
        });
        return found;
    } : function () { 
        return true; 
    };
};
c3_chart_internal_fn.removeGridLines = function C3_INTERNAL_removeGridLines(params, forX) {
    var $$ = this, 
        config = $$.config,
        toRemove = $$.getGridFilterToRemove(params),
        toShow = function (line) { 
            return !toRemove(line); 
        },
        classLines = forX ? CLASS.xgridLines : CLASS.ygridLines,
        classLine = forX ? CLASS.xgridLine : CLASS.ygridLine;
    $$.main.select('.' + classLines).selectAll('.' + classLine).filter(toRemove)
        .transition().duration(config.transition_duration)
        .style('opacity', 0).remove();
    if (forX) {
        config.grid_x_lines = config.grid_x_lines.filter(toShow);
    } else {
        config.grid_y_lines = config.grid_y_lines.filter(toShow);
    }
};
