(function (window) {
    'use strict';

    /*global define, module, exports, require */

    var c3 = { version: "0.4.11" };

    var c3_chart_fn,
        c3_chart_internal_fn,
        c3_chart_internal_axis_fn;

    function API(owner) {
        this.owner = owner;
    }

    function inherit(base, derived) {
        if (Object.create) {
            derived.prototype = Object.create(base.prototype);
        } else {
            var f = function f() {};
            f.prototype = base.prototype;
            derived.prototype = new f();
        }

        derived.prototype.constructor = derived;

        return derived;
    }

    function Chart(config) {
        var $$ = this.internal = new ChartInternal(this);
        $$.loadConfig(config);

        $$.beforeInit(config);
        $$.init();
        $$.afterInit(config);

        // bind "this" to nested API
        (function bindThis(fn, target, argThis) {
            Object.keys(fn).forEach(function (key) {
                target[key] = fn[key].bind(argThis);
                if (Object.keys(fn[key]).length > 0) {
                    bindThis(fn[key], target[key], argThis);
                }
            });
        })(c3_chart_fn, this, this);
    }

    function ChartInternal(api) {
        var $$ = this;
        $$.d3 = window.d3 ? window.d3 : typeof require !== 'undefined' ? require("d3") : undefined;
        $$.api = api;
        $$.config = $$.getDefaultConfig();
        $$.data = {};
        $$.cache = {};
        $$.axes = {};
    }

    c3.generate = function C3_API_generate(config) {
        return new Chart(config);
    };

    c3.chart = {
        fn: Chart.prototype,
        internal: {
            fn: ChartInternal.prototype,
            axis: {
                fn: Axis.prototype
            }
        }
    };
    c3_chart_fn = c3.chart.fn;
    c3_chart_internal_fn = c3.chart.internal.fn;
    c3_chart_internal_axis_fn = c3.chart.internal.axis.fn;

    c3_chart_internal_fn.beforeInit = function () {
        // can do something
    };
    c3_chart_internal_fn.afterInit = function () {
        // can do something
    };
    c3_chart_internal_fn.init = function C3_INTERNAL_init() {
        var $$ = this, 
            config = $$.config;

        $$.initParams();

        if (config.data_url) {
            $$.convertUrlToData(config.data_url, config.data_mimeType, config.data_headers, config.data_keys, $$.initWithData);
        }
        else if (config.data_json) {
            $$.initWithData($$.convertJsonToData(config.data_json, config.data_keys));
        }
        else if (config.data_rows) {
            $$.initWithData($$.convertRowsToData(config.data_rows));
        }
        else if (config.data_columns) {
            $$.initWithData($$.convertColumnsToData(config.data_columns));
        }
        else {
            throw Error('url or json or rows or columns is required.');
        }
    };

    c3_chart_internal_fn.initParams = function C3_INTERNAL_initParams() {
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config;

        // MEMO: clipId needs to be unique because it conflicts when multiple charts exist
        $$.clipId = "c3-" + (+new Date()) + '-clip',
        $$.clipIdForXAxis = $$.clipId + '-xaxis',
        $$.clipIdForYAxis = $$.clipId + '-yaxis',
        $$.clipIdForGrid = $$.clipId + '-grid',
        $$.clipIdForSubchart = $$.clipId + '-subchart',
        $$.clipPath = $$.getClipPath($$.clipId),
        $$.clipPathForXAxis = $$.getClipPath($$.clipIdForXAxis),
        $$.clipPathForYAxis = $$.getClipPath($$.clipIdForYAxis);
        $$.clipPathForGrid = $$.getClipPath($$.clipIdForGrid),
        $$.clipPathForSubchart = $$.getClipPath($$.clipIdForSubchart),

        $$.dragStart = null;
        $$.dragging = false;
        $$.flowing = false;
        $$.cancelClick = false;
        $$.mouseover = false;
        $$.transiting = false;

        $$.color = $$.generateColor();
        $$.levelColor = $$.generateLevelColor();
        $$.opacity = 1; //$$.generateOpacity();

        $$.dataTimeFormat = config.data_xLocaltime ? d3.time.format : d3.time.format.utc;
        $$.axisTimeFormat = config.axis_x_localtime ? d3.time.format : d3.time.format.utc;
        $$.defaultAxisTimeFormat = $$.axisTimeFormat.multi([
            [".%L", function (d) { return d.getMilliseconds(); }],
            [":%S", function (d) { return d.getSeconds(); }],
            ["%I:%M", function (d) { return d.getMinutes(); }],
            ["%I %p", function (d) { return d.getHours(); }],
            ["%-m/%-d", function (d) { return d.getDay() && d.getDate() !== 1; }],
            ["%-m/%-d", function (d) { return d.getDate() !== 1; }],
            ["%-m/%-d", function (d) { return d.getMonth(); }],
            ["%Y/%-m/%-d", function () { return true; }]
        ]);

        $$.visibleTargetCount = config.data_hide === true ? 0 : (config.data_columns ? (config.data_columns.length - (config.data_hide ? config.data_hide.length : 0)) : 0);
        $$.hiddenTargetIds = [];
        $$.hiddenLegendIds = [];
        $$.focusedTargetIds = [];
        $$.defocusedTargetIds = [];

        $$.xOrient = config.axis_rotated ? "left" : "bottom";
        $$.yOrient = config.axis_rotated ? (config.axis_y_inner ? "top" : "bottom") : (config.axis_y_inner ? "right" : "left");
        $$.y2Orient = config.axis_rotated ? (config.axis_y2_inner ? "bottom" : "top") : (config.axis_y2_inner ? "left" : "right");
        $$.subXOrient = config.axis_rotated ? "left" : "bottom";

        $$.isLegendTopRight = config.legend_position === 'top-right';
        $$.isLegendRight = config.legend_position === 'right';
        $$.isLegendInset = config.legend_position === 'inset';
        $$.isLegendTop = config.legend_inset_anchor === 'top-left' || config.legend_inset_anchor === 'top-right';
        $$.isLegendLeft = config.legend_inset_anchor === 'top-left' || config.legend_inset_anchor === 'bottom-left';
        $$.legendStep = 0;
        $$.legendItemWidth = 0;
        $$.legendItemHeight = 0;

        $$.currentMaxTickWidths = {
            x: 0,
            y: 0,
            y2: 0
        };

        $$.rotated_padding_left = 30;
        $$.rotated_padding_right = config.axis_rotated && !config.axis_x_show ? 0 : 30;
        $$.rotated_padding_top = 5;

        $$.withoutFadeIn = {};

        $$.intervalForObserveInserted = undefined;

        $$.axes.subx = d3.selectAll([]); // needs when excluding subchart.js
    };

    c3_chart_internal_fn.initChartElements = function C3_INTERNAL_initChartElements() {
        if (this.initBar) { 
            this.initBar(); 
        }
        if (this.initLine) { 
            this.initLine(); 
        }
        if (this.initArc) { 
            this.initArc(); 
        }
        if (this.initGauge) { 
            this.initGauge(); 
        }
        if (this.initText) { 
            this.initText(); 
        }
    };

    c3_chart_internal_fn.initWithData = function C3_INTERNAL_initWithData(data) {
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config;
        var defs, main, 
            binding = true;

        $$.axis = new Axis($$);

        if ($$.initPie) { 
            $$.initPie(); 
        }
        if ($$.initBrush) { 
            $$.initBrush(); 
        }
        if ($$.initZoom) { 
            $$.initZoom(); 
        }

        if (!config.bindto) {
            $$.selectChart = d3.selectAll([]);
        }
        else if (typeof config.bindto.node === 'function') {
            $$.selectChart = config.bindto;
        }
        else {
            $$.selectChart = d3.select(config.bindto);
        }
        if ($$.selectChart.empty()) {
            $$.selectChart = d3.select(document.createElement('div')).style('opacity', 0);
            $$.observeInserted($$.selectChart);
            binding = false;
        }
        $$.selectChart.html("").classed("c3", true);

        // Init data as targets
        $$.data.xs = {};
        $$.data.targets = $$.convertDataToTargets(data);

        if (config.data_filter) {
            $$.data.targets = $$.data.targets.filter(config.data_filter);
        }

        // Set targets to hide if needed
        if (config.data_hide) {
            $$.addHiddenTargetIds(config.data_hide === true ? $$.mapToIds($$.data.targets) : config.data_hide);
        }
        if (config.legend_hide) {
            $$.addHiddenLegendIds(config.legend_hide === true ? $$.mapToIds($$.data.targets) : config.legend_hide);
        }

        // when gauge, hide legend // TODO: fix
        if ($$.hasType('gauge') && $$.config.data_columns.length <= 1) {
            config.legend_show = false;
        }

        // Init sizes and scales
        $$.updateSizes();
        $$.updateScales();

        // Set domains for each scale
        $$.x.domain(d3.extent($$.getXDomain($$.data.targets)));
        $$.y.domain($$.getYDomain($$.data.targets, 'y'));
        $$.y2.domain($$.getYDomain($$.data.targets, 'y2'));
        $$.subX.domain($$.x.domain());
        $$.subY.domain($$.y.domain());
        $$.subY2.domain($$.y2.domain());

        // Save original x domain for zoom update
        $$.orgXDomain = $$.x.domain();

        // Set initialized scales to brush and zoom
        if ($$.brush) { 
            $$.brush.scale($$.subX); 
        }
        if (config.zoom_enabled) { 
            $$.zoom.scale($$.x); 
        }

        /*-- Basic Elements --*/

        // Define svgs
        $$.svg = $$.selectChart.append("svg")
            .style("overflow", "hidden")
            .on('mouseenter', function () { 
                return config.onmouseover.call($$); 
            })
            .on('mouseleave', function () { 
                return config.onmouseout.call($$); 
            });

        if ($$.config.svg_classname) {
            $$.svg.attr('class', $$.config.svg_classname);
        }

        // Define defs
        defs = $$.svg.append("defs");
        $$.clipChart = $$.appendClip(defs, $$.clipId);
        $$.clipXAxis = $$.appendClip(defs, $$.clipIdForXAxis);
        $$.clipYAxis = $$.appendClip(defs, $$.clipIdForYAxis);
        $$.clipGrid = $$.appendClip(defs, $$.clipIdForGrid);
        $$.clipSubchart = $$.appendClip(defs, $$.clipIdForSubchart);
        $$.updateSvgSize();

        // Define regions
        main = $$.main = $$.svg.append("g").attr("transform", $$.getTranslate('main'));

        if ($$.initSubchart) { 
            $$.initSubchart(); 
        }
        if ($$.initHeader) { 
            $$.initHeader(); 
        }
        if ($$.initFooter) { 
            $$.initFooter(); 
        }
        if ($$.initTooltip) { 
            $$.initTooltip(); 
        }
        if ($$.initLegend) { 
            $$.initLegend(); 
        }
        if ($$.initTitle) { 
            $$.initTitle(); 
        }

        /*-- Main Region --*/

        // text when empty
        main.append("text")
            .attr("class", CLASS.text + ' ' + CLASS.empty)
            .attr("text-anchor", "middle") // horizontal centering of text at x position in all browsers.
            .attr("dominant-baseline", "middle"); // vertical centering of text at y position in all browsers, except IE.

        // Regions
        $$.initRegion();

        // Grids
        $$.initGrid();

        // Define g for chart area
        main.append('g')
            .attr("clip-path", $$.clipPath)
            .attr('class', CLASS.chart);

        // Grid lines
        if (config.grid_lines_front) { 
            $$.initGridLines(); 
        }

        // Cover whole with rects for events
        $$.initEventRect();

        // Define g for chart
        $$.initChartElements();

        // if zoom privileged, insert rect to forefront
        // TODO: is this needed?
        main.insert('rect', config.zoom_privileged ? null : 'g.' + CLASS.regions)
            .attr('class', CLASS.zoomRect)
            .attr('width', $$.width)
            .attr('height', $$.height)
            .style('opacity', 0)
            .on("dblclick.zoom", null);

        // Set default extent if defined
        if (config.axis_x_extent) { 
            $$.brush.extent($$.getDefaultExtent()); 
        }

        // Add Axis
        $$.axis.init();

        // Set targets
        $$.updateTargets($$.data.targets);

        // Draw with targets
        if (binding) {
            $$.updateDimension();
            $$.config.oninit.call($$);
            $$.redraw({
                withTransition: false,
                withTransform: true,
                withUpdateXDomain: true,
                withUpdateOrgXDomain: true,
                withTransitionForAxis: false
            });
        }

        // Bind resize event
        $$.bindResize();

        // export element of the chart
        $$.api.element = $$.selectChart.node();
    };

    c3_chart_internal_fn.smoothLines = function C3_INTERNAL_smoothLines(el, type) {
        var $$ = this;
        if (type === 'grid') {
            el.each(function () {
                var g = $$.d3.select(this),
                    x1 = g.attr('x1'),
                    x2 = g.attr('x2'),
                    y1 = g.attr('y1'),
                    y2 = g.attr('y2');
                g.attr({
                    'x1': Math.ceil(x1),
                    'x2': Math.ceil(x2),
                    'y1': Math.ceil(y1),
                    'y2': Math.ceil(y2)
                });
            });
        }
    };


    c3_chart_internal_fn.updateSizes = function C3_INTERNAL_updateSizes() {
        var $$ = this, 
            config = $$.config;
        var legendHeight = $$.legend ? $$.getLegendHeight() : 0,
            legendWidth = $$.legend ? $$.getLegendWidth() : 0,
            legendHeightForTop = $$.isLegendTopRight ? legendHeight + 20 : 0,
            legendHeightForBottom = $$.isLegendRight || $$.isLegendInset || $$.isLegendTopRight ? 0 : legendHeight,
            hasArc = $$.hasArcType(),
            xAxisHeight = config.axis_rotated || hasArc ? 0 : $$.getHorizontalAxisHeight('x'),
            subchartHeight = config.subchart_show && !hasArc ? (config.subchart_size_height + xAxisHeight) : 0;

        $$.currentWidth = $$.getCurrentWidth();
        $$.currentHeight = $$.getCurrentHeight();

        // for main
        $$.margin = config.axis_rotated ? {
            top: config.margin_top ? config.margin.top : $$.getHorizontalAxisHeight('y2') + $$.getCurrentPaddingTop() + legendHeightForTop,
            right: hasArc ? 0 : config.margin_right ? config.margin_right : $$.getCurrentPaddingRight(),
            bottom: config.margin_bottom ? config.margin_bottom : $$.getHorizontalAxisHeight('y') + legendHeightForBottom + $$.getCurrentPaddingBottom(),
            left: subchartHeight + (hasArc ? 0 : config.margin_left ? config.margin_left : $$.getCurrentPaddingLeft())
        } : {
            top: 4 + (config.margin_top ? config.margin.top : $$.getCurrentPaddingTop() + legendHeightForTop), // for top tick text
            right: hasArc ? 0 : config.margin_right ? config.margin_right : $$.getCurrentPaddingRight(),
            bottom: config.margin_bottom ? config.margin_bottom : xAxisHeight + subchartHeight + legendHeightForBottom + $$.getCurrentPaddingBottom(),
            left: hasArc ? 0 : config.margin_left ? config.margin_left : $$.getCurrentPaddingLeft()
        };

        // for subchart
        $$.margin2 = config.axis_rotated ? {
            top: $$.margin.top,
            right: NaN,
            bottom: 20 + legendHeightForBottom,
            left: $$.rotated_padding_left
        } : {
            top: $$.currentHeight - subchartHeight - legendHeightForBottom,
            right: NaN,
            bottom: xAxisHeight + legendHeightForBottom,
            left: $$.margin.left
        };

        // for legend
        $$.margin3 = {
            top: 0,
            right: NaN,
            bottom: 0,
            left: 0
        };
        if ($$.updateSizeForLegend) { 
            $$.updateSizeForLegend(legendHeight, legendWidth); 
        }

        $$.width = $$.currentWidth - $$.margin.left - $$.margin.right;
        $$.height = $$.currentHeight - $$.margin.top - $$.margin.bottom;
        if ($$.width < 0) { 
            $$.width = 0; 
        }
        if ($$.height < 0) { 
            $$.height = 0; 
        }

        $$.width2 = config.axis_rotated ? $$.margin.left - $$.rotated_padding_left - $$.rotated_padding_right : $$.width;
        $$.height2 = config.axis_rotated ? $$.height : $$.currentHeight - $$.margin2.top - $$.margin2.bottom;
        if ($$.width2 < 0) { 
            $$.width2 = 0; 
        }
        if ($$.height2 < 0) { 
            $$.height2 = 0; 
        }

        // for arc
        $$.arcWidth = $$.width - ($$.isLegendRight ? legendWidth + 10 : 0);
        $$.arcHeight = $$.height - ($$.isLegendRight ? 0 : 10);
        if ($$.hasType('gauge') && !config.gauge_fullCircle) {
            $$.arcHeight += $$.height - $$.getGaugeLabelHeight();
        }
        if ($$.updateRadius) { 
            $$.updateRadius(); 
        }

        if ($$.isLegendRight && hasArc) {
            $$.margin3.left = $$.arcWidth / 2 + $$.radiusExpanded * 1.1;
        }
    };

    c3_chart_internal_fn.updateTargets = function C3_INTERNAL_updateTargets(targets) {
        var $$ = this;

        /*-- Main --*/

        //-- Text --//
        $$.updateTargetsForText(targets);

        //-- Bar --//
        $$.updateTargetsForBar(targets);

        //-- Line --//
        $$.updateTargetsForLine(targets);

        //-- Arc --//
        if ($$.hasArcType() && $$.updateTargetsForArc) { 
            $$.updateTargetsForArc(targets); 
        }

        /*-- Sub --*/
        if ($$.updateTargetsForSubchart) { 
            $$.updateTargetsForSubchart(targets); 
        }

        // Fade-in each chart
        $$.showTargets();
    };
    c3_chart_internal_fn.showTargets = function C3_INTERNAL_showTargets() {
        var $$ = this;
        $$.svg.selectAll('.' + CLASS.target).filter(function (d) { 
                return $$.isTargetToShow(d.id); 
            })
          .transition().duration($$.config.transition_duration)
            .style("opacity", 1);
    };

    c3_chart_internal_fn.redraw = function C3_INTERNAL_redraw(options, transitions) {
        console.count('redraw');
        var $$ = this, 
            main = $$.main, 
            d3 = $$.d3, 
            config = $$.config;
        var areaIndices = $$.getShapeIndices($$.isAreaType), 
            barIndices = $$.getShapeIndices($$.isBarType), 
            lineIndices = $$.getShapeIndices($$.isLineType);
        var withY, withSubchart, withTransition, withTransitionForExit, withTransitionForAxis,
            withTransform, withUpdateXDomain, withUpdateOrgXDomain, withTrimXDomain, withLegend,
            withEventRect, withDimension, withUpdateXAxis;
        var hideAxis = $$.hasArcType();
        var drawArea, drawBar, drawLine, xForText, yForText;
        var duration, durationForExit, durationForAxis;
        var waitForDraw, flow;
        var targetsToShow = $$.filterTargetsToShow($$.data.targets), 
            tickValues, i, intervalForCulling, xDomainForZoom;
        var xv = $$.xv.bind($$), 
            cx, cy;

        options = options || {};
        withY = getOption(options, "withY", true);
        withSubchart = getOption(options, "withSubchart", true);
        withTransition = getOption(options, "withTransition", $$.config.transition_duration > 0);
        withTransform = getOption(options, "withTransform", false);
        withUpdateXDomain = getOption(options, "withUpdateXDomain", false);
        withUpdateOrgXDomain = getOption(options, "withUpdateOrgXDomain", false);
        withTrimXDomain = getOption(options, "withTrimXDomain", true);
        withUpdateXAxis = getOption(options, "withUpdateXAxis", withUpdateXDomain);
        withLegend = getOption(options, "withLegend", false);
        withEventRect = getOption(options, "withEventRect", true);
        withDimension = getOption(options, "withDimension", true);
        withTransitionForExit = getOption(options, "withTransitionForExit", withTransition);
        withTransitionForAxis = getOption(options, "withTransitionForAxis", withTransition);

        duration = withTransition ? config.transition_duration : 0;
        durationForExit = withTransitionForExit ? duration : 0;
        durationForAxis = withTransitionForAxis ? duration : 0;

        transitions = transitions || $$.axis.generateTransitions(durationForAxis);

        // update legend and transform each g
        if (withLegend && config.legend_show) {
            $$.updateLegend($$.mapToIds($$.data.targets), options, transitions);
        } else if (withDimension) {
            // need to update dimension (e.g. axis.y.tick.values) because y tick values should change
            // no need to update axis in it because they will be updated in redraw()
            $$.updateDimension(true);
        }

        // MEMO: needed for grids calculation
        if ($$.isCategorized() && targetsToShow.length === 0) {
            $$.x.domain([0, $$.axes.x.selectAll('.tick').size()]);
        }

        if (targetsToShow.length) {
            $$.updateXDomain(targetsToShow, withUpdateXDomain, withUpdateOrgXDomain, withTrimXDomain);
            if (!config.axis_x_tick_values) {
                tickValues = $$.axis.updateXAxisTickValues(targetsToShow);
            }
        } else {
            $$.xAxis.tickValues([]);
            $$.subXAxis.tickValues([]);
        }

        if (config.zoom_rescale && !options.flow) {
            xDomainForZoom = $$.x.orgDomain();
        }

        $$.y.domain($$.getYDomain(targetsToShow, 'y', xDomainForZoom));
        $$.y2.domain($$.getYDomain(targetsToShow, 'y2', xDomainForZoom));

        if (!config.axis_y_tick_values && config.axis_y_tick_count) {
            $$.yAxis.tickValues($$.axis.generateTickValues($$.y.domain(), config.axis_y_tick_count));
        }
        if (!config.axis_y2_tick_values && config.axis_y2_tick_count) {
            $$.y2Axis.tickValues($$.axis.generateTickValues($$.y2.domain(), config.axis_y2_tick_count));
        }

        // header background
        if ($$.redrawHeader) { 
            $$.redrawHeader(); 
        }

        // footer background
        if ($$.redrawFooter) { 
            $$.redrawFooter(); 
        }

        // axes
        $$.axis.redraw(transitions, hideAxis);

        // Update axis label
        $$.axis.updateLabels(withTransition);

        // show/hide if manual culling needed
        if ((withUpdateXDomain || withUpdateXAxis) && targetsToShow.length) {
            if (config.axis_x_tick_culling && tickValues) {
                for (i = 1; i < tickValues.length; i++) {
                    if (tickValues.length / i < config.axis_x_tick_culling_max) {
                        intervalForCulling = i;
                        break;
                    }
                }
                $$.svg.selectAll('.' + CLASS.axisX + ' .tick text').each(function (e) {
                    var index = tickValues.indexOf(e);
                    if (index >= 0) {
                        d3.select(this).style('display', index % intervalForCulling ? 'none' : 'block');
                    }
                });
            } else {
                $$.svg.selectAll('.' + CLASS.axisX + ' .tick text').style('display', 'block');
            }
        }

        // setup drawer - MEMO: these must be called after axis updated
        drawArea = $$.generateDrawArea ? $$.generateDrawArea(areaIndices, false) : undefined;
        drawBar = $$.generateDrawBar ? $$.generateDrawBar(barIndices) : undefined;
        drawLine = $$.generateDrawLine ? $$.generateDrawLine(lineIndices, false) : undefined;
        xForText = $$.generateXYForText(areaIndices, barIndices, lineIndices, true);
        yForText = $$.generateXYForText(areaIndices, barIndices, lineIndices, false);

        // Update sub domain
        if (withY) {
            $$.subY.domain($$.getYDomain(targetsToShow, 'y'));
            $$.subY2.domain($$.getYDomain(targetsToShow, 'y2'));
        }

        // xgrid focus
        $$.updateXgridFocus();

        // Data empty label positioning and text.
        main.select("text." + CLASS.text + '.' + CLASS.empty)
            .attr("x", $$.width / 2)
            .attr("y", $$.height / 2)
            .text(config.data_empty_label_text)
          .transition()
            .style('opacity', targetsToShow.length ? 0 : 1);

        // grid
        $$.updateGrid(duration);

        // rect for regions
        $$.updateRegion(duration);

        // bars
        $$.updateBar(durationForExit);

        // lines, areas and circles
        $$.updateLine(durationForExit);
        $$.updateArea(durationForExit);
        $$.updateCircle();

        // text
        if ($$.hasDataLabel()) {
            $$.updateText(durationForExit, barIndices);
        }

        // title
        if ($$.redrawTitle) { 
            $$.redrawTitle(); 
        }

        // arc
        if ($$.redrawArc) { 
            $$.redrawArc(duration, durationForExit, withTransform); 
        }

        // subchart
        if ($$.redrawSubchart) {
            $$.redrawSubchart(withSubchart, transitions, duration, durationForExit, areaIndices, barIndices, lineIndices);
        }

        // circles for select
        main.selectAll('.' + CLASS.selectedCircles)
            .filter($$.isBarType.bind($$))
            .selectAll('circle')
            .remove();

        // event rects will redrawn when flow called
        if (config.interaction_enabled && !options.flow && withEventRect) {
            $$.redrawEventRect();
            if ($$.updateZoom) { 
                $$.updateZoom(); 
            }
        }

        // update circleY based on updated parameters
        $$.updateCircleY();

        // generate circle x/y functions depending on updated params
        cx = ($$.config.axis_rotated ? $$.circleY : $$.circleX).bind($$);
        cy = ($$.config.axis_rotated ? $$.circleX : $$.circleY).bind($$);

        if (options.flow) {
            flow = $$.generateFlow({
                targets: targetsToShow,
                flow: options.flow,
                duration: options.flow.duration,
                drawBar: drawBar,
                drawLine: drawLine,
                drawArea: drawArea,
                cx: cx,
                cy: cy,
                xv: xv,
                xForText: xForText,
                yForText: yForText
            });
        }

        if ((duration || flow) && $$.isTabVisible()) { // Only use transition if tab visible. See #938.
            // transition should be derived from one transition
            main.transition().duration(duration).each(function () {
                var transitionsToWait = [];

                // redraw and gather transitions
                [
                    $$.redrawBar(drawBar, true),
                    $$.redrawLine(drawLine, true),
                    $$.redrawArea(drawArea, true),
                    $$.redrawCircle(cx, cy, true),
                    $$.redrawText(xForText, yForText, options.flow, true),
                    $$.redrawRegion(true),
                    $$.redrawGrid(true),
                ].forEach(function (transitions) {
                    transitions.forEach(function (transition) {
                        transitionsToWait.push(transition);
                    });
                });

                // Wait for end of transitions to call flow and onrendered callback
                waitForDraw = $$.generateWait();
                transitionsToWait.forEach(function (t) {
                    waitForDraw.add(t);
                });
            })
            .call(waitForDraw, function () {
                if (flow) {
                    flow();
                }
                if (config.onrendered) {
                    config.onrendered.call($$);
                }
            });
        }
        else {
            $$.redrawBar(drawBar);
            $$.redrawLine(drawLine);
            $$.redrawArea(drawArea);
            $$.redrawCircle(cx, cy);
            $$.redrawText(xForText, yForText, options.flow);
            $$.redrawRegion();
            $$.redrawGrid();
            if (config.onrendered) {
                config.onrendered.call($$);
            }
        }

        // update fadein condition
        $$.mapToIds($$.data.targets).forEach(function (id) {
            $$.withoutFadeIn[id] = true;
        });
    };

    c3_chart_internal_fn.updateAndRedraw = function C3_INTERNAL_updateAndRedraw(options) {
        console.count('updateAndRedraw');
        var $$ = this, 
            config = $$.config, 
            transitions;
        options = options || {};
        // same with redraw
        options.withTransition = getOption(options, "withTransition", $$.config.transition_duration > 0);
        options.withTransform = getOption(options, "withTransform", false);
        options.withLegend = getOption(options, "withLegend", false);
        // NOT same with redraw
        options.withUpdateXDomain = true;
        options.withUpdateOrgXDomain = true;
        options.withTransitionForExit = false;
        options.withTransitionForTransform = getOption(options, "withTransitionForTransform", options.withTransition);
        // MEMO: this needs to be called before updateLegend and it means this ALWAYS needs to be called)
        $$.updateSizes();
        // MEMO: called in updateLegend in redraw if withLegend
        if (!(options.withLegend && config.legend_show)) {
            transitions = $$.axis.generateTransitions(options.withTransitionForAxis ? config.transition_duration : 0);
            // Update scales
            $$.updateScales();
            $$.updateSvgSize();
            // Update g positions
            $$.transformAll(options.withTransitionForTransform, transitions);
        }
        // Draw with new sizes & scales
        $$.redraw(options, transitions);
    };
    c3_chart_internal_fn.redrawWithoutRescale = function C3_INTERNAL_redrawWithoutRescale() {
        console.count('redrawWithoutRescale');
        this.redraw({
            withY: false,
            withSubchart: false,
            withEventRect: false,
            withTransitionForAxis: false
        });
    };

    c3_chart_internal_fn.isTimeSeries = function C3_INTERNAL_isTimeSeries() {
        return this.config.axis_x_type === 'timeseries';
    };
    c3_chart_internal_fn.isCategorized = function C3_INTERNAL_isCategorized() {
        return this.config.axis_x_type.indexOf('categor') >= 0;             // accept both 'category' and 'categorized'
    };
    c3_chart_internal_fn.isCustomX = function C3_INTERNAL_isCustomX() {
        var $$ = this, 
            config = $$.config;
        return !$$.isTimeSeries() && (config.data_x || notEmpty(config.data_xs));
    };

    c3_chart_internal_fn.isTimeSeriesY = function C3_INTERNAL_isTimeSeriesY() {
        return this.config.axis_y_type === 'timeseries';
    };

    c3_chart_internal_fn.getTranslate = function C3_INTERNAL_getTranslate(target) {
        var $$ = this, 
            config = $$.config, 
            x, y;
        if (target === 'main') {
            x = asHalfPixel($$.margin.left);
            y = asHalfPixel($$.margin.top);
        } else if (target === 'context') {
            x = asHalfPixel($$.margin2.left);
            y = asHalfPixel($$.margin2.top);
        } else if (target === 'legend') {
            x = $$.margin3.left;
            y = $$.margin3.top;
        } else if (target === 'x') {
            x = 0;
            y = config.axis_rotated ? 0 : $$.height;
        } else if (target === 'y') {
            x = 0;
            y = config.axis_rotated ? $$.height : 0;
        } else if (target === 'y2') {
            x = config.axis_rotated ? 0 : $$.width;
            y = config.axis_rotated ? 1 : 0;
        } else if (target === 'subx') {
            x = 0;
            y = config.axis_rotated ? 0 : $$.height2;
        } else if (target === 'arc') {
            x = $$.arcWidth / 2;
            y = $$.arcHeight / 2;
        }
        return "translate(" + x + "," + y + ")";
    };
    c3_chart_internal_fn.initialOpacity = function C3_INTERNAL_initialOpacity(d) {
        return d.value !== null && this.withoutFadeIn[d.id] ? 1 : 0;
    };
    c3_chart_internal_fn.initialOpacityForCircle = function C3_INTERNAL_initialOpacityForCircle(d) {
        return d.value !== null && this.withoutFadeIn[d.id] ? this.opacityForCircle(d) : 0;
    };
    c3_chart_internal_fn.opacityForCircle = function C3_INTERNAL_opacityForCircle(d) {
        var opacity = this.config.point_show ? 1 : 0;
        return isValue(d.value) ? (this.isScatterType(d) ? this.config.point_scatter_opacity : opacity) : 0;
    };
    c3_chart_internal_fn.opacityForText = function C3_INTERNAL_opacityForText() {
        return this.hasDataLabel() ? 1 : 0;
    };
    c3_chart_internal_fn.xx = function C3_INTERNAL_xx(d) {
        return d ? this.x(d.x) : null;
    };
    c3_chart_internal_fn.xv = function C3_INTERNAL_xv(d) {
        var $$ = this, 
            value = d.value;
        if ($$.isTimeSeries()) {
            value = $$.parseDate(d.value);
        }
        else if ($$.isCategorized() && typeof d.value === 'string') {
            value = $$.config.axis_x_categories.indexOf(d.value);
        }
        return Math.ceil($$.x(value));
    };
    c3_chart_internal_fn.yv = function C3_INTERNAL_yv(d) {
        var $$ = this,
            yScale = d.axis && d.axis === 'y2' ? $$.y2 : $$.y;
        return Math.ceil(yScale(d.value));
    };
    c3_chart_internal_fn.subxx = function C3_INTERNAL_subxx(d) {
        return d ? this.subX(d.x) : null;
    };

    c3_chart_internal_fn.transformMain = function C3_INTERNAL_transformMain(withTransition, transitions) {
        var $$ = this,
            xAxis, yAxis, y2Axis;
        if (transitions && transitions.axisX) {
            xAxis = transitions.axisX;
        } else {
            xAxis = $$.main.select('.' + CLASS.axisX);
            if (withTransition) { 
                xAxis = xAxis.transition(); 
            }
        }
        if (transitions && transitions.axisY) {
            yAxis = transitions.axisY;
        } else {
            yAxis = $$.main.select('.' + CLASS.axisY);
            if (withTransition) { 
                yAxis = yAxis.transition(); 
            }
        }
        if (transitions && transitions.axisY2) {
            y2Axis = transitions.axisY2;
        } else {
            y2Axis = $$.main.select('.' + CLASS.axisY2);
            if (withTransition) { 
                y2Axis = y2Axis.transition(); 
            }
        }
        (withTransition ? $$.main.transition() : $$.main).attr("transform", $$.getTranslate('main'));
        xAxis.attr("transform", $$.getTranslate('x'));
        yAxis.attr("transform", $$.getTranslate('y'));
        y2Axis.attr("transform", $$.getTranslate('y2'));
        $$.main.select('.' + CLASS.chartArcs).attr("transform", $$.getTranslate('arc'));
    };

    c3_chart_internal_fn.transformAll = function C3_INTERNAL_transformAll(withTransition, transitions) {
        var $$ = this;
        $$.transformMain(withTransition, transitions);
        if ($$.config.subchart_show) { 
            $$.transformContext(withTransition, transitions); 
        }
        if ($$.legend) { 
            $$.transformLegend(withTransition); 
        }
    };

    c3_chart_internal_fn.updateSvgSize = function C3_INTERNAL_updateSvgSize() {
        var $$ = this,
            brush = $$.svg.select(".c3-brush .background");
        $$.svg.attr('width', $$.currentWidth).attr('height', $$.currentHeight);
        $$.svg.selectAll(['#' + $$.clipIdForGrid,'#' + $$.clipId].join(',')).select('rect')
            .attr('width', $$.width)
            .attr('height', $$.height);
        $$.svg.select('#' + $$.clipIdForXAxis).select('rect')
            .attr('x', $$.getXAxisClipX.bind($$))
            .attr('y', $$.getXAxisClipY.bind($$))
            .attr('width', $$.getXAxisClipWidth.bind($$))
            .attr('height', $$.getXAxisClipHeight.bind($$));
        $$.svg.select('#' + $$.clipIdForYAxis).select('rect')
            .attr('x', $$.getYAxisClipX.bind($$))
            .attr('y', $$.getYAxisClipY.bind($$))
            .attr('width', $$.getYAxisClipWidth.bind($$))
            .attr('height', $$.getYAxisClipHeight.bind($$));
        $$.svg.select('#' + $$.clipIdForSubchart).select('rect')
            .attr('width', $$.width)
            .attr('height', brush.size() ? brush.attr('height') : 0);
        $$.svg.select('.' + CLASS.zoomRect)
            .attr('width', $$.width)
            .attr('height', $$.height);
        // MEMO: parent div's height will be bigger than svg when <!DOCTYPE html>
        $$.selectChart.style('max-height', $$.currentHeight + "px");
    };


    c3_chart_internal_fn.updateDimension = function C3_INTERNAL_updateDimension(withoutAxis) {
        var $$ = this;
        if (!withoutAxis) {
            if ($$.config.axis_rotated) {
                $$.axes.x.call($$.xAxis);
                $$.axes.subx.call($$.subXAxis);
            } else {
                var axis = $$.axes.y.call($$.yAxis);
                if (!$$.config.axis_y_showLine) {
                    axis.select('path').style('visibility', 'hidden');
                }
                $$.axes.y2.call($$.y2Axis);
            }
        }
        $$.updateSizes();
        $$.updateScales();
        $$.updateSvgSize();
        $$.transformAll(false);
    };

    c3_chart_internal_fn.observeInserted = function C3_INTERNAL_observeInserted(selection) {
        var $$ = this, 
            observer;
        if (typeof MutationObserver === 'undefined') {
            window.console.error("MutationObserver not defined.");
            return;
        }
        observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'childList' && mutation.previousSibling) {
                    observer.disconnect();
                    // need to wait for completion of load because size calculation requires the actual sizes determined after that completion
                    $$.intervalForObserveInserted = window.setInterval(function () {
                        // parentNode will NOT be null when completed
                        if (selection.node().parentNode) {
                            window.clearInterval($$.intervalForObserveInserted);
                            $$.updateDimension();
                            if ($$.brush) { $$.brush.update(); }
                            $$.config.oninit.call($$);
                            $$.redraw({
                                withTransform: true,
                                withUpdateXDomain: true,
                                withUpdateOrgXDomain: true,
                                withTransition: false,
                                withTransitionForTransform: false,
                                withLegend: true
                            });
                            selection.transition().style('opacity', 1);
                        }
                    }, 10);
                }
            });
        });
        observer.observe(selection.node(), {attributes: true, childList: true, characterData: true});
    };

    c3_chart_internal_fn.bindResize = function C3_INTERNAL_bindResize() {
        var $$ = this, config = $$.config;

        $$.resizeFunction = $$.generateResize();

        $$.resizeFunction.add(function C3_INTERNAL_execConfigOnResize() {
            config.onresize.call($$);
        });
        if (config.resize_auto) {
            $$.resizeFunction.add(function C3_INTERNAL_execResizeAuto() {
                if (config.resize_timeout) {
                if ($$.resizeTimeout !== undefined) {
                    window.clearTimeout($$.resizeTimeout);
                }
                    $$.resizeTimeout = window.setTimeout(function C3_INTERNAL_execResizeAutoFlush() {
                        delete $$.resizeTimeout;
                        $$.api.flush();
                    }, config.resize_timeout);
                } else {
                    $$.api.flush();
                }
            });
        }
        $$.resizeFunction.add(function C3_INTERNAL_execConfigOnResized() {
            config.onresized.call($$);
        });

        if (window.attachEvent) {
            window.attachEvent('onresize', $$.resizeFunction);
        } else if (window.addEventListener) {
            window.addEventListener('resize', $$.resizeFunction, false);
        } else {
            // fallback to this, if this is a very old browser
            var wrapper = window.onresize;
            if (!wrapper) {
                // create a wrapper that will call all charts
                wrapper = $$.generateResize();
            } else if (!wrapper.add || !wrapper.remove) {
                // there is already a handler registered, make sure we call it too
                wrapper = $$.generateResize();
                wrapper.add(window.onresize);
            }
            // add this graph to the wrapper, we will be removed if the user calls destroy
            wrapper.add($$.resizeFunction);
            window.onresize = wrapper;
        }
    };

    c3_chart_internal_fn.generateResize = function C3_INTERNAL_generateResize() {
        console.count('generateResize');
        var resizeFunctions = [];
        function callResizeFunctions() {
            resizeFunctions.forEach(function C3_INTERNAL_execResizeFunction(f) {
                f();
            });
        }
        callResizeFunctions.add = function C3_INTERNAL_addResizeFunction(f) {
            resizeFunctions.push(f);
        };
        callResizeFunctions.remove = function C3_INTERNAL_removeResizeFunction(f) {
            for (var i = 0; i < resizeFunctions.length; i++) {
                if (resizeFunctions[i] === f) {
                    resizeFunctions.splice(i, 1);
                    break;
                }
            }
        };
        return callResizeFunctions;
    };

    c3_chart_internal_fn.endall = function C3_INTERNAL_endall(transition, callback) {
        var n = 0;
        transition
            .each(function () { 
                ++n; 
            })
            .each("end", function () {
                if (!--n) { 
                    callback.apply(this, arguments); 
                }
            });
    };
    c3_chart_internal_fn.generateWait = function C3_INTERNAL_generateWait() {
        var transitionsToWait = [],
            f = function (transition, callback) {
                var timer = setInterval(function () {
                    var done = 0;
                    transitionsToWait.forEach(function (t) {
                        if (t.empty()) {
                            done += 1;
                            return;
                        }
                        try {
                            t.transition();
                        } catch (e) {
                            done += 1;
                        }
                    });
                    if (done === transitionsToWait.length) {
                        clearInterval(timer);
                        if (callback) { callback(); }
                    }
                }, 10);
            };
        f.add = function (transition) {
            transitionsToWait.push(transition);
        };
        return f;
    };

    c3_chart_internal_fn.parseDate = function C3_INTERNAL_parseDate(date) {
        var $$ = this, parsedDate;
        if (date instanceof Date) {
            parsedDate = date;
        } else if (typeof date === 'string') {
            parsedDate = $$.dataTimeFormat($$.config.data_xFormat).parse(date);
        } else if (typeof date === 'number' && !isNaN(date)) {
            parsedDate = new Date(+date);
        }
        if (!parsedDate || isNaN(+parsedDate)) {
            window.console.error("Failed to parse x '" + date + "' to Date object");
        }
        return parsedDate;
    };

    c3_chart_internal_fn.isTabVisible = function C3_INTERNAL_isTabVisible() {
        var hidden;
        if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
            hidden = "hidden";
        } else if (typeof document.mozHidden !== "undefined") {
            hidden = "mozHidden";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
        }

        return document[hidden] ? false : true;
    };

    c3_chart_internal_fn.getDefaultConfig = function C3_INTERNAL_getDefaultConfig() {
        var config = {
            bindto: '#chart',
            svg_classname: undefined,
            size_width: undefined,
            size_height: undefined,
            padding_left: undefined,
            padding_right: undefined,
            padding_top: undefined,
            padding_bottom: undefined,
            margin_left: undefined,
            margin_right: undefined,
            margin_top: undefined,
            margin_bottom: undefined,
            resize_auto: true,
            resize_timeout: 100,
            zoom_enabled: false,
            zoom_extent: undefined,
            zoom_privileged: false,
            zoom_rescale: false,
            zoom_onzoom: function () {},
            zoom_onzoomstart: function () {},
            zoom_onzoomend: function () {},
            zoom_x_min: undefined,
            zoom_x_max: undefined,
            interaction_brighten: true,
            interaction_enabled: true,
            onmouseover: function () {},
            onmouseout: function () {},
            onresize: function () {},
            onresized: function () {},
            oninit: function () {},
            onrendered: function () {},
            transition_duration: 350,
            data_x: undefined,
            data_xs: {},
            data_xFormat: '%Y-%m-%d',
            data_xLocaltime: true,
            data_xSort: true,
            data_idConverter: function (id) { return id; },
            data_names: {},
            data_classes: {},
            data_groups: [],
            data_axes: {},
            data_type: undefined,
            data_types: {},
            data_labels: {},
            data_order: 'desc',
            data_regions: {},
            data_color: undefined,
            data_colors: {},
            data_opacity: undefined,
            data_calculateOpacity: {},
            data_hide: false,
            data_filter: undefined,
            data_selection_enabled: false,
            data_selection_grouped: false,
            data_selection_isselectable: function () { return true; },
            data_selection_multiple: true,
            data_selection_draggable: false,
            data_onclick: function () {},
            data_onmouseover: function () {},
            data_onmouseout: function () {},
            data_onselected: function () {},
            data_onunselected: function () {},
            data_ondragstart: function () {},
            data_ondragend: function () {},
            data_url: undefined,
            data_headers: undefined,
            data_json: undefined,
            data_rows: undefined,
            data_columns: undefined,
            data_mimeType: undefined,
            data_keys: undefined,
            // configuration for no plot-able data supplied.
            data_empty_label_text: "",
            // subchart
            subchart_show: false,
            subchart_type: undefined,
            subchart_types: {},
            subchart_line_step_type: 'step',
            subchart_line_spline_type: 'cardinal',
            subchart_size_height: 60,
            subchart_axis_x_show: true,
            subchart_onbrush: function () {},
            // color
            color_pattern: [],
            color_threshold: {},
            // legend
            legend_show: true,
            legend_hide: false,
            legend_position: 'bottom',
            legend_inset_anchor: 'top-left',
            legend_inset_x: 10,
            legend_inset_y: 0,
            legend_inset_step: undefined,
            legend_item_onclick: undefined,
            legend_item_onmouseover: undefined,
            legend_item_onmouseout: undefined,
            legend_equally: false,
            legend_padding: 0,
            legend_item_tile_width: 10,
            legend_item_tile_height: 10,
            // axis
            axis_rotated: false,
            axis_x_show: true,
            axis_x_clip: false,
            axis_x_type: 'indexed',
            axis_x_scale_type: undefined,
            axis_x_localtime: true,
            axis_x_categories: [],
            axis_x_tick_automatic: false,
            axis_x_tick_centered: false,
            axis_x_tick_format: undefined,
            axis_x_tick_culling: {},
            axis_x_tick_culling_max: 10,
            axis_x_tick_count: undefined,
            axis_x_tick_fit: true,
            axis_x_tick_values: null,
            axis_x_tick_rotate: 0,
            axis_x_tick_outer: true,
            axis_x_tick_multiline: true,
            axis_x_tick_width: null,
            axis_x_max: undefined,
            axis_x_min: undefined,
            axis_x_padding: {},
            axis_x_height: undefined,
            axis_x_extent: undefined,
            axis_x_label: {},
            axis_y_show: true,
            axis_y_type: undefined,
            axis_y_scale_type: undefined,
            axis_y_max: undefined,
            axis_y_min: undefined,
            axis_y_inverted: false,
            axis_y_center: undefined,
            axis_y_inner: undefined,
            axis_y_label: {},
            axis_y_tick_format: undefined,
            axis_y_tick_outer: true,
            axis_y_tick_multiline: false,
            axis_y_tick_width: null,
            axis_y_tick_values: null,
            axis_y_tick_rotate: 0,
            axis_y_tick_count: undefined,
            axis_y_tick_time_value: undefined,
            axis_y_tick_time_interval: undefined,
            axis_y_padding: {},
            axis_y_default: undefined,
            axis_y_showLine: true,
            axis_y2_show: false,
            axis_y2_max: undefined,
            axis_y2_min: undefined,
            axis_y2_inverted: false,
            axis_y2_center: undefined,
            axis_y2_inner: undefined,
            axis_y2_label: {},
            axis_y2_tick_format: undefined,
            axis_y2_tick_outer: true,
            axis_y2_tick_multiline: false,
            axis_y2_tick_width: null,
            axis_y2_tick_values: null,
            axis_y2_tick_rotate: 0,
            axis_y2_tick_count: undefined,
            axis_y2_padding: {},
            axis_y2_default: undefined,
            // grid
            grid_x_show: false,
            grid_x_type: 'tick',
            grid_x_lines: [],
            grid_y_show: false,
            // not used
            // grid_y_type: 'tick',
            grid_y_lines: [],
            grid_y_ticks: 10,
            grid_focus_show: true,
            grid_lines_front: true,
            // point - point of each data
            point_show: true,
            point_r: 2.5,
            point_sensitivity: 10,
            point_animation: false,
            point_focus_expand_enabled: true,
            point_focus_expand_r: undefined,
            point_select_r: undefined,
            point_scatter_opacity: 0.5,
            // line
            line_connectNull: false,
            line_step_type: 'step',
            line_spline_type: 'cardinal',
            // bar
            bar_width: undefined,
            bar_width_ratio: 0.6,
            bar_width_max: undefined,
            bar_zerobased: true,
            // area
            area_zerobased: true,
            line_zerobased: false,
            area_above: false,
            // pie
            pie_label_show: true,
            pie_label_format: undefined,
            pie_label_threshold: 0.05,
            pie_label_ratio: undefined,
            pie_expand: {},
            pie_expand_duration: 50,
            // gauge
            gauge_fullCircle: false,
            gauge_label_show: true,
            gauge_label_formatall: false,
            gauge_label_transition: true,
            gauge_label_format: undefined,
            gauge_min: 0,
            gauge_max: 100,
            gauge_startingAngle: -1 * Math.PI/2,
            gauge_units: undefined,
            gauge_width: undefined,
            gauge_arcs_minWidth: 5,
            gauge_expand: {},
            gauge_expand_duration: 50,
            // donut
            donut_label_show: true,
            donut_label_format: undefined,
            donut_label_threshold: 0.05,
            donut_label_ratio: undefined,
            donut_width: undefined,
            donut_title: "",
            donut_subtitle: "",
            donut_expand: {},
            donut_expand_duration: 50,
            // spline
            spline_interpolation_type: 'cardinal',
            // region - region to change style
            regions: [],
            // tooltip - show when mouseover on each data
            tooltip_show: true,
            tooltip_animation_show: false,
            tooltip_animation_delay: 0,
            tooltip_animation_duration: 350,
            tooltip_animation_ease: "linear",
            tooltip_grouped: true,
            tooltip_format_title: undefined,
            tooltip_format_name: undefined,
            tooltip_format_value: undefined,
            tooltip_position: undefined,
            tooltip_contents: function (d, defaultTitleFormat, defaultValueFormat, color) {
                return this.getTooltipContent ? this.getTooltipContent(d, defaultTitleFormat, defaultValueFormat, color) : '';
            },
            tooltip_init_show: false,
            tooltip_init_x: 0,
            tooltip_init_position: {top: '0px', left: '50px'},
            tooltip_onshow: function () {},
            tooltip_onhide: function () {},
            // title
            title_text: undefined,
            title_padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
            title_position: 'top-center',
            title_x: 0,
            title_y: 0,
            // header
            header_show: false,
            header_height: 15,
            header_color: '#FFF',
            header_border_show: false,
            header_border_color: '#000',
            header_border_width: 1,
            // footer
            footer_show: false,
            footer_height: 15,
            footer_color: '#FFF',
            footer_border_show: false,
            footer_border_color: '#000',
            footer_border_width: 1,
            // save/load in JSON format
            json_original: undefined,
        };

        Object.keys(this.additionalConfig).forEach(function (key) {
            config[key] = this.additionalConfig[key];
        }, this);

        return config;
    };
    c3_chart_internal_fn.additionalConfig = {};

    c3_chart_internal_fn.loadConfig = function C3_INTERNAL_loadConfig(config) {
        var this_config = this.config, target, keys, read;
        function find() {
            var key = keys.shift();
    //        console.log("key =>", key, ", target =>", target);
            if (key && target && typeof target === 'object' && key in target) {
                target = target[key];
                return find();
            }
            else if (!key) {
                return target;
            }
            else {
                return undefined;
            }
        }
        Object.keys(this_config).forEach(function (key) {
            target = config;
            keys = key.split('_');
            read = find();
    //        console.log("CONFIG : ", key, read);
            if (isDefined(read)) {
                this_config[key] = read;
            }
        });
    };

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

    c3_chart_internal_fn.getYDomainMin = function C3_INTERNAL_getYDomainMin(targets) {
        var $$ = this, 
            config = $$.config,
            ids = $$.mapToIds(targets), 
            ys = $$.getValuesAsIdKeyed(targets),
            j, k, baseId, idsInGroup, id, hasNegativeValue;
        if (config.data_groups.length > 0) {
            hasNegativeValue = $$.hasNegativeValueInTargets(targets);
            for (j = 0; j < config.data_groups.length; j++) {
                // Determine baseId
                idsInGroup = config.data_groups[j].filter(function (id) { 
                    return ids.indexOf(id) >= 0; 
                });
                if (idsInGroup.length === 0) { continue; }
                baseId = idsInGroup[0];
                // Consider negative values
                if (hasNegativeValue && ys[baseId]) {
                    ys[baseId].forEach(function (v, i) {
                        ys[baseId][i] = v < 0 ? v : 0;
                    });
                }
                // Compute min
                for (k = 1; k < idsInGroup.length; k++) {
                    id = idsInGroup[k];
                    if (!ys[id]) { continue; }
                    ys[id].forEach(function (v, i) {
                        if ($$.axis.getId(id) === $$.axis.getId(baseId) && ys[baseId] && !(hasNegativeValue && +v > 0)) {
                            ys[baseId][i] += +v;
                        }
                    });
                }
            }
        }
        return $$.d3.min(Object.keys(ys).map(function (key) { 
            return $$.d3.min(ys[key]); 
        }));
    };
    c3_chart_internal_fn.getYDomainMax = function C3_INTERNAL_getYDomainMax(targets) {
        var $$ = this, 
            config = $$.config,
            ids = $$.mapToIds(targets), 
            ys = $$.getValuesAsIdKeyed(targets),
            j, k, baseId, idsInGroup, id, hasPositiveValue;
        if (config.data_groups.length > 0) {
            hasPositiveValue = $$.hasPositiveValueInTargets(targets);
            for (j = 0; j < config.data_groups.length; j++) {
                // Determine baseId
                idsInGroup = config.data_groups[j].filter(function (id) { 
                    return ids.indexOf(id) >= 0; 
                });
                if (idsInGroup.length === 0) { continue; }
                baseId = idsInGroup[0];
                // Consider positive values
                if (hasPositiveValue && ys[baseId]) {
                    ys[baseId].forEach(function (v, i) {
                        ys[baseId][i] = v > 0 ? v : 0;
                    });
                }
                // Compute max
                for (k = 1; k < idsInGroup.length; k++) {
                    id = idsInGroup[k];
                    if (!ys[id]) { continue; }
                    ys[id].forEach(function (v, i) {
                        if ($$.axis.getId(id) === $$.axis.getId(baseId) && ys[baseId] && !(hasPositiveValue && +v < 0)) {
                            ys[baseId][i] += +v;
                        }
                    });
                }
            }
        }
        return $$.d3.max(Object.keys(ys).map(function (key) { 
            return $$.d3.max(ys[key]); 
        }));
    };
    c3_chart_internal_fn.getYDomain = function C3_INTERNAL_getYDomain(targets, axisId, xDomain) {
        var $$ = this, 
            config = $$.config,
            targetsByAxisId = targets.filter(function (t) { 
                return $$.axis.getId(t.id) === axisId; 
            }),
            yTargets = xDomain ? $$.filterByXDomain(targetsByAxisId, xDomain) : targetsByAxisId,
            yMin = axisId === 'y2' ? config.axis_y2_min : config.axis_y_min,
            yMax = axisId === 'y2' ? config.axis_y2_max : config.axis_y_max,
            yDomainMin = $$.getYDomainMin(yTargets),
            yDomainMax = $$.getYDomainMax(yTargets),
            domain, domainLength, padding, padding_top, padding_bottom,
            center = axisId === 'y2' ? config.axis_y2_center : config.axis_y_center,
            yDomainAbs, lengths, diff, ratio, isAllPositive, isAllNegative,
            isZeroBased = ($$.hasType('bar', yTargets) && config.bar_zerobased) ||
                ($$.hasType('area', yTargets) && config.area_zerobased) ||
                ($$.hasType('line', yTargets) && config.line_zerobased),
            isInverted = axisId === 'y2' ? config.axis_y2_inverted : config.axis_y_inverted,
            showHorizontalDataLabel = $$.hasDataLabel() && config.axis_rotated,
            showVerticalDataLabel = $$.hasDataLabel() && !config.axis_rotated;

        // MEMO: avoid inverting domain unexpectedly
        yDomainMin = isValue(yMin) ? yMin : isValue(yMax) ? (yDomainMin < yMax ? yDomainMin : yMax - 10) : yDomainMin;
        yDomainMax = isValue(yMax) ? yMax : isValue(yMin) ? (yMin < yDomainMax ? yDomainMax : yMin + 10) : yDomainMax;

        if (yTargets.length === 0) { // use current domain if target of axisId is none
            return axisId === 'y2' ? $$.y2.domain() : $$.y.domain();
        }
        if (isNaN(yDomainMin)) { // set minimum to zero when not number
            yDomainMin = 0;
        }
        if (isNaN(yDomainMax)) { // set maximum to have same value as yDomainMin
            yDomainMax = yDomainMin;
        }
        if (yDomainMin === yDomainMax) {
            yDomainMin < 0 ? yDomainMax = 0 : yDomainMin = 0;
        }
        isAllPositive = yDomainMin >= 0 && yDomainMax >= 0;
        isAllNegative = yDomainMin <= 0 && yDomainMax <= 0;

        // Cancel zerobased if axis_*_min / axis_*_max specified
        if ((isValue(yMin) && isAllPositive) || (isValue(yMax) && isAllNegative)) {
            isZeroBased = false;
        }

        // Bar/Area chart should be 0-based if all positive|negative
        if (isZeroBased) {
            if (isAllPositive) { yDomainMin = 0; }
            if (isAllNegative) { yDomainMax = 0; }
        }

        domainLength = Math.abs(yDomainMax - yDomainMin);
        padding = padding_top = padding_bottom = domainLength * 0.1;

        if (typeof center !== 'undefined') {
            yDomainAbs = Math.max(Math.abs(yDomainMin), Math.abs(yDomainMax));
            yDomainMax = center + yDomainAbs;
            yDomainMin = center - yDomainAbs;
        }
        // add padding for data label
        if (showHorizontalDataLabel) {
            lengths = $$.getDataLabelLength(yDomainMin, yDomainMax, 'width');
            diff = diffDomain($$.y.range());
            ratio = [lengths[0] / diff, lengths[1] / diff];
            padding_top += domainLength * (ratio[1] / (1 - ratio[0] - ratio[1]));
            padding_bottom += domainLength * (ratio[0] / (1 - ratio[0] - ratio[1]));
        } else if (showVerticalDataLabel) {
            lengths = $$.getDataLabelLength(yDomainMin, yDomainMax, 'height');
            padding_top += $$.axis.convertPixelsToAxisPadding(lengths[1], domainLength);
            padding_bottom += $$.axis.convertPixelsToAxisPadding(lengths[0], domainLength);
        }
        if (axisId === 'y' && notEmpty(config.axis_y_padding)) {
            padding_top = $$.axis.getPadding(config.axis_y_padding, 'top', padding_top, domainLength);
            padding_bottom = $$.axis.getPadding(config.axis_y_padding, 'bottom', padding_bottom, domainLength);
        }
        if (axisId === 'y2' && notEmpty(config.axis_y2_padding)) {
            padding_top = $$.axis.getPadding(config.axis_y2_padding, 'top', padding_top, domainLength);
            padding_bottom = $$.axis.getPadding(config.axis_y2_padding, 'bottom', padding_bottom, domainLength);
        }
        // Bar/Area chart should be 0-based if all positive|negative
        if (isZeroBased) {
            if (isAllPositive) { padding_bottom = yDomainMin; }
            if (isAllNegative) { padding_top = -yDomainMax; }
        }
        domain = [yDomainMin - padding_bottom, yDomainMax + padding_top];
        return isInverted ? domain.reverse() : domain;
    };
    c3_chart_internal_fn.getXDomainMin = function C3_INTERNAL_getXDomainMin(targets) {
        var $$ = this, 
            config = $$.config;
        return isDefined(config.axis_x_min) ?
            ($$.isTimeSeries() ? this.parseDate(config.axis_x_min) : config.axis_x_min) :
            $$.d3.min(targets, function (t) { 
                return $$.d3.min(t.values, function (v) { 
                    return v.x; 
                }); 
            });
    };
    c3_chart_internal_fn.getXDomainMax = function C3_INTERNAL_getXDomainMax(targets) {
        var $$ = this, 
            config = $$.config;
        return isDefined(config.axis_x_max) ?
            ($$.isTimeSeries() ? this.parseDate(config.axis_x_max) : config.axis_x_max) :
            $$.d3.max(targets, function (t) { 
                return $$.d3.max(t.values, function (v) { 
                    return v.x; 
                }); 
            });
    };
    c3_chart_internal_fn.getXDomainPadding = function C3_INTERNAL_getXDomainPadding(domain) {
        var $$ = this, 
            config = $$.config,
            diff = domain[1] - domain[0],
            maxDataCount, padding, paddingLeft, paddingRight;
        if ($$.isCategorized()) {
            padding = 0;
        } else if ($$.hasType('bar')) {
            maxDataCount = $$.getMaxDataCount();
            padding = maxDataCount > 1 ? (diff / (maxDataCount - 1)) / 2 : 0.5;
        } else {
            padding = diff * 0.01;
        }
        if (typeof config.axis_x_padding === 'object' && notEmpty(config.axis_x_padding)) {
            paddingLeft = isValue(config.axis_x_padding.left) ? config.axis_x_padding.left : padding;
            paddingRight = isValue(config.axis_x_padding.right) ? config.axis_x_padding.right : padding;
        } else if (typeof config.axis_x_padding === 'number') {
            paddingLeft = paddingRight = config.axis_x_padding;
        } else {
            paddingLeft = paddingRight = padding;
        }
        return {
            left: paddingLeft, 
            right: paddingRight
        };
    };
    c3_chart_internal_fn.getXDomain = function C3_INTERNAL_getXDomain(targets) {
        var $$ = this,
            xDomain = [$$.getXDomainMin(targets), $$.getXDomainMax(targets)],
            firstX = xDomain[0], 
            lastX = xDomain[1],
            padding = $$.getXDomainPadding(xDomain),
            min = 0, 
            max = 0;
        // show center of x domain if min and max are the same
        if ((firstX - lastX) === 0 && !$$.isCategorized()) {
            if ($$.isTimeSeries()) {
                firstX = new Date(firstX.getTime() * 0.5);
                lastX = new Date(lastX.getTime() * 1.5);
            } else {
                firstX = firstX === 0 ? 1 : (firstX * 0.5);
                lastX = lastX === 0 ? -1 : (lastX * 1.5);
            }
        }
        if (firstX || firstX === 0) {
            min = $$.isTimeSeries() ? new Date(firstX.getTime() - padding.left) : firstX - padding.left;
        }
        if (lastX || lastX === 0) {
            max = $$.isTimeSeries() ? new Date(lastX.getTime() + padding.right) : lastX + padding.right;
        }
        return [min, max];
    };
    c3_chart_internal_fn.updateXDomain = function C3_INTERNAL_updateXDomain(targets, withUpdateXDomain, withUpdateOrgXDomain, withTrim, domain) {
        var $$ = this, 
            config = $$.config;

        if (withUpdateOrgXDomain) {
            $$.x.domain(domain ? domain : $$.d3.extent($$.getXDomain(targets)));
            $$.orgXDomain = $$.x.domain();
            if (config.zoom_enabled) { 
                $$.zoom.scale($$.x).updateScaleExtent(); 
            }
            $$.subX.domain($$.x.domain());
            if ($$.brush) { 
                $$.brush.scale($$.subX); 
            }
        }
        if (withUpdateXDomain) {
            $$.x.domain(domain ? domain : (!$$.brush || $$.brush.empty()) ? $$.orgXDomain : $$.brush.extent());
            if (config.zoom_enabled) { 
                $$.zoom.scale($$.x).updateScaleExtent(); 
            }
        }

        // Trim domain when too big by zoom mousemove event
        if (withTrim) { 
            $$.x.domain($$.trimXDomain($$.x.orgDomain())); 
        }

        return $$.x.domain();
    };
    c3_chart_internal_fn.trimXDomain = function C3_INTERNAL_trimXDomain(domain) {
        var zoomDomain = this.getZoomDomain(),
            min = zoomDomain[0], 
            max = zoomDomain[1];
        if (domain[0] <= min) {
            domain[1] = +domain[1] + (min - domain[0]);
            domain[0] = min;
        }
        if (max <= domain[1]) {
            domain[0] = +domain[0] - (domain[1] - max);
            domain[1] = max;
        }
        return domain;
    };

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
        return ids ? [].concat(ids) : $$.mapToIds($$.data.targets);
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
        xs = $$.isTimeSeries() ? xs.map(function (x) { 
            return new Date(+x); 
        }) : xs.map(function (x) { 
            return +x; 
        });
        return xs.sort(function (a, b) { 
            return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN; 
        });
    };
    c3_chart_internal_fn.addHiddenTargetIds = function C3_INTERNAL_addHiddenTargetIds(targetIds) {
        this.hiddenTargetIds = this.hiddenTargetIds.concat(targetIds);
        this.visibleTargetCount -= targetIds.length;
    };
    c3_chart_internal_fn.removeHiddenTargetIds = function C3_INTERNAL_removeHiddenTargetIds(targetIds) {
        this.hiddenTargetIds = this.hiddenTargetIds.filter(function (id) { 
            return targetIds.indexOf(id) < 0; 
        });
        this.visibleTargetCount += targetIds.length;
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
        } else if (config.data_order === "reverse") {
            targets.reverse();
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
        var converted, 
            i;

        if (!this.isCategorized()) {
            return values;
        }
            
        converted = values.slice(0);

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
    c3_chart_internal_fn.updateDataAttributes = function C3_INTERNAL_updateDataAttributes(name, attrs, redraw) {
        var $$ = this, 
            config = $$.config, 
            current = config['data_' + name];

        if (!isUndefined(attrs)) {
            Object.keys(attrs).forEach(function (id) {
                current[id] = attrs[id];
            });

            if (!isUndefined(redraw) ? redraw : true) {
                $$.redraw({withLegend: true});
            }
        }

        return current;
    };

    c3_chart_internal_fn.getOriginalJson = function C3_INTERNAL_getOriginalJson() {
    	return this.config.json_original;
    };
    c3_chart_internal_fn.json2array = function C3_INTERNAL_json2array(json) {
    	var arr = [];
    	for (var i in json) {
    		arr.push(json[i]);
    	}
    	return arr;
    };

    c3_chart_internal_fn.convertUrlToData = function C3_INTERNAL_convertUrlToData(url, mimeType, headers, keys, done) {
        var $$ = this, 
            type = mimeType ? mimeType : 'csv';
        var req = $$.d3.xhr(url);
        if (headers) {
            Object.keys(headers).forEach(function (header) {
                req.header(header, headers[header]);
            });
        }
        req.get(function (error, data) {
            var d;
            if (!data) {
                throw new Error((error.responseURL || url) + ' [' + error.status + '] (' + (error.statusText || 'Cannot load data from URL') + ')');
            }
            var dataResponse = data.response || data.responseText;
            if (type === 'json') {
                d = $$.convertJsonToData(JSON.parse(dataResponse), keys);
            } else if (type === 'tsv') {
                d = $$.convertTsvToData(dataResponse);
            } else {
                d = $$.convertCsvToData(dataResponse);
            }
            done.call($$, d);
        });
    };
    c3_chart_internal_fn.convertXsvToData = function C3_INTERNAL_convertXsvToData(xsv, parser) {
        var rows = parser.parseRows(xsv), 
            d;
        if (rows.length === 1) {
            d = [{}];
            rows[0].forEach(function (id) {
                d[0][id] = null;
            });
        } else {
            d = parser.parse(xsv);
        }
        return d;
    };
    c3_chart_internal_fn.convertCsvToData = function C3_INTERNAL_convertCsvToData(csv) {
        return this.convertXsvToData(csv, this.d3.csv);
    };
    c3_chart_internal_fn.convertTsvToData = function C3_INTERNAL_convertTsvToData(tsv) {
        return this.convertXsvToData(tsv, this.d3.tsv);
    };
    c3_chart_internal_fn.convertJsonToData = function C3_INTERNAL_convertJsonToData(json, keys) {
        var $$ = this,
            new_rows = [], 
            targetKeys, data;
        $$.config.json_original = json;
        if (keys) { // when keys specified, json would be an array that includes objects
            if (keys.x) {
                targetKeys = keys.value.concat(keys.x);
                $$.config.data_x = keys.x;
            } else {
                targetKeys = keys.value;
            }
            new_rows.push(targetKeys);
            json.forEach(function (o) {
                var new_row = [];
                targetKeys.forEach(function (key) {
                    // convert undefined to null because undefined data will be removed in convertDataToTargets()
                    var v = $$.findValueInJson(o, key);
                    if (isUndefined(v)) {
                        v = null;
                    }
                    new_row.push(v);
                });
                new_rows.push(new_row);
            });
            data = $$.convertRowsToData(new_rows);
        } else {
            Object.keys(json).forEach(function (key) {
                new_rows.push([key].concat(json[key]));
            });
            data = $$.convertColumnsToData(new_rows);
        }
        return data;
    };
    c3_chart_internal_fn.findValueInJson = function (object, path) {
        if (path in object) {
            // if object has a key that contains . or [], return the key's value
            // instead of searching for an inner object
            return object[path];
        }

        path = path.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties (replace [] with .)
        path = path.replace(/^\./, '');           // strip a leading dot
        var pathArray = path.split('.');

        // search for any inner objects or arrays denoted by the path
        for (var i = 0; i < pathArray.length; ++i) {
            var k = pathArray[i];
            if (k in object) {
                object = object[k];
            } else {
                return;
            }
        }
        return object;
    };
    c3_chart_internal_fn.convertRowsToData = function C3_INTERNAL_convertRowsToData(rows) {
        var keys = rows[0], 
            new_row = {}, 
            new_rows = [], 
            i, j,
            ilen, jlen, row;
        for (i = 1, ilen = rows.length; i < ilen; i++) {
            new_row = {};
            row = rows[i];
            for (j = 0, jlen = row.length; j < jlen; j++) {
                if (isUndefined(row[j])) {
                    throw new Error("Source data is missing a component at (" + i + "," + j + ")!");
                }
                new_row[keys[j]] = row[j];
            }
            new_rows.push(new_row);
        }
        return new_rows;
    };
    c3_chart_internal_fn.convertColumnsToData = function C3_INTERNAL_convertColumnsToData(columns) {
        var new_rows = [], 
            i, j, ilen, jlen, key, column;
        for (i = 0, ilen = columns.length; i < ilen; i++) {
            column = columns[i];
            key = column[0];
            for (j = 1, jlen = column.length; j < jlen; j++) {
                if (isUndefined(new_rows[j - 1])) {
                    new_rows[j - 1] = {};
                }
                if (isUndefined(column[j])) {
                    throw new Error("Source data is missing a component at (" + i + "," + j + ")!");
                }
                new_rows[j - 1][key] = column[j];
            }
        }
        return new_rows;
    };
    c3_chart_internal_fn.convertDataToTargets = function C3_INTERNAL_convertDataToTargets(data, appendXs) {
        var $$ = this, 
            config = $$.config,
            ids = $$.d3.keys(data[0]).filter($$.isNotX, $$),
            xs = $$.d3.keys(data[0]).filter($$.isX, $$),
            targets;

        // save x for update data by load when custom x and c3.x API
        ids.forEach(function (id) {
            var xKey = $$.getXKey(id);

            if ($$.isCustomX() || $$.isTimeSeries()) {
                // if included in input data
                if (xs.indexOf(xKey) >= 0) {
                    $$.data.xs[id] = (appendXs && $$.data.xs[id] ? $$.data.xs[id] : []).concat(
                        data.map(function (d) { 
                            return d[xKey]; 
                        })
                        .filter(isValue)
                        .map(function (rawX, i) { 
                            return $$.generateTargetX(rawX, id, i); 
                        })
                    );
                }
                // if not included in input data, find from preloaded data of other id's x
                else if (config.data_x) {
                    $$.data.xs[id] = $$.getOtherTargetXs();
                }
                // if not included in input data, find from preloaded data
                else if (notEmpty(config.data_xs)) {
                    $$.data.xs[id] = $$.getXValuesOfXKey(xKey, $$.data.targets);
                }
                // MEMO: if no x included, use same x of current will be used
            } else {
                $$.data.xs[id] = data.map(function (d, i) { 
                    return i; 
                });
            }
        });


        // check x is defined
        ids.forEach(function (id) {
            if (!$$.data.xs[id]) {
                throw new Error('x is not defined for id = "' + id + '".');
            }
        });

        // convert to target
        targets = ids.map(function (id, index) {
            var convertedId = config.data_idConverter(id);
            return {
                id: convertedId,
                id_org: id,
                values: data.map(function (d, i) {
                    var xKey = $$.getXKey(id), 
                        rawX = d[xKey],
                        x,
                        value = d[id] !== null && !isNaN(d[id]) ? +d[id] : null;
                    // use x as categories if custom x and categorized
                    if ($$.isCustomX() && $$.isCategorized() && !isUndefined(rawX)) {
                        if (index === 0 && i === 0) {
                            config.axis_x_categories = [];
                        }
                        x = config.axis_x_categories.indexOf(rawX);
                        if (x === -1) {
                            x = config.axis_x_categories.length;
                            config.axis_x_categories.push(rawX);
                        }
                    } else {
                        x  = $$.generateTargetX(rawX, id, i);
                    }
                    // mark as x = undefined if value is undefined and filter to remove after mapped
                    if (isUndefined(d[id]) || $$.data.xs[id].length <= i) {
                        x = undefined;
                    }

                    return {
                        x: x, 
                        value: value, 
                        id: convertedId
                    };
                }).filter(function (v) { 
                    return isDefined(v.x); 
                })
            };
        });

        // finish targets
        targets.forEach(function (t) {
            var i;
            // sort values by its x
            if (config.data_xSort) {
                t.values = t.values.sort(function (v1, v2) {
                    var x1 = v1.x || v1.x === 0 ? v1.x : Infinity,
                        x2 = v2.x || v2.x === 0 ? v2.x : Infinity;
                    return x1 - x2;
                });
            }
            // indexing each value
            i = 0;
            t.values.forEach(function (v) {
                v.index = i++;
            });
            // this needs to be sorted because its index and value.index is identical
            $$.data.xs[t.id].sort(function (v1, v2) {
                return v1 - v2;
            });
        });

        // cache information about values
        $$.hasNegativeValue = $$.hasNegativeValueInTargets(targets);
        $$.hasPositiveValue = $$.hasPositiveValueInTargets(targets);

        // set target types
        if (config.data_type) {
            $$.setTargetType($$.mapToIds(targets).filter(function (id) { 
                return !(id in config.data_types); 
            }), config.data_type);
        }

        // cache as original id keyed
        targets.forEach(function (d) {
            $$.addCache(d.id_org, d);
        });

        return targets;
    };

    c3_chart_internal_fn.load = function C3_INTERNAL_load(targets, args) {
        var $$ = this;
        if (targets) {
            // filter loading targets if needed
            if (args.filter) {
                targets = targets.filter(args.filter);
            }
            // set type if args.types || args.type specified
            if (args.type || args.types) {
                targets.forEach(function (t) {
                    var type = args.types && args.types[t.id] ? args.types[t.id] : args.type;
                    $$.setTargetType(t.id, type);
                });
            }
            // Update/Add data
            $$.data.targets.forEach(function (d) {
                for (var i = 0; i < targets.length; i++) {
                    if (d.id === targets[i].id) {
                        d.values = targets[i].values;
                        targets.splice(i, 1);
                        break;
                    }
                }
            });
            $$.data.targets = $$.data.targets.concat(targets); // add remained
        }

        // Set targets
        $$.updateTargets($$.data.targets);

        // Redraw with new targets
        $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true, withLegend: true});

        if (args.done) { 
            args.done(); 
        }
    };
    c3_chart_internal_fn.loadFromArgs = function C3_INTERNAL_loadFromArgs(args) {
        var $$ = this;
        if (args.data) {
            $$.load($$.convertDataToTargets(args.data), args);
        }
        else if (args.url) {
            $$.convertUrlToData(args.url, args.mimeType, args.headers, args.keys, function (data) {
                $$.load($$.convertDataToTargets(data), args);
            });
        }
        else if (args.json) {
            $$.load($$.convertDataToTargets($$.convertJsonToData(args.json, args.keys)), args);
        }
        else if (args.rows) {
            $$.load($$.convertDataToTargets($$.convertRowsToData(args.rows)), args);
        }
        else if (args.columns) {
            $$.load($$.convertDataToTargets($$.convertColumnsToData(args.columns)), args);
        }
        else {
            $$.load(null, args);
        }
    };
    c3_chart_internal_fn.unload = function C3_INTERNAL_unload(targetIds, done) {
        var $$ = this;
        if (!done) {
            done = function () {};
        }
        // filter existing target
        targetIds = targetIds.filter(function (id) { 
            return $$.hasTarget($$.data.targets, id); 
        });
        // If no target, call done and return
        if (!targetIds || targetIds.length === 0) {
            done();
            return;
        }
        $$.svg.selectAll(targetIds.map(function (id) { 
                return $$.selectorTarget(id); 
            }))
            .transition()
            .style('opacity', 0)
            .remove()
            .call($$.endall, done);
        targetIds.forEach(function (id) {
            // Reset fade-in for future load
            $$.withoutFadeIn[id] = false;
            // Remove target's elements
            if ($$.legend) {
                $$.legend.selectAll('.' + CLASS.legendItem + $$.getTargetSelectorSuffix(id)).remove();
            }
            // Remove target
            $$.data.targets = $$.data.targets.filter(function (t) {
                return t.id !== id;
            });
        });
    };

    c3_chart_internal_fn.categoryName = function (i) {
        var config = this.config;
        return i < config.axis_x_categories.length ? config.axis_x_categories[i] : i;
    };

    c3_chart_internal_fn.initEventRect = function C3_INTERNAL_initEventRect() {
        var $$ = this;
        $$.main.select('.' + CLASS.chart).append("g")
            .attr("class", CLASS.eventRects)
            .style('fill-opacity', 0);
    };
    c3_chart_internal_fn.redrawEventRect = function C3_INTERNAL_redrawEventRect() {
        console.count('redrawEventRect');
        var $$ = this, 
            config = $$.config,
            eventRectUpdate, maxDataCountTarget,
            isMultipleX = $$.isMultipleX();

        // rects for mouseover
        var eventRects = $$.main.select('.' + CLASS.eventRects)
                .style('cursor', config.zoom_enabled ? config.axis_rotated ? 'ns-resize' : 'ew-resize' : null)
                .classed(CLASS.eventRectsMultiple, isMultipleX)
                .classed(CLASS.eventRectsSingle, !isMultipleX);

        // clear old rects
        eventRects.selectAll('.' + CLASS.eventRect).remove();

        // open as public variable
        $$.eventRect = eventRects.selectAll('.' + CLASS.eventRect);

        if (isMultipleX) {
            eventRectUpdate = $$.eventRect.data([0]);
            // enter : only one rect will be added
            $$.generateEventRectsForMultipleXs(eventRectUpdate.enter());
            // update
            $$.updateEventRect(eventRectUpdate);
            // exit : not needed because always only one rect exists
        }
        else {
            // Set data and update $$.eventRect
            maxDataCountTarget = $$.getMaxDataCountTarget($$.data.targets);
            eventRects.datum(maxDataCountTarget ? maxDataCountTarget.values : []);
            $$.eventRect = eventRects.selectAll('.' + CLASS.eventRect);
            eventRectUpdate = $$.eventRect.data(function (d) { return d; });
            // enter
            $$.generateEventRectsForSingleX(eventRectUpdate.enter());
            // update
            $$.updateEventRect(eventRectUpdate);
            // exit
            eventRectUpdate.exit().remove();
        }
    };
    c3_chart_internal_fn.updateEventRect = function C3_INTERNAL_updateEventRect(eventRectUpdate) {
        var $$ = this, 
            config = $$.config,
            x, y, w, h, rectW, rectX;

        // Moved eventRectUpdate to only be used when in non-multiplexed mode.
        // Otherwise you get an error when flowing multiplex data.

        if ($$.isMultipleX()) {
            // TODO: rotated not supported yet
            x = 0;
            y = 0;
            w = $$.width;
            h = $$.height;
        }
        else {
            // set update selection if null
            eventRectUpdate = eventRectUpdate || $$.eventRect.data(function (d) { 
                return d; 
            });
            if (($$.isCustomX() || $$.isTimeSeries()) && !$$.isCategorized()) {
                // update index for x that is used by prevX and nextX
                $$.updateXs();

                rectW = function (d) {
                    var prevX = $$.getPrevX(d.index), 
                        nextX = $$.getNextX(d.index);

                    // if there this is a single data point make the eventRect full width (or height)
                    if (prevX === null && nextX === null) {
                        return config.axis_rotated ? $$.height : $$.width;
                    }

                    if (prevX === null) { 
                        prevX = $$.x.domain()[0]; 
                    }
                    if (nextX === null) { 
                        nextX = $$.x.domain()[1]; 
                    }

                    return Math.max(0, ($$.x(nextX) - $$.x(prevX)) / 2);
                };
                rectX = function (d) {
                    var prevX = $$.getPrevX(d.index), 
                        nextX = $$.getNextX(d.index),
                        thisX = $$.data.xs[d.id][d.index];

                    // if there this is a single data point position the eventRect at 0
                    if (prevX === null && nextX === null) {
                        return 0;
                    }

                    if (prevX === null) { 
                        prevX = $$.x.domain()[0]; 
                    }

                    return ($$.x(thisX) + $$.x(prevX)) / 2;
                };
            } else {
                rectW = $$.getEventRectWidth();
                rectX = function (d) {
                    return $$.x(d.x) - (rectW / 2);
                };
            }
            x = config.axis_rotated ? 0 : rectX;
            y = config.axis_rotated ? rectX : 0;
            w = config.axis_rotated ? $$.width : rectW;
            h = config.axis_rotated ? rectW : $$.height;

            eventRectUpdate
                .attr('class', $$.classEvent.bind($$))
                .attr("x", x)
                .attr("y", y)
                .attr("width", w)
                .attr("height", h);
        }
    };
    c3_chart_internal_fn.generateEventRectsForSingleX = function C3_INTERNAL_generateEventRectsForSingleX(eventRectEnter) {
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config;
        eventRectEnter.append("rect")
            .attr("class", $$.classEvent.bind($$))
            .style("cursor", config.data_selection_enabled && config.data_selection_grouped ? "pointer" : null)
            .on('mouseover', function (d) {
                var index = d.index;

                if ($$.dragging || $$.flowing) { 
                    return; 
                } // do nothing while dragging/flowing
                if ($$.hasArcType()) { 
                    return; 
                }

                // Expand shapes for selection
                if (config.point_focus_expand_enabled) { 
                    $$.expandCircles(index, null, true); 
                }
                $$.expandBars(index, null, true);

                // Call event handler
                $$.main.selectAll('.' + CLASS.shape + '-' + index).each(function (d) {
                    config.data_onmouseover.call($$.api, d);
                });
            })
            .on('mouseout', function (d) {
                var index = d.index;
                if (!$$.config) { 
                    return; 
                } // chart is destroyed
                if ($$.hasArcType()) { 
                    return; 
                }
                $$.hideXGridFocus();
                $$.hideTooltip();
                // Undo expanded shapes
                $$.unexpandCircles();
                $$.unexpandBars();
                // Call event handler
                $$.main.selectAll('.' + CLASS.shape + '-' + index).each(function (d) {
                    config.data_onmouseout.call($$.api, d);
                });
            })
            .on('mousemove', function (d) {
                var selectedData, 
                    index = d.index,
                    eventRect = $$.svg.select('.' + CLASS.eventRect + '-' + index);

                if ($$.dragging || $$.flowing) { 
                    return; 
                } // do nothing while dragging/flowing
                if ($$.hasArcType()) { 
                    return; 
                }

                if ($$.isStepType(d) && $$.config.line_step_type === 'step-after' && d3.mouse(this)[0] < $$.x($$.getXValue(d.id, index))) {
                    index -= 1;
                }

                // Show tooltip
                selectedData = $$.filterTargetsToShow($$.data.targets).map(function (t) {
                    return $$.addName($$.getValueOnIndex(t.values, index));
                });

                if (config.tooltip_grouped) {
                    $$.showTooltip(selectedData, this);
                    $$.showXGridFocus(selectedData);
                }

                if (config.tooltip_grouped && (!config.data_selection_enabled || config.data_selection_grouped)) {
                    return;
                }

                $$.main.selectAll('.' + CLASS.shape + '-' + index)
                    .each(function () {
                        d3.select(this).classed(CLASS.EXPANDED, true);
                        if (config.data_selection_enabled) {
                            eventRect.style('cursor', config.data_selection_grouped ? 'pointer' : null);
                        }
                        if (!config.tooltip_grouped) {
                            $$.hideXGridFocus();
                            $$.hideTooltip();
                            if (!config.data_selection_grouped) {
                                $$.unexpandCircles(index);
                                $$.unexpandBars(index);
                            }
                        }
                    })
                    .filter(function (d) {
                        return $$.isWithinShape(this, d);
                    })
                    .each(function (d) {
                        if (config.data_selection_enabled && (config.data_selection_grouped || config.data_selection_isselectable(d))) {
                            eventRect.style('cursor', 'pointer');
                        }
                        if (!config.tooltip_grouped) {
                            $$.showTooltip([d], this);
                            $$.showXGridFocus([d]);
                            if (config.point_focus_expand_enabled) { 
                                $$.expandCircles(index, d.id, true); 
                            }
                            $$.expandBars(index, d.id, true);
                        }
                    });
            })
            .on('click', function (d) {
                var index = d.index;
                if ($$.hasArcType() || !$$.toggleShape) { 
                    return; 
                }
                if ($$.cancelClick) {
                    $$.cancelClick = false;
                    return;
                }
                if ($$.isStepType(d) && config.line_step_type === 'step-after' && d3.mouse(this)[0] < $$.x($$.getXValue(d.id, index))) {
                    index -= 1;
                }
                $$.main.selectAll('.' + CLASS.shape + '-' + index).each(function (d) {
                    if (config.data_selection_grouped || $$.isWithinShape(this, d)) {
                        $$.toggleShape(this, d, index);
                        $$.config.data_onclick.call($$.api, d, this);
                    }
                });
            })
            .call(
                config.data_selection_draggable && $$.drag ? (
                    d3.behavior.drag().origin(Object)
                        .on('drag', function () { 
                            $$.drag(d3.mouse(this)); 
                        })
                        .on('dragstart', function () { 
                            $$.dragstart(d3.mouse(this)); 
                        })
                        .on('dragend', function () { 
                            $$.dragend(); 
                        })
                ) : function () {}
            );
    };

    c3_chart_internal_fn.generateEventRectsForMultipleXs = function C3_INTERNAL_generateEventRectsForMultipleXs(eventRectEnter) {
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config;

        function mouseout() {
            $$.svg.select('.' + CLASS.eventRect).style('cursor', null);
            $$.hideXGridFocus();
            $$.hideTooltip();
            $$.unexpandCircles();
            $$.unexpandBars();
        }

        eventRectEnter.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', $$.width)
            .attr('height', $$.height)
            .attr('class', CLASS.eventRect)
            .on('mouseout', function () {
                if (!$$.config) { 
                    return; 
                } // chart is destroyed
                if ($$.hasArcType()) { 
                    return; 
                }
                mouseout();
            })
            .on('mousemove', function () {
                var targetsToShow = $$.filterTargetsToShow($$.data.targets);
                var mouse, closest, sameXData, selectedData;

                if ($$.dragging) { 
                    return; 
                } // do nothing when dragging
                if ($$.hasArcType(targetsToShow)) { 
                    return; 
                }

                mouse = d3.mouse(this);
                closest = $$.findClosestFromTargets(targetsToShow, mouse);

                if ($$.mouseover && (!closest || closest.id !== $$.mouseover.id)) {
                    config.data_onmouseout.call($$.api, $$.mouseover);
                    $$.mouseover = undefined;
                }

                if (!closest) {
                    mouseout();
                    return;
                }

                if ($$.isScatterType(closest) || !config.tooltip_grouped) {
                    sameXData = [closest];
                } else {
                    sameXData = $$.filterByX(targetsToShow, closest.x);
                }

                // show tooltip when cursor is close to some point
                selectedData = sameXData.map(function (d) {
                    return $$.addName(d);
                });
                $$.showTooltip(selectedData, this);

                // expand points
                if (config.point_focus_expand_enabled) {
                    $$.expandCircles(closest.index, closest.id, true);
                }
                $$.expandBars(closest.index, closest.id, true);

                // Show xgrid focus line
                $$.showXGridFocus(selectedData);

                // Show cursor as pointer if point is close to mouse position
                if ($$.isBarType(closest.id) || $$.dist(closest, mouse) < config.point_sensitivity) {
                    $$.svg.select('.' + CLASS.eventRect).style('cursor', 'pointer');
                    config.data_onmouseover.call($$.api, closest);
                    $$.mouseover = closest;
                }
            })
            .on('click', function () {
                var targetsToShow = $$.filterTargetsToShow($$.data.targets);
                var mouse, closest;

                if ($$.hasArcType(targetsToShow)) { 
                    return; 
                }

                mouse = d3.mouse(this);
                closest = $$.findClosestFromTargets(targetsToShow, mouse);
                if (!closest) { 
                    return; 
                }

                // select if selection enabled
                if ($$.isBarType(closest.id) || $$.dist(closest, mouse) < config.point_sensitivity) {
                    $$.main.selectAll('.' + CLASS.shapes + $$.getTargetSelectorSuffix(closest.id)).selectAll('.' + CLASS.shape + '-' + closest.index).each(function () {
                        if (config.data_selection_grouped || $$.isWithinShape(this, closest)) {
                            $$.toggleShape(this, closest, closest.index);
                            $$.config.data_onclick.call($$.api, closest, this);
                        }
                    });
                }
            })
            .call(
                config.data_selection_draggable && $$.drag ? (
                    d3.behavior.drag().origin(Object)
                        .on('drag', function () { 
                            $$.drag(d3.mouse(this)); 
                        })
                        .on('dragstart', function () { 
                            $$.dragstart(d3.mouse(this)); 
                        })
                        .on('dragend', function () { 
                            $$.dragend(); 
                        })
                ) : function () {}
            );
    };
    c3_chart_internal_fn.dispatchEvent = function C3_INTERNAL_dispatchEvent(type, index, mouse) {
        var $$ = this,
            selector = '.' + CLASS.eventRect + (!$$.isMultipleX() ? '-' + index : ''),
            eventRect = $$.main.select(selector).node(),
            box = eventRect.getBoundingClientRect(),
            x = box.left + (mouse ? mouse[0] : 0),
            y = box.top + (mouse ? mouse[1] : 0),
            event = document.createEvent("MouseEvents");

        event.initMouseEvent(type, true, true, window, 0, x, y, x, y,
                             false, false, false, false, 0, null);
        eventRect.dispatchEvent(event);
    };

    c3_chart_internal_fn.getCurrentWidth = function C3_INTERNAL_getCurrentWidth() {
        var $$ = this, 
            config = $$.config;
        return config.size_width ? config.size_width : $$.getParentWidth();
    };
    c3_chart_internal_fn.getCurrentHeight = function C3_INTERNAL_getCurrentHeight() {
        var $$ = this, 
            config = $$.config,
            h = config.size_height ? config.size_height : $$.getParentHeight();
        return h > 0 ? h : 320 / ($$.hasType('gauge') && !config.gauge_fullCircle ? 2 : 1); 
    };
    c3_chart_internal_fn.getCurrentPaddingTop = function C3_INTERNAL_getCurrentPaddingTop() {
        var $$ = this,
            config = $$.config,
            padding = isValue(config.padding_top) ? config.padding_top : 0;
        if ($$.config.header_show) {
            padding += $$.config.header_height;
        }
        if ($$.title && $$.title.node() && $$.config.title_position.indexOf('bottom') === -1) {
            padding += $$.getTitlePadding();
        }
        return padding;
    };
    c3_chart_internal_fn.getCurrentPaddingBottom = function C3_INTERNAL_getCurrentPaddingBottom() {
        var $$ = this,
            config = this.config,
            padding = isValue(config.padding_bottom) ? config.padding_bottom : 0;
        if ($$.config.footer_show) {
            padding += $$.config.footer_height;
        }
        if ($$.title && $$.title.node() && $$.config.title_position.indexOf('bottom') !== -1) {
            padding += $$.getTitlePadding();
        }
        return padding;
    };
    c3_chart_internal_fn.getCurrentPaddingLeft = function C3_INTERNAL_getCurrentPaddingLeft(withoutRecompute) {
        var $$ = this, 
            config = $$.config;
        if (isValue(config.padding_left)) {
            return config.padding_left;
        } else if (config.axis_rotated) {
            return !config.axis_x_show ? 1 : Math.max(ceil10($$.getAxisWidthByAxisId('x', withoutRecompute)), 40);
        } else if (!config.axis_y_show || config.axis_y_inner) { // && !config.axis_rotated
            return $$.axis.getYAxisLabelPosition().isOuter ? 30 : 1;
        } else {
            return Math.ceil($$.getAxisWidthByAxisId('y', withoutRecompute));
        }
    };
    c3_chart_internal_fn.getCurrentPaddingRight = function C3_INTERNAL_getCurrentPaddingRight() {
        var $$ = this, 
            config = $$.config,
            defaultPadding = 10, 
            legendWidthOnRight = $$.isLegendRight ? $$.getLegendWidth() + 20 : 0;
        if (isValue(config.padding_right)) {
            return config.padding_right + 1; // 1 is needed not to hide tick line
        } else if (config.axis_rotated) {
            return defaultPadding + legendWidthOnRight;
        } else if (!config.axis_y2_show || config.axis_y2_inner) { // && !config.axis_rotated
            return 2 + legendWidthOnRight + ($$.axis.getY2AxisLabelPosition().isOuter ? 20 : 0);
        } else {
            return Math.ceil($$.getAxisWidthByAxisId('y2')) + legendWidthOnRight;
        }
    };

    c3_chart_internal_fn.getParentRectValue = function C3_INTERNAL_getParentRectValue(key) {
        var parent = this.selectChart.node(), 
            v;
        while (parent && parent.tagName !== 'BODY') {
            try {
                v = parent.getBoundingClientRect()[key];
            } catch(e) {
                if (key === 'width') {
                    // In IE in certain cases getBoundingClientRect
                    // will cause an "unspecified error"
                    v = parent.offsetWidth;
                }
            }
            if (v) {
                break;
            }
            parent = parent.parentNode;
        }
        return v;
    };
    c3_chart_internal_fn.getParentWidth = function C3_INTERNAL_getParentWidth() {
        return this.getParentRectValue('width');
    };
    c3_chart_internal_fn.getParentHeight = function C3_INTERNAL_getParentHeight() {
        var h = this.selectChart.style('height');
        return h.indexOf('px') > 0 ? +h.replace('px', '') : 0;
    };


    c3_chart_internal_fn.getSvgLeft = function C3_INTERNAL_getSvgLeft(withoutRecompute) {
        var $$ = this, 
            config = $$.config,
            hasLeftAxisRect = config.axis_rotated || (!config.axis_rotated && !config.axis_y_inner),
            leftAxisClass = config.axis_rotated ? CLASS.axisX : CLASS.axisY,
            leftAxis = $$.main.select('.' + leftAxisClass).node(),
            svgRect = leftAxis && hasLeftAxisRect ? leftAxis.getBoundingClientRect() : {right: 0},
            chartRect = $$.selectChart.node().getBoundingClientRect(),
            hasArc = $$.hasArcType(),
            svgLeft = svgRect.right - chartRect.left - (hasArc ? 0 : $$.getCurrentPaddingLeft(withoutRecompute));
        return svgLeft > 0 ? svgLeft : 0;
    };


    c3_chart_internal_fn.getAxisWidthByAxisId = function C3_INTERNAL_getAxisWidthByAxisId(id, withoutRecompute) {
        var $$ = this, 
            position = $$.axis.getLabelPositionById(id);
        return $$.axis.getMaxTickWidth(id, withoutRecompute) + (position.isInner ? 10 : 20);
    };

    c3_chart_internal_fn.getHorizontalAxisHeight = function C3_INTERNAL_getHorizontalAxisHeight(axisId) {
        var $$ = this, 
            config = $$.config, 
            h = 30;
        if (axisId === 'x' && !config.axis_x_show) { 
            return 8; 
        }
        if (axisId === 'x' && config.axis_x_height) { 
            return config.axis_x_height; 
        }
        if (axisId === 'y' && !config.axis_y_show) { 
            return config.legend_show && !$$.isLegendRight && !$$.isLegendInset ? 10 : 1; 
        }
        if (axisId === 'y2' && !config.axis_y2_show) { 
            return $$.rotated_padding_top; 
        }
        // Calculate x axis height when tick rotated
        if (axisId === 'x' && !config.axis_rotated && config.axis_x_tick_rotate) {
            h += $$.axis.getMaxTickWidth(axisId) * Math.cos(Math.PI * (90 - Math.abs(config.axis_x_tick_rotate)) / 180);
        }
        // Calculate y axis height when tick rotated
        if (axisId === 'y' && config.axis_rotated && config.axis_y_tick_rotate) {
            h += $$.axis.getMaxTickWidth(axisId) * Math.cos(Math.PI * (90 - Math.abs(config.axis_y_tick_rotate)) / 180);
        }
        return h + ($$.axis.getLabelPositionById(axisId).isInner ? 0 : 10) + (axisId === 'y2' ? -10 : 0);
    };

    c3_chart_internal_fn.getEventRectWidth = function C3_INTERNAL_getEventRectWidth() {
        return Math.max(0, this.xAxis.tickInterval());
    };

    c3_chart_internal_fn.getShapeIndices = function C3_INTERNAL_getShapeIndices(typeFilter) {
        var $$ = this, 
            config = $$.config,
            indices = {}, 
            i = 0, 
            j, k;
        $$.filterTargetsToShow($$.data.targets.filter(function (d) {
                return typeFilter.call($$, d);
            })).forEach(function (d) {
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
        var $$ = this, 
            scale = isSub ? $$.subX : $$.x;
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
            targets = $$.orderTargets($$.filterTargetsToShow($$.data.targets.filter(function (d) {
                return typeFilter.call($$, d, isSub);
            }))),
            targetIds = targets.map(function (t) {
                return t.id;
            });
        return function (d, i) {
            var scale = isSub ? $$.getSubYScale(d.id) : $$.getYScale(d.id),
                y0 = scale(0), 
                offset = y0;
            targets.forEach(function (t) {
                var values = $$.isStepType(d, isSub) ? $$.convertValuesToStep(t.values) : t.values;
                if (t.id === d.id || indices[t.id] !== indices[d.id]) {
                    return;
                }
                if (targetIds.indexOf(t.id) < targetIds.indexOf(d.id)) {
                    // check if the x values line up
                    if (typeof values[i] === 'undefined' || +values[i].x !== +d.x) {  // "+" for timeseries
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
            shape = $$.d3.select(that), 
            isWithin;
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
            interpolation = $$.isInterpolationType($$.config.spline_interpolation_type) ? $$.config.spline_interpolation_type : undefined;

        if ($$.isSplineType(d, isSub)) {
            return (isSub ? $$.config.subchart_line_spline_type : interpolation) ||
                $$.config.line_spline_type;
        } else if ($$.isStepType(d, isSub)) {
            return (isSub ? $$.config.subchart_line_step_type : undefined) ||
                $$.config.line_step_type;
        }
        return "linear";
    };

    c3_chart_internal_fn.initLine = function C3_INTERNAL_initLine() {
        var $$ = this;
        $$.main.select('.' + CLASS.chart).append("g")
            .attr("class", CLASS.chartLines);
    };
    c3_chart_internal_fn.updateTargetsForLine = function C3_INTERNAL_updateTargetsForLine(targets) {
        var $$ = this, 
            config = $$.config,
            mainLineUpdate, mainLineEnter,
            classChartLine = $$.classChartLine.bind($$),
            classLines = $$.classLines.bind($$),
            classAreas = $$.classAreas.bind($$),
            classCircles = $$.classCircles.bind($$),
            classFocus = $$.classFocus.bind($$);
        mainLineUpdate = $$.main.select('.' + CLASS.chartLines).selectAll('.' + CLASS.chartLine)
            .data(targets)
            .attr('class', function (d) { 
                return classChartLine(d) + classFocus(d); 
            });
        mainLineEnter = mainLineUpdate.enter().append('g')
            .attr('class', classChartLine)
            .style('opacity', 0)
            .style("pointer-events", "none");
        // Lines for each data
        mainLineEnter.append('g')
            .attr("class", classLines);
        // Areas
        mainLineEnter.append('g')
            .attr('class', classAreas);
        // Circles for each data point on lines
        mainLineEnter.append('g')
            .attr("class", function (d) { 
                return $$.generateClass(CLASS.selectedCircles, d.id); 
            });
        mainLineEnter.append('g')
            .attr("class", classCircles)
            .style("cursor", function (d) { 
                return config.data_selection_isselectable(d) ? "pointer" : null; 
            });
        // Update date for selected circles
        targets.forEach(function (t) {
            $$.main.selectAll('.' + CLASS.selectedCircles + $$.getTargetSelectorSuffix(t.id)).selectAll('.' + CLASS.selectedCircle).each(function (d) {
                d.value = t.values[d.index].value;
            });
        });
        // MEMO: can not keep same color...
        //mainLineUpdate.exit().remove();
    };
    c3_chart_internal_fn.updateLine = function C3_INTERNAL_updateLine(durationForExit) {
        var $$ = this;
        $$.mainLine = $$.main.selectAll('.' + CLASS.lines).selectAll('.' + CLASS.line)
            .data(function (d, i) {
                return $$.lineData(d);
            });
        $$.mainLine.enter().append('path')
            .attr('class', function (path) {
              var extraClasses = $$.config.data_classes[path.id] ? ' ' + $$.config.data_classes[path.id] : '';
              return $$.classLine(path) + extraClasses;
            })
            .style("stroke", $$.color);
        $$.mainLine
            .style("opacity", $$.initialOpacity.bind($$))
            .style('shape-rendering', function (d) { 
                return $$.isStepType(d) ? 'crispEdges' : ''; 
            })
            .attr('transform', null);
        $$.mainLine.exit().transition().duration(durationForExit)
            .style('opacity', 0)
            .remove();
    };
    c3_chart_internal_fn.redrawLine = function C3_INTERNAL_redrawLine(drawLine, withTransition) {
        console.count('redrawLine');
        return [
            (withTransition ? this.mainLine.transition(Math.random().toString()) : this.mainLine)
                .attr("d", drawLine)
                .style("stroke", this.color)
                .style("opacity", 1)
        ];
    };
    c3_chart_internal_fn.generateDrawLine = function C3_INTERNAL_generateDrawLine(lineIndices, isSub) {
        var $$ = this, 
            config = $$.config,
            line = $$.d3.svg.line(),
            getPoints = $$.generateGetLinePoints(lineIndices, isSub),
            yScaleGetter = isSub ? $$.getSubYScale : $$.getYScale,
            xValue = function (d) { 
                return (isSub ? $$.subxx : $$.xx).call($$, d); 
            },
            yValue = function (d, i) {
                return config.data_groups.length > 0 ? getPoints(d, i)[0][1] : yScaleGetter.call($$, d.id)(d.value);
            };

        line = config.axis_rotated ? line.x(yValue).y(xValue) : line.x(xValue).y(yValue);
        if (!config.line_connectNull) { 
            line = line.defined(function (d) { 
                return d.value != null; 
            }); 
        }
        return function C3_INTERNAL_execDrawLine(d) {
            var values = config.line_connectNull ? $$.filterRemoveNull(d.values) : d.values,
                x = isSub ? $$.x : $$.subX, 
                y = yScaleGetter.call($$, d.id), 
                x0 = 0, 
                y0 = 0, 
                path;
            if ($$.isLineType(d, isSub)) {
                if (config.data_regions[d.id]) {
                    path = $$.lineWithRegions(values, x, y, config.data_regions[d.id]);
                } else {
                    if ($$.isStepType(d, isSub)) { 
                        values = $$.convertValuesToStep(values); 
                    }
                    path = line.interpolate($$.getInterpolate(d, isSub))(values);
                }
            } else {
                if (values[0]) {
                    x0 = x(values[0].x);
                    y0 = y(values[0].value);
                }
                path = config.axis_rotated ? "M " + y0 + " " + x0 : "M " + x0 + " " + y0;
            }
            return path ? path : "M 0 0";
        };
    };
    c3_chart_internal_fn.generateGetLinePoints = function C3_INTERNAL_generateGetLinePoints(lineIndices, isSub) { // partial duplication of generateGetBarPoints
        var $$ = this, 
            config = $$.config,
            lineTargetsNum = lineIndices.__max__ + 1,
            x = $$.getShapeX(0, lineTargetsNum, lineIndices, !!isSub),
            y = $$.getShapeY(!!isSub),
            lineOffset = $$.getShapeOffset($$.isLineType, lineIndices, !!isSub),
            yScale = isSub ? $$.getSubYScale : $$.getYScale;
        return function (d, i) {
            var y0 = yScale.call($$, d.id)(0),
                offset = lineOffset(d, i) || y0, // offset is for stacked area chart
                posX = x(d), 
                posY = y(d);
            // fix posY not to overflow opposite quadrant
            if (config.axis_rotated) {
                if ((0 < d.value && posY < y0) || (d.value < 0 && y0 < posY)) { 
                    posY = y0; 
                }
            }
            // 1 point that marks the line position
            return [
                [posX, posY - (y0 - offset)],
                [posX, posY - (y0 - offset)], // needed for compatibility
                [posX, posY - (y0 - offset)], // needed for compatibility
                [posX, posY - (y0 - offset)]  // needed for compatibility
            ];
        };
    };


    c3_chart_internal_fn.lineWithRegions = function C3_INTERNAL_lineWithRegions(d, x, y, _regions) {
        var $$ = this, 
            config = $$.config,
            prev = -1, 
            i, j,
            s = "M", 
            sWithRegion,
            xp, yp, dx, dy, dd, diff, diffx2,
            xOffset = $$.isCategorized() ? 0.5 : 0,
            xValue, yValue,
            regions = [];

        function isWithinRegions(x, regions) {
            var i;
            for (i = 0; i < regions.length; i++) {
                if (regions[i].start < x && x <= regions[i].end) { 
                    return true; 
                }
            }
            return false;
        }

        // Check start/end of regions
        if (isDefined(_regions)) {
            for (i = 0; i < _regions.length; i++) {
                regions[i] = {};
                if (isUndefined(_regions[i].start)) {
                    regions[i].start = d[0].x;
                } else {
                    regions[i].start = $$.isTimeSeries() ? $$.parseDate(_regions[i].start) : _regions[i].start;
                }
                if (isUndefined(_regions[i].end)) {
                    regions[i].end = d[d.length - 1].x;
                } else {
                    regions[i].end = $$.isTimeSeries() ? $$.parseDate(_regions[i].end) : _regions[i].end;
                }
            }
        }

        // Set scales
        xValue = config.axis_rotated ? function (d) { 
            return y(d.value); 
        } : function (d) { 
            return x(d.x); 
        };
        yValue = config.axis_rotated ? function (d) { 
            return x(d.x); 
        } : function (d) { 
            return y(d.value); 
        };

        // Define svg generator function for region
        function generateM(points) {
            return 'M' + points[0][0] + ' ' + points[0][1] + ' ' + points[1][0] + ' ' + points[1][1];
        }
        if ($$.isTimeSeries()) {
            sWithRegion = function (d0, d1, j, diff) {
                var x0 = d0.x.getTime(), 
                    x_diff = d1.x - d0.x,
                    xv0 = new Date(x0 + x_diff * j),
                    xv1 = new Date(x0 + x_diff * (j + diff)),
                    points;
                if (config.axis_rotated) {
                    points = [[y(yp(j)), x(xv0)], [y(yp(j + diff)), x(xv1)]];
                } else {
                    points = [[x(xv0), y(yp(j))], [x(xv1), y(yp(j + diff))]];
                }
                return generateM(points);
            };
        } else {
            sWithRegion = function (d0, d1, j, diff) {
                var points;
                if (config.axis_rotated) {
                    points = [[y(yp(j), true), x(xp(j))], [y(yp(j + diff), true), x(xp(j + diff))]];
                } else {
                    points = [[x(xp(j), true), y(yp(j))], [x(xp(j + diff), true), y(yp(j + diff))]];
                }
                return generateM(points);
            };
        }

        // Generate
        for (i = 0; i < d.length; i++) {
            // Draw as normal
            if (isUndefined(regions) || !isWithinRegions(d[i].x, regions)) {
                s += " " + xValue(d[i]) + " " + yValue(d[i]);
            }
            // Draw with region 
            // TODO: Fix for horizontal charts
            else {
                xp = $$.getScale(d[i - 1].x + xOffset, d[i].x + xOffset, $$.isTimeSeries());
                yp = $$.getScale(d[i - 1].value, d[i].value);

                dx = x(d[i].x) - x(d[i - 1].x);
                dy = y(d[i].value) - y(d[i - 1].value);
                dd = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                diff = 2 / dd;
                diffx2 = diff * 2;

                for (j = diff; j <= 1; j += diffx2) {
                    s += sWithRegion(d[i - 1], d[i], j, diff);
                }
            }
            prev = d[i].x;
        }

        return s;
    };

    c3_chart_internal_fn.updateArea = function C3_INTERNAL_updateArea(durationForExit) {
        var $$ = this, 
            d3 = $$.d3;
        $$.mainArea = $$.main.selectAll('.' + CLASS.areas).selectAll('.' + CLASS.area)
            .data(function (d, i) {
                return $$.lineData(d);
            });
        $$.mainArea.enter().append('path')
            .attr('class', function (path) {
                var extraClasses = $$.config.data_classes[path.id] ? ' ' + $$.config.data_classes[path.id] : '';
                return $$.classArea(path) + extraClasses;
              })
            .style("fill", $$.color)
            .style("opacity", function () { 
                $$.orgAreaOpacity = +d3.select(this).style('opacity'); 
                return 0; 
            });
        $$.mainArea
            .style("opacity", $$.orgAreaOpacity);
        $$.mainArea.exit().transition().duration(durationForExit)
            .style('opacity', 0)
            .remove();
    };
    c3_chart_internal_fn.redrawArea = function C3_INTERNAL_redrawArea(drawArea, withTransition) {
        console.count('redrawArea');
        return [
            (withTransition ? this.mainArea.transition(Math.random().toString()) : this.mainArea)
                .attr("d", drawArea)
                .style("fill", this.color)
                .style("opacity", this.orgAreaOpacity)
        ];
    };
    c3_chart_internal_fn.generateDrawArea = function C3_INTERNAL_generateDrawArea(areaIndices, isSub) {
        var $$ = this, 
            config = $$.config, 
            area = $$.d3.svg.area(),
            getPoints = $$.generateGetAreaPoints(areaIndices, isSub),
            yScaleGetter = isSub ? $$.getSubYScale : $$.getYScale,
            xValue = function (d) { 
                return (isSub ? $$.subxx : $$.xx).call($$, d); 
            },
            value0 = function (d, i) {
                return config.data_groups.length > 0 ? getPoints(d, i)[0][1] : yScaleGetter.call($$, d.id)($$.getAreaBaseValue(d.id));
            },
            value1 = function (d, i) {
                return config.data_groups.length > 0 ? getPoints(d, i)[1][1] : yScaleGetter.call($$, d.id)(d.value);
            };

        area = config.axis_rotated ? area.x0(value0).x1(value1).y(xValue) : area.x(xValue).y0(config.area_above ? 0 : value0).y1(value1);
        if (!config.line_connectNull) {
            area = area.defined(function (d) { 
                return d.value !== null; 
            });
        }

        return function (d) {
            var values = config.line_connectNull ? $$.filterRemoveNull(d.values) : d.values,
                x0 = 0, 
                y0 = 0, 
                path;
            if ($$.isAreaType(d, isSub)) {
                if ($$.isStepType(d, isSub)) { 
                    values = $$.convertValuesToStep(values); 
                }
                path = area.interpolate($$.getInterpolate(d))(values);
            } else {
                if (values[0]) {
                    x0 = $$.x(values[0].x);
                    y0 = $$.getYScale(d.id)(values[0].value);
                }
                path = config.axis_rotated ? "M " + y0 + " " + x0 : "M " + x0 + " " + y0;
            }
            return path ? path : "M 0 0";
        };
    };
    c3_chart_internal_fn.getAreaBaseValue = function C3_INTERNAL_getAreaBaseValue() {
        return 0;
    };
    c3_chart_internal_fn.generateGetAreaPoints = function C3_INTERNAL_generateGetAreaPoints(areaIndices, isSub) { // partial duplication of generateGetBarPoints
        var $$ = this, 
            config = $$.config,
            areaTargetsNum = areaIndices.__max__ + 1,
            x = $$.getShapeX(0, areaTargetsNum, areaIndices, !!isSub),
            y = $$.getShapeY(!!isSub),
            areaOffset = $$.getShapeOffset($$.isAreaType, areaIndices, !!isSub),
            yScale = isSub ? $$.getSubYScale : $$.getYScale;
        return function (d, i) {
            var y0 = yScale.call($$, d.id)(0),
                offset = areaOffset(d, i) || y0, // offset is for stacked area chart
                posX = x(d), 
                posY = y(d);
            // fix posY not to overflow opposite quadrant
            if (config.axis_rotated) {
                if ((0 < d.value && posY < y0) || (d.value < 0 && y0 < posY)) { 
                    posY = y0; 
                }
            }
            // 1 point that marks the area position
            return [
                [posX, offset],
                [posX, posY - (y0 - offset)],
                [posX, posY - (y0 - offset)], // needed for compatibility
                [posX, offset] // needed for compatibility
            ];
        };
    };


    c3_chart_internal_fn.updateCircle = function C3_INTERNAL_updateCircle() {
        var $$ = this;
        $$.mainCircle = $$.main.selectAll('.' + CLASS.circles).selectAll('.' + CLASS.circle)
            .data(function (d, i) {
                return $$.lineOrScatterData(d);
            });
        $$.mainCircle.enter().append("circle")
            .attr("class", $$.classCircle.bind($$))
            .attr("r", $$.pointR.bind($$))
            .style("fill", $$.color);
        $$.mainCircle
            .style("opacity", $$.initialOpacityForCircle.bind($$));
        $$.mainCircle.exit().remove();
    };
    c3_chart_internal_fn.redrawCircle = function C3_INTERNAL_redrawCircle(cx, cy, withTransition) {
        console.count('redrawCircle');
        var selectedCircles = this.main.selectAll('.' + CLASS.selectedCircle);
        return [
            (withTransition ? this.mainCircle.transition(Math.random().toString()) : this.mainCircle)
                .style('opacity', this.opacityForCircle.bind(this))
                .style("fill", this.color)
                .attr("cx", cx)
                .attr("cy", cy),
            (withTransition ? selectedCircles.transition(Math.random().toString()) : selectedCircles)
                .attr("cx", cx)
                .attr("cy", cy)
        ];
    };
    c3_chart_internal_fn.circleX = function C3_INTERNAL_circleX(d) {
        return d.x || d.x === 0 ? this.x(d.x) : null;
    };
    c3_chart_internal_fn.updateCircleY = function C3_INTERNAL_updateCircleY() {
        var $$ = this, 
            lineIndices, getPoints;
        if ($$.config.data_groups.length > 0) {
            lineIndices = $$.getShapeIndices($$.isLineType),
            getPoints = $$.generateGetLinePoints(lineIndices);
            $$.circleY = function (d, i) {
                return getPoints(d, i)[0][1];
            };
        } else {
            $$.circleY = function (d) {
                return $$.getYScale(d.id)(d.value);
            };
        }
    };
    c3_chart_internal_fn.getCircles = function C3_INTERNAL_getCircles(i, id) {
        var $$ = this;
        return (id ? $$.main.selectAll('.' + CLASS.circles + $$.getTargetSelectorSuffix(id)) : $$.main).selectAll('.' + CLASS.circle + (isValue(i) ? '-' + i : ''));
    };
    c3_chart_internal_fn.expandCircles = function C3_INTERNAL_expandCircles(i, id, reset) {
        var $$ = this,
            r = $$.pointExpandedR.bind($$);
        if (reset) { 
            $$.unexpandCircles(); 
        }
        var circles = $$.getCircles(i, id)
            .classed(CLASS.EXPANDED, true);
        if ($$.config.point_animation) {
            circles = circles.transition()
                .duration($$.config.transition_duration)
                .ease('cubic-in-out');
        }
        circles.attr('r', r);
    };
    c3_chart_internal_fn.unexpandCircles = function C3_INTERNAL_unexpandCircles(i) {
        var $$ = this,
            r = $$.pointR.bind($$);
        var circles = $$.getCircles(i)
            .filter(function () { 
                return $$.d3.select(this).classed(CLASS.EXPANDED); 
            })
            .classed(CLASS.EXPANDED, false);

        if ($$.config.point_animation) {
            circles = circles.transition()
                .duration($$.config.transition_duration)
                .ease('cubic-in-out');
        }
        circles.attr('r', r);
    };
    c3_chart_internal_fn.pointR = function C3_INTERNAL_pointR(d) {
        var $$ = this, 
            config = $$.config;
        return config.point_show && !$$.isStepType(d) ? (isFunction(config.point_r) ? config.point_r(d) : config.point_r) : 0;
    };
    c3_chart_internal_fn.pointExpandedR = function C3_INTERNAL_pointExpandedR(d) {
        var $$ = this, 
            config = $$.config;
        if (config.point_focus_expand_enabled) {
            return isFunction(config.point_focus_expand_r) ? config.point_focus_expand_r(d) : (config.point_focus_expand_r ? config.point_focus_expand_r : $$.pointR(d) * 1.75);
        } else {
            return $$.pointR(d);
        }
    };
    c3_chart_internal_fn.pointSelectR = function C3_INTERNAL_pointSelectR(d) {
        var $$ = this, 
            config = $$.config;
        return isFunction(config.point_select_r) ? config.point_select_r(d) : ((config.point_select_r) ? config.point_select_r : $$.pointR(d) * 4);
    };
    c3_chart_internal_fn.isWithinCircle = function C3_INTERNAL_isWithinCircle(that, r) {
        var d3 = this.d3,
            mouse = d3.mouse(that), 
            d3_this = d3.select(that),
            cx = +d3_this.attr("cx"), 
            cy = +d3_this.attr("cy");
        return Math.sqrt(Math.pow(cx - mouse[0], 2) + Math.pow(cy - mouse[1], 2)) < r;
    };
    c3_chart_internal_fn.isWithinStep = function C3_INTERNAL_isWithinStep(that, y) {
        return Math.abs(y - this.d3.mouse(that)[1]) < 30;
    };

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

    c3_chart_internal_fn.initText = function C3_INTERNAL_initText() {
        var $$ = this;
        $$.main.select('.' + CLASS.chart).append("g")
            .attr("class", CLASS.chartTexts);
        $$.mainText = $$.d3.selectAll([]);
    };
    c3_chart_internal_fn.updateTargetsForText = function C3_INTERNAL_updateTargetsForText(targets) {
        var $$ = this, 
            mainTextUpdate, mainTextEnter,
            classChartText = $$.classChartText.bind($$),
            classTexts = $$.classTexts.bind($$),
            classFocus = $$.classFocus.bind($$);
        mainTextUpdate = $$.main.select('.' + CLASS.chartTexts).selectAll('.' + CLASS.chartText)
            .data(targets)
            .attr('class', function (d) { 
                return classChartText(d) + classFocus(d); 
            });
        mainTextEnter = mainTextUpdate.enter().append('g')
            .attr('class', classChartText)
            .style('opacity', 0)
            .style("pointer-events", "none");
        mainTextEnter.append('g')
            .attr('class', classTexts);
    };
    c3_chart_internal_fn.getLabelColor = function C3_INTERNAL_getLabelColor(d) {
        if (this.config.data_labels && this.config.data_labels.color) {
            return this.config.data_labels.color;
        }
        if (this.config.axis_rotated &&
            ((d.anchor === 'start' && d.value < 0) || (d.anchor === 'end' && d.value > 0))) {
            return 'white';
        }
        return this.color(d);
    };
    c3_chart_internal_fn.updateText = function C3_INTERNAL_updateText(durationForExit, barIndices) {
        var $$ = this, 
        config = $$.config,
            threshold = (config.data_labels && config.data_labels.threshold) || 0,
            drawText = $$.generateDrawBarText(barIndices, threshold),
            classText = $$.classText.bind($$);

        $$.mainText = $$.main.selectAll('.' + CLASS.texts).selectAll('.' + CLASS.text)
            .data(function (d, i) {
                return $$.barOrLineData(d);
            });
        $$.mainText.enter().append('text')
            .attr("class", classText)
            .attr('text-anchor', function (d) {
                var anchor = (config.data_labels && config.data_labels.anchor) || 'auto';
                if (anchor === 'auto') {
                    if (config.axis_rotated) {
                        anchor = d.value < 0 ? 'end' : 'start';
                    } else {
                        anchor = 'middle';
                    }
                }
                d.anchor = anchor;
                return anchor;
            })
            .style("stroke", 'none')
            .style("fill", function (d) { 
                return $$.getLabelColor(d); 
            })
            .style("fill-opacity", 0);
        $$.mainText
            .text(drawText);
            // old:
            //.text(function (d, i, j) { 
            //    return $$.dataLabelFormat(d.id)(d.value, d.id, i, j); 
            //});
        $$.mainText.exit()
            .transition().duration(durationForExit)
            .style('fill-opacity', 0)
            .remove();
    };
    c3_chart_internal_fn.generateDrawBarText = function C3_INTERNAL_generateDrawBarText(barIndices, threshold) {
        var $$ = this,
            getPoints = $$.generateGetBarPoints(barIndices, false);

        return function (d, i) {
            // 4 points that make a bar
            var points = getPoints(d, i);
            var width = Math.abs(points[0][1] - points[1][1]);
            var text = '';
            if (width > threshold) {
                text = $$.dataLabelFormat(d.id)(d.value, d.id, i);
            }
            return text;
        };
    };

    //c3_chart_internal_fn.addTransitionForText = function C3_INTERNAL_addTransitionForText(transitions, xForText, yForText, forFlow)
    c3_chart_internal_fn.redrawText = function C3_INTERNAL_redrawText(xForText, yForText, forFlow, withTransition) {
        console.count('redrawText');
        var $$ = this,
            config = $$.config,
            opacityForText = forFlow ? 0 : $$.opacityForText.bind($$);

        return [
            (withTransition ? this.mainText.transition() : this.mainText)
                .attr('x', xForText)
                .attr('y', yForText)
                .attr('dx', function (d) {
                    if (config.axis_rotated) {
                        var anchor = (config.data_labels && config.data_labels.anchor) || 'auto';
                        if (anchor === 'start' && d.value < 0) {
                            return '1em';
                        }
                        if (anchor === 'end' && d.value > 0) {
                            return '-1em';
                        }
                    }
                    return 0;
                })
                .style("fill", function (d) { 
                    return $$.getLabelColor(d); 
                })
                .style("fill-opacity", opacityForText)
        ];
    };
    c3_chart_internal_fn.getTextRect = function C3_INTERNAL_getTextRect(element, cls) {
        var dummy = this.d3.select('body').append('div').classed('c3', true),
            svg = dummy.append("svg").style('visibility', 'hidden').style('position', 'fixed').style('top', 0).style('left', 0),
            text = element.textContent,
            rect,
            count = 0;
        svg.selectAll('.dummy')
            .data([text])
          .enter().append('text')
            .classed(cls ? cls : "", true)
            .text(text)
          .each(function () {
            count++; 
            rect = this.getBoundingClientRect(); 
          });
        dummy.remove();
        console.count('getTextRect: count = ' + count);
        //assert(count === 1);
        return rect;
    };
    c3_chart_internal_fn.generateXYForText = function C3_INTERNAL_generateXYForText(areaIndices, barIndices, lineIndices, forX) {
        var $$ = this,
            getAreaPoints = $$.generateGetAreaPoints(areaIndices, false),
            getBarPoints = $$.generateGetBarPoints(barIndices, false),
            getLinePoints = $$.generateGetLinePoints(lineIndices, false),
            getter = forX ? $$.getXForText : $$.getYForText;
        return function (d, i) {
            var getPoints = $$.isAreaType(d) ? getAreaPoints : $$.isBarType(d) ? getBarPoints : getLinePoints;
            return getter.call($$, getPoints(d, i), d, this);
        };
    };
    c3_chart_internal_fn.getXForText = function C3_INTERNAL_getXForText(points, d, textElement) {
        var $$ = this,
            box = textElement.getBoundingClientRect(), 
            xPos, padding;
        if ($$.config.axis_rotated) {
            padding = $$.isBarType(d) ? 4 : 6;
            xPos = points[2][1] + padding * (d.value < 0 ? -1 : 1);
        } else {
            xPos = $$.hasType('bar') ? (points[2][0] + points[0][0]) / 2 : points[0][0];
        }
        // show labels regardless of the domain if value is null
        if (d.value === null) {
            if (xPos > $$.width) {
                xPos = $$.width - box.width;
            } else if (xPos < 0) {
                xPos = 4;
            }
        }
        return xPos;
    };
    c3_chart_internal_fn.getYForText = function C3_INTERNAL_getYForText(points, d, textElement) {
        var $$ = this,
            box = textElement.getBoundingClientRect(),
            yPos;
        if ($$.config.axis_rotated) {
            yPos = (points[0][0] + points[2][0] + box.height * 0.6) / 2;
        } else {
            yPos = points[2][1];
            if (d.value < 0  || (d.value === 0 && !$$.hasPositiveValue)) {
                yPos += box.height;
                if ($$.isBarType(d) && $$.isSafari()) {
                    yPos -= 3;
                }
                else if (!$$.isBarType(d) && $$.isChrome()) {
                    yPos += 3;
                }
            } else {
                yPos += $$.isBarType(d) ? -3 : -6;
            }
        }
        // show labels regardless of the domain if value is null
        if (d.value === null && !$$.config.axis_rotated) {
            if (yPos < box.height) {
                yPos = box.height;
            } else if (yPos > this.height) {
                yPos = this.height - 4;
            }
        }
        return yPos;
    };

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
        return d3.svg.lineInterpolators.indexOf(type) >= 0;
    };

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

    c3_chart_internal_fn.initTooltip = function C3_INTERNAL_initTooltip() {
        var $$ = this, 
            config = $$.config, 
            i;
        $$.tooltip = $$.selectChart
            .style("position", "relative")
          .append("div")
            .attr('class', CLASS.tooltipContainer)
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("display", "none");
        // Show tooltip if needed
        if (config.tooltip_init_show) {
            if ($$.isTimeSeries() && isString(config.tooltip_init_x)) {
                config.tooltip_init_x = $$.parseDate(config.tooltip_init_x);
                for (i = 0; i < $$.data.targets[0].values.length; i++) {
                    if (($$.data.targets[0].values[i].x - config.tooltip_init_x) === 0) { break; }
                }
                config.tooltip_init_x = i;
            }
            $$.tooltip.html(config.tooltip_contents.call($$, $$.data.targets.map(function (d) {
                return $$.addName(d.values[config.tooltip_init_x]);
            }), $$.axis.getXAxisTickFormat(), $$.getYFormat($$.hasArcType()), $$.color));
            $$.tooltip.style("top", config.tooltip_init_position.top)
                .style("left", config.tooltip_init_position.left)
                .style("display", "block");
        }
    };
    c3_chart_internal_fn.getTooltipContent = function C3_INTERNAL_getTooltipContent(d, defaultTitleFormat, defaultValueFormat, color) {
        var $$ = this, 
            config = $$.config,
            titleFormat = config.tooltip_format_title || defaultTitleFormat,
            nameFormat = config.tooltip_format_name || function (name) { 
                return name; 
            },
            valueFormat = config.tooltip_format_value || defaultValueFormat,
            text, i, title, value, name, bgcolor,
            orderAsc = $$.isOrderAsc();

        if (config.data_groups.length === 0) {
            if (config.data_order) {
                d.sort(function (a, b) {
                    var v1 = a ? a.value : null, 
    	            v2 = b ? b.value : null;
                    return orderAsc ? v1 - v2 : v2 - v1;
                });
            }
        } else {
            var ids = $$.orderTargets($$.data.targets.slice(0)).map(function (i) {
                return i.id;
            });
            d.sort(function (a, b) {
                var v1 = a ? a.value : null, 
    	        v2 = b ? b.value : null;
                if (v1 > 0 && v2 > 0) {
                    v1 = a ? ids.indexOf(a.id) : null;
                    v2 = b ? ids.indexOf(b.id) : null;
                }
                return orderAsc ? v1 - v2 : v2 - v1;
            });
        }

        for (i = 0; i < d.length; i++) {
            if (!(d[i] && (d[i].value || d[i].value === 0))) { continue; }

            if (!text) {
                title = sanitise(titleFormat ? titleFormat(d[i].x) : d[i].x);
                text = "<table class='" + $$.CLASS.tooltip + "'>" + (title || title === 0 ? "<tr><th colspan='2'>" + title + "</th></tr>" : "");
            }

            value = sanitise(valueFormat(d[i].value, d[i].ratio, d[i].id, d[i].index, d));
            if (value !== undefined) {
                // Skip elements when their name is set to null
                if (d[i].name === null) { continue; }
                name = sanitise(nameFormat(d[i].name, d[i].ratio, d[i].id, d[i].index));
                bgcolor = $$.levelColor ? $$.levelColor(d[i].value) : color(d[i].id);

                text += "<tr class='" + $$.CLASS.tooltipName + "-" + $$.getTargetSelectorSuffix(d[i].id) + "'>";
                text += "<td class='name'><span style='background-color:" + bgcolor + "'></span>" + name + "</td>";
                text += "<td class='value'>" + value + "</td>";
                text += "</tr>";
            }
        }
        return text + "</table>";
    };
    c3_chart_internal_fn.tooltipPosition = function C3_INTERNAL_tooltipPosition(dataToShow, tWidth, tHeight, element) {
        var $$ = this, 
            config = $$.config, 
            d3 = $$.d3;
        var svgLeft, tooltipLeft, tooltipRight, tooltipTop, chartRight;
        var forArc = $$.hasArcType(),
            mouse = d3.mouse(element);
        // Determine tooltip position
        if (forArc) {
            tooltipLeft = (($$.width - ($$.isLegendRight ? $$.getLegendWidth() : 0)) / 2) + mouse[0];
            tooltipTop = ($$.height / 2) + mouse[1] + 20;
        } else {
            svgLeft = $$.getSvgLeft(true);
            if (config.axis_rotated) {
                tooltipLeft = svgLeft + mouse[0] + 100;
                tooltipRight = tooltipLeft + tWidth;
                chartRight = $$.currentWidth - $$.getCurrentPaddingRight();
                tooltipTop = $$.x(dataToShow[0].x) + 20;
            } else {
                tooltipLeft = svgLeft + $$.getCurrentPaddingLeft(true) + $$.x(dataToShow[0].x) + 20;
                tooltipRight = tooltipLeft + tWidth;
                chartRight = svgLeft + $$.currentWidth - $$.getCurrentPaddingRight();
                tooltipTop = mouse[1] + 15;
            }

            if (tooltipRight > chartRight) {
                // 20 is needed for Firefox to keep tooltip width
                tooltipLeft = $$.x(dataToShow[0].x) - tWidth + $$.getCurrentPaddingLeft(true) - 20;
            }
            if (tooltipTop + tHeight > $$.currentHeight) {
                tooltipTop -= tHeight + 30;
            }
        }
        if (tooltipTop < 0) {
            tooltipTop = 0;
        }
        return {top: tooltipTop, left: tooltipLeft};
    };
    c3_chart_internal_fn.showTooltip = function C3_INTERNAL_showTooltip(selectedData, element) {
        var $$ = this, 
            config = $$.config;
        var tWidth, tHeight, position;
        var forArc = $$.hasArcType(),
            dataToShow = selectedData.filter(function (d) { 
                return d && isValue(d.value); 
            }),
            positionFunction = config.tooltip_position || c3_chart_internal_fn.tooltipPosition;
        if (dataToShow.length === 0 || !config.tooltip_show) {
            return;
        }
        var tooltip = $$.tooltip.html(config.tooltip_contents.call($$, selectedData, $$.axis.getXAxisTickFormat(), $$.getYFormat(forArc), $$.color));
        if ($$.config.tooltip_animation_show) {
            tooltip = tooltip
                        .style("opacity", 0)
                        .style("display", "block")
                        .transition()
                        .delay($$.config.tooltip_animation_delay)
                        .duration($$.config.tooltip_animation_duration)
                        .ease($$.config.tooltip_animation_ease)
                        .style("opacity", 1);
        } else {
            tooltip.style("display", "block");
        }

        // Get tooltip dimensions
        tWidth = $$.tooltip.property('offsetWidth');
        tHeight = $$.tooltip.property('offsetHeight');

        position = positionFunction.call(this, dataToShow, tWidth, tHeight, element);
        // Set tooltip
        $$.tooltip
            .style("top", position.top + "px")
            .style("left", position.left + 'px');
    };
    c3_chart_internal_fn.hideTooltip = function C3_INTERNAL_hideTooltip() {
        this.tooltip.style("display", "none");
    };

    c3_chart_internal_fn.initLegend = function C3_INTERNAL_initLegend() {
        var $$ = this;
        $$.legendItemTextBox = {};
        $$.legendHasRendered = false;
        $$.legend = $$.svg.append("g").attr("transform", $$.getTranslate('legend'));
        if (!$$.config.legend_show) {
            $$.legend.style('visibility', 'hidden');
            $$.hiddenLegendIds = $$.mapToIds($$.data.targets);
            return;
        }
        // MEMO: call here to update legend box and translate for all
        // MEMO: translate will be updated by this, so transform not needed in updateLegend()
        $$.updateLegendWithDefaults();
    };
    c3_chart_internal_fn.updateLegendWithDefaults = function C3_INTERNAL_updateLegendWithDefaults() {
        var $$ = this;
        $$.updateLegend($$.mapToIds($$.data.targets), {withTransform: false, withTransitionForTransform: false, withTransition: false});
    };
    c3_chart_internal_fn.updateSizeForLegend = function C3_INTERNAL_updateSizeForLegend(legendHeight, legendWidth) {
        var $$ = this, 
            config = $$.config, 
            insetLegendPosition = {
                top: $$.isLegendTop ? $$.getCurrentPaddingTop() + config.legend_inset_y + 5.5 : $$.currentHeight - legendHeight - $$.getCurrentPaddingBottom() - config.legend_inset_y,
                left: $$.isLegendLeft ? $$.getCurrentPaddingLeft() + config.legend_inset_x + 0.5 : $$.currentWidth - legendWidth - $$.getCurrentPaddingRight() - config.legend_inset_x + 0.5
            };

        $$.margin3 = {
            top: ($$.isLegendRight || $$.isLegendTopRight) ? 20 : $$.isLegendInset ? insetLegendPosition.top : $$.currentHeight - legendHeight,
            right: NaN,
            bottom: 0,
            left: ($$.isLegendRight || $$.isLegendTopRight) ? $$.currentWidth - legendWidth : $$.isLegendInset ? insetLegendPosition.left : 0
        };
    };
    c3_chart_internal_fn.transformLegend = function C3_INTERNAL_transformLegend(withTransition) {
        var $$ = this;
        (withTransition ? $$.legend.transition() : $$.legend).attr("transform", $$.getTranslate('legend'));
    };
    c3_chart_internal_fn.updateLegendStep = function C3_INTERNAL_updateLegendStep(step) {
        this.legendStep = step;
    };
    c3_chart_internal_fn.updateLegendItemWidth = function C3_INTERNAL_updateLegendItemWidth(w) {
        this.legendItemWidth = w;
    };
    c3_chart_internal_fn.updateLegendItemHeight = function C3_INTERNAL_updateLegendItemHeight(h) {
        this.legendItemHeight = h;
    };
    c3_chart_internal_fn.getLegendCount = function () {
        return this.d3.keys(this.data.xs).length;
    };
    c3_chart_internal_fn.getLegendWidth = function C3_INTERNAL_getLegendWidth() {
        var $$ = this;
        return $$.config.legend_show ?
            $$.isLegendTopRight ? $$.currentWidth :
            $$.isLegendRight || $$.isLegendInset ? $$.legendItemWidth * ($$.legendStep + 1) : $$.currentWidth : 0;
    };
    c3_chart_internal_fn.getLegendHeight = function C3_INTERNAL_getLegendHeight() {
        var $$ = this, h = 0;
        if ($$.config.legend_show) {
            if ($$.isLegendRight) {
                h = $$.currentHeight;
            } else {
                h = Math.max(20, $$.legendItemHeight) * ($$.legendStep + 1);
            }
        }
        return h;
    };
    c3_chart_internal_fn.opacityForLegend = function C3_INTERNAL_opacityForLegend(legendItem) {
        return legendItem.classed(CLASS.legendItemHidden) ? null : 1;
    };
    c3_chart_internal_fn.opacityForUnfocusedLegend = function C3_INTERNAL_opacityForUnfocusedLegend(legendItem) {
        return legendItem.classed(CLASS.legendItemHidden) ? null : 0.3;
    };
    c3_chart_internal_fn.toggleFocusLegend = function C3_INTERNAL_toggleFocusLegend(targetIds, focus) {
        var $$ = this;
        targetIds = $$.mapToTargetIds(targetIds);
        $$.legend.selectAll('.' + CLASS.legendItem)
            .filter(function (id) { 
                return targetIds.indexOf(id) >= 0; 
            })
            .classed(CLASS.legendItemFocused, focus)
          .transition().duration(100)
            .style('opacity', function () {
                var opacity = focus ? $$.opacityForLegend : $$.opacityForUnfocusedLegend;
                return opacity.call($$, $$.d3.select(this));
            });
    };
    c3_chart_internal_fn.revertLegend = function C3_INTERNAL_revertLegend() {
        var $$ = this, 
            d3 = $$.d3;
        $$.legend.selectAll('.' + CLASS.legendItem)
            .classed(CLASS.legendItemFocused, false)
            .transition().duration(100)
            .style('opacity', function () { 
                return $$.opacityForLegend(d3.select(this)); 
            });
    };
    c3_chart_internal_fn.showLegend = function C3_INTERNAL_showLegend(targetIds) {
        var $$ = this, 
            config = $$.config;
        if (!config.legend_show) {
            config.legend_show = true;
            $$.legend.style('visibility', 'visible');
            if (!$$.legendHasRendered) {
                $$.updateLegendWithDefaults();
            }
        }
        $$.removeHiddenLegendIds(targetIds);
        $$.legend.selectAll($$.selectorLegends(targetIds))
            .style('visibility', 'visible')
            .transition()
            .style('opacity', function () { 
                return $$.opacityForLegend($$.d3.select(this)); 
            });
    };
    c3_chart_internal_fn.hideLegend = function C3_INTERNAL_hideLegend(targetIds) {
        var $$ = this, 
            config = $$.config;
        if (config.legend_show && isEmpty(targetIds)) {
            config.legend_show = false;
            $$.legend.style('visibility', 'hidden');
        }
        $$.addHiddenLegendIds(targetIds);
        $$.legend.selectAll($$.selectorLegends(targetIds))
            .style('opacity', 0)
            .style('visibility', 'hidden');
    };
    c3_chart_internal_fn.clearLegendItemTextBoxCache = function C3_INTERNAL_clearLegendItemTextBoxCache() {
        this.legendItemTextBox = {};
    };
    c3_chart_internal_fn.updateLegend = function C3_INTERNAL_updateLegend(targetIds, options, transitions) {
        var $$ = this, 
            config = $$.config;
        var xForLegend, xForLegendText, xForLegendRect, yForLegend, yForLegendText, yForLegendRect, x1ForLegendTile, x2ForLegendTile, yForLegendTile;
        var paddingTop = 4, 
            paddingRight = 10, 
            maxWidth = 0, 
            maxHeight = 0, 
            posMin = 10, 
            tileWidth = config.legend_item_tile_width + 5;
        var l, 
            totalLength = 0, 
            offsets = {}, 
            widths = {}, 
            heights = {}, 
            margins = [0], 
            steps = {}, 
            step = 0;
        var withTransition, withTransitionForTransform;
        var texts, rects, tiles, background;

        // Skip elements when their name is set to null
        targetIds = targetIds.filter(function (id) {
            return !isDefined(config.data_names[id]) || config.data_names[id] !== null;
        });

        options = options || {};
        withTransition = getOption(options, "withTransition", config.transition_duration > 0);
        withTransitionForTransform = getOption(options, "withTransitionForTransform", withTransition);

        function getTextBox(textElement, id) {
            if (!$$.legendItemTextBox[id]) {
                $$.legendItemTextBox[id] = $$.getTextRect(textElement, CLASS.legendItem);
            }
            return $$.legendItemTextBox[id];
        }

        function updatePositions(textElement, id, index) {
            var reset = index === 0, isLast = index === targetIds.length - 1,
                box = getTextBox(textElement, id),
                itemWidth = box.width + tileWidth + (isLast && !($$.isLegendRight || $$.isLegendInset) ? 0 : paddingRight) + config.legend_padding,
                itemHeight = box.height + paddingTop,
                itemLength = $$.isLegendRight || ($$.isLegendInset && !$$.isLegendTop) ? itemHeight : itemWidth,
                areaLength = $$.isLegendRight || $$.isLegendInset ? $$.getLegendHeight() : $$.getLegendWidth(),
                margin, maxLength;

            // MEMO: care about condition of step, totalLength
            function updateValues(id, withoutStep) {
                if (!withoutStep) {
                    margin = (areaLength - totalLength - itemLength) / 2;
                    if (margin < posMin) {
                        margin = (areaLength - itemLength) / 2;
                        totalLength = 0;
                        step++;
                    }
                }
                steps[id] = $$.legendStep ? $$.legendStep : step;
                margins[step] = $$.isLegendInset ? 10 : margin;
                offsets[id] = totalLength;
                totalLength += itemLength;
            }

            if (reset) {
                totalLength = 0;
                step = 0;
                maxWidth = 0;
                maxHeight = 0;
            }

            if (config.legend_show && !$$.isLegendToShow(id)) {
                widths[id] = heights[id] = steps[id] = offsets[id] = 0;
                return;
            }

            widths[id] = itemWidth;
            heights[id] = itemHeight;

            if (!maxWidth || itemWidth >= maxWidth) { 
                maxWidth = itemWidth; 
            }
            if (!maxHeight || itemHeight >= maxHeight) { 
                maxHeight = itemHeight; 
            }
            maxLength = $$.isLegendRight || $$.isLegendInset ? maxHeight : maxWidth;

            if (config.legend_equally) {
                Object.keys(widths).forEach(function (id) { 
                    widths[id] = maxWidth; 
                });
                Object.keys(heights).forEach(function (id) { 
                    heights[id] = maxHeight; 
                });
                margin = (areaLength - maxLength * targetIds.length) / 2;
                if (margin < posMin) {
                    totalLength = 0;
                    step = 0;
                    targetIds.forEach(function (id) { 
                        updateValues(id); 
                    });
                }
                else {
                    updateValues(id, true);
                }
            } else {
                updateValues(id);
            }
        }

        if ($$.isLegendInset) {
            step = config.legend_inset_step;
            $$.updateLegendStep(step);
        }

        if ($$.isLegendRight) {
            xForLegend = function (id) { 
                return maxWidth * steps[id]; 
            };
            yForLegend = function (id) { 
                return margins[steps[id]] + offsets[id]; 
            };
        } else if ($$.isLegendInset) {
            xForLegend = function (id) {
              var offset = 0;
              for (var key in widths) {
                if (key === id) {
                  break;
                }
                offset += widths[key];
              }
              return offset * steps[id];
            };
            yForLegend = function (id) { 
                return margins[steps[id]] + offsets[id]; 
            };
        } else {
            xForLegend = function (id) { 
                return margins[steps[id]] + offsets[id]; 
            };
            yForLegend = function (id) { 
                return maxHeight * steps[id]; 
            };
        }
        xForLegendText = function (id, i) { 
            return xForLegend(id, i) + 4 + config.legend_item_tile_width; 
        };
        yForLegendText = function (id, i) { 
            return yForLegend(id, i) + 9; 
        };
        xForLegendRect = function (id, i) { 
            return xForLegend(id, i); 
        };
        yForLegendRect = function (id, i) { 
            return yForLegend(id, i) - 5; 
        };
        x1ForLegendTile = function (id, i) { 
            return xForLegend(id, i) - 2; 
        };
        x2ForLegendTile = function (id, i) { 
            return xForLegend(id, i) - 2 + config.legend_item_tile_width; 
        };
        yForLegendTile = function (id, i) { 
            return yForLegend(id, i) + 4; 
        };

        // Define g for legend area
        l = $$.legend.selectAll('.' + CLASS.legendItem)
            .data(targetIds)
            .enter().append('g')
            .attr('class', function (id) { 
                return $$.generateClass(CLASS.legendItem, id); 
            })
            .style('visibility', function (id) { 
                return $$.isLegendToShow(id) ? 'visible' : 'hidden'; 
            })
            .style('cursor', 'pointer')
            .on('click', function (id) {
                if (config.legend_item_onclick) {
                    config.legend_item_onclick.call($$, id);
                } else {
                    if ($$.d3.event.altKey) {
                        $$.api.hide();
                        $$.api.show(id);
                    } else {
                        $$.api.toggle(id);
                        $$.isTargetToShow(id) ? $$.api.focus(id) : $$.api.revert();
                    }
                }
            })
            .on('mouseover', function (id) {
                if (config.legend_item_onmouseover) {
                    config.legend_item_onmouseover.call($$, id);
                }
                else {
                    $$.d3.select(this).classed(CLASS.legendItemFocused, true);
                    if (!$$.transiting && $$.isTargetToShow(id)) {
                        $$.api.focus(id);
                    }
                }
            })
            .on('mouseout', function (id) {
                if (config.legend_item_onmouseout) {
                    config.legend_item_onmouseout.call($$, id);
                }
                else {
                    $$.d3.select(this).classed(CLASS.legendItemFocused, false);
                    $$.api.revert();
                }
            });
        l.append('text')
            .text(function (id) { 
                return isDefined(config.data_names[id]) ? config.data_names[id] : id; 
            })
            .each(function (id, i) { 
                updatePositions(this, id, i); 
            })
            .style("pointer-events", "none")
            .attr('x', $$.isLegendRight || $$.isLegendInset ? xForLegendText : -200)
            .attr('y', $$.isLegendRight || $$.isLegendInset ? -200 : yForLegendText);
        l.append('rect')
            .attr("class", CLASS.legendItemEvent)
            .style('fill-opacity', 0)
            .attr('x', $$.isLegendRight || $$.isLegendInset ? xForLegendRect : -200)
            .attr('y', $$.isLegendRight || $$.isLegendInset ? -200 : yForLegendRect);
        l.append('line')
            .style('stroke', $$.color)
            .style("pointer-events", "none")
            .attr('x1', $$.isLegendRight || $$.isLegendInset ? x1ForLegendTile : -200)
            .attr('y1', $$.isLegendRight || $$.isLegendInset ? -200 : yForLegendTile)
            .attr('x2', $$.isLegendRight || $$.isLegendInset ? x2ForLegendTile : -200)
            .attr('y2', $$.isLegendRight || $$.isLegendInset ? -200 : yForLegendTile)
            .attr('stroke-width', config.legend_item_tile_height)
            .attr('class', function (id) { 
                return config.data_classes[id] ? config.data_classes[id] + ' ' + CLASS.legendItemTile : CLASS.legendItemTile; 
            });

        // Set background for inset legend
        background = $$.legend.select('.' + CLASS.legendBackground + ' rect');
        if ($$.isLegendInset && maxWidth > 0 && background.size() === 0) {
            background = $$.legend.insert('g', '.' + CLASS.legendItem)
                .attr("class", CLASS.legendBackground)
                .append('rect');
        }

        texts = $$.legend.selectAll('text')
            .data(targetIds)
            .text(function (id) { 
                // MEMO: needed for update
                return isDefined(config.data_names[id]) ? config.data_names[id] : id; 
            })
            .each(function (id, i) { 
                updatePositions(this, id, i); 
            });
        (withTransition ? texts.transition() : texts)
            .attr('x', xForLegendText)
            .attr('y', yForLegendText);

        rects = $$.legend.selectAll('rect.' + CLASS.legendItemEvent)
            .data(targetIds);
        (withTransition ? rects.transition() : rects)
            .attr('width', function (id) { 
                return widths[id]; 
            })
            .attr('height', function (id) { 
                return heights[id]; 
            })
            .attr('x', xForLegendRect)
            .attr('y', yForLegendRect);

        tiles = $$.legend.selectAll('line.' + CLASS.legendItemTile)
                .data(targetIds);
            (withTransition ? tiles.transition() : tiles)
                .style('stroke', $$.levelColor ? function (id) {
                    return $$.levelColor($$.cache[id].values[0].value);
                } : $$.color)
                .attr('x1', x1ForLegendTile)
                .attr('y1', yForLegendTile)
                .attr('x2', x2ForLegendTile)
                .attr('y2', yForLegendTile);

        if (background) {
            (withTransition ? background.transition() : background)
                .attr('height', $$.getLegendHeight() - 12)
                .attr('width', maxWidth * (step + 1) + 10);
        }

        // toggle legend state
        $$.legend.selectAll('.' + CLASS.legendItem)
            .classed(CLASS.legendItemHidden, function (id) { 
                return !$$.isTargetToShow(id); 
            });

        // Update all to reflect change of legend
        $$.updateLegendItemWidth(maxWidth);
        $$.updateLegendItemHeight(maxHeight);
        $$.updateLegendStep(step);
        // Update size and scale
        $$.updateSizes();
        $$.updateScales();
        $$.updateSvgSize();
        // Update g positions
        $$.transformAll(withTransitionForTransform, transitions);
        $$.legendHasRendered = true;
    };

    c3_chart_internal_fn.initTitle = function C3_INTERNAL_initTitle() {
        var $$ = this;
        $$.title = $$.svg.append("text")
              .text($$.config.title_text)
    //          .attr("x", $$.xForTitle.bind($$))
    //          .attr("y", $$.yForTitle.bind($$))
              .attr("class", $$.CLASS.title);
    };

    c3_chart_internal_fn.redrawTitle = function C3_INTERNAL_redrawTitle() {
        console.count('redrawTitle');
        var $$ = this;
        $$.title
              .attr("x", $$.xForTitle.bind($$))
              .attr("y", $$.yForTitle.bind($$));
    };
    c3_chart_internal_fn.xForTitle = function C3_INTERNAL_xForTitle() {
        var $$ = this, 
            config = $$.config, 
            position = config.title_position || 'left', 
            x;                 
        /*
        TODO: re-integrate title_x/title_y:
        
              .attr("x", $$.config.title_x)
              .attr("y", $$.getCurrentPaddingTop() + $$.config.title_y)
        */
        if (position.indexOf('right') >= 0) {
            x = $$.currentWidth - $$.getTextRect($$.title.node(), $$.CLASS.title).width - config.title_padding.right;
        } else if (position.indexOf('center') >= 0) {
            x = ($$.currentWidth - $$.getTextRect($$.title.node(), $$.CLASS.title).width) / 2;
        } else { // left
            x = config.title_padding.left;
        }
        return x;
    };
    c3_chart_internal_fn.yForTitle = function C3_INTERNAL_yForTitle() {
        var $$ = this, 
            position = $$.config.title_position || 'left',
            textRect = $$.getTextRect($$.title.node(), $$.CLASS.title);
        if (position.indexOf('bottom') >= 0) {
          return $$.getCurrentHeight() - ($$.config.title_padding.bottom + textRect.height);
        }
        return $$.config.title_padding.top + textRect.height;
    };
    c3_chart_internal_fn.getTitlePadding = function C3_INTERNAL_getTitlePadding() {
        var $$ = this, position = $$.config.title_position || 'left';
        if (position.indexOf('bottom') !== -1) {
          return $$.config.title_padding.bottom + $$.config.title_padding.top;
        }
        return $$.yForTitle() + $$.config.title_padding.bottom;
    };


    c3_chart_internal_fn.initHeader = function C3_INTERNAL_initHeader() {
      var $$ = this;
      if ($$.config.header_show /* && $$.getCurrentPaddingTop() */ ) {
          var header_height = $$.getCurrentPaddingTop();
          var header_border_offset = header_height;
          $$.header = $$.svg.append("rect")
                .attr("class", "c3-chart-header")
                .attr("style", "fill: " + $$.config.header_color)
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", $$.getCurrentWidth())
                .attr("height", header_height);

          if ($$.config.header_border_show) {
              $$.headerBorder = $$.svg.append("line")
                    .attr("class", "c3-chart-header-border")
                    .attr("style", "stroke-width: " + $$.config.header_border_width + 
                          "; stroke: " + $$.config.header_border_color)
                    .attr("x1", 0)
                    .attr("x2", $$.getCurrentWidth())
                    .attr("y1", header_border_offset)
                    .attr("y2", header_border_offset);
          }
      }
    };
    c3_chart_internal_fn.redrawHeader = function C3_INTERNAL_redrawHeader() {
        console.count('redrawHeader');
        var $$ = this;
        if ($$.header) {
            var header_height = $$.getCurrentPaddingTop();
            $$.header
                .attr("width", $$.getCurrentWidth())
                .attr("height", header_height);
        }

        if ($$.headerBorder) {
            $$.headerBorder
                .attr("x2", $$.getCurrentWidth());
        }
    };

    c3_chart_internal_fn.initFooter = function C3_INTERNAL_initFooter() {
      var $$ = this;
      if ($$.config.footer_show /* && $$.getCurrentPaddingBottom() */ ) {
          var footer_height = $$.getCurrentPaddingBottom();
          var footer_border_offset = $$.getCurrentHeight() - $$.config.footer_height - $$.getCurrentPaddingTop();
          $$.footer = $$.svg.append("rect")
                .attr("class", "c3-chart-footer")
                .attr("style", "fill: " + $$.config.footer_color)
                .attr("x", 0)
                .attr("y", footer_height)
                .attr("width", $$.getCurrentWidth())
                .attr("height", footer_height);

          if ($$.config.footer_border_show) {
              $$.footerBorder = $$.svg.append("line")
                    .attr("class", "c3-chart-footer-border")
                    .attr("style", "stroke-width: " + $$.config.footer_border_width +
                          "; stroke: " + $$.config.footer_border_color)
                    .attr("x1", 0)
                    .attr("x2", $$.getCurrentWidth())
                    .attr("y1", footer_border_offset)
                    .attr("y2", footer_border_offset);
          }
      }
    };
    c3_chart_internal_fn.redrawFooter = function C3_INTERNAL_redrawFooter() {
        console.count('redrawFooter');
        var $$ = this;
        if ($$.footer) {
            var footer_height = $$.getCurrentPaddingBottom();
            $$.footer
                .attr("width", $$.getCurrentWidth())
                .attr("height", footer_height);
        }

        if ($$.footerBorder) {
            $$.footerBorder
                .attr("x2", $$.getCurrentWidth());
        }
    };

    function Axis(owner) {
        API.call(this, owner);
    }

    inherit(API, Axis);

    Axis.prototype.init = function C3_API_AXIS_init() {
        var $$ = this.owner, 
            config = $$.config, 
            main = $$.main;
        $$.axes.x = main.append("g")
            .attr("class", CLASS.axis + ' ' + CLASS.axisX)
            //.attr("clip-path", $$.clipPathForXAxis)
            .attr("transform", $$.getTranslate('x'))
            .style("visibility", config.axis_x_show ? 'visible' : 'hidden');
        $$.axes.x.append("text")
            .attr("class", CLASS.axisXLabel)
            .attr("transform", this.isAxisLabelRotate("x") ? "rotate(-90)" : "")
            .style("text-anchor", this.textAnchorForXAxisLabel.bind(this));
        $$.axes.y = main.append("g")
            .attr("class", CLASS.axis + ' ' + CLASS.axisY)
            //.attr("clip-path", config.axis_y_inner ? "" : $$.clipPathForYAxis)
            .attr("transform", $$.getTranslate('y'))
            .style("visibility", config.axis_y_show ? 'visible' : 'hidden');
        $$.axes.y.append("text")
            .attr("class", CLASS.axisYLabel)
            .attr("transform", this.isAxisLabelRotate("y") ? "" : "rotate(-90)")
            .style("text-anchor", this.textAnchorForYAxisLabel.bind(this));

        $$.axes.y2 = main.append("g")
            .attr("class", CLASS.axis + ' ' + CLASS.axisY2)
            // clip-path?
            .attr("transform", $$.getTranslate('y2'))
            .style("visibility", config.axis_y2_show ? 'visible' : 'hidden');
        $$.axes.y2.append("text")
            .attr("class", CLASS.axisY2Label)
            .attr("transform", this.isAxisLabelRotate("y2") ? "" : "rotate(-90)")
            .style("text-anchor", this.textAnchorForY2AxisLabel.bind(this));
    };
    Axis.prototype.getXAxis = function C3_API_AXIS_getXAxis(scale, orient, tickFormat, tickValues, withOuterTick, withoutTransition, withoutRotateTickText) {
        var $$ = this.owner, 
            config = $$.config,
            axisParams = {
                isCategory: $$.isCategorized(),
                withOuterTick: withOuterTick,
                tickMultiline: config.axis_x_tick_multiline,
                tickWidth: config.axis_x_tick_width,
                tickTextRotate: withoutRotateTickText ? 0 : config.axis_x_tick_rotate,
                withoutTransition: withoutTransition,
            },
            axis = c3_axis($$.d3, axisParams).scale(scale).orient(orient);

        if ($$.isTimeSeries() && tickValues && typeof tickValues !== "function") {
            tickValues = tickValues.map(function (v) { 
                return $$.parseDate(v); 
            });
        }

        // Set tick
        axis.tickFormat(tickFormat).tickValues(tickValues);
        if ($$.isCategorized()) {
            axis.tickCentered(config.axis_x_tick_centered);
            if (isEmpty(config.axis_x_tick_culling)) {
                config.axis_x_tick_culling = false;
            }
        }

        return axis;
    };
    Axis.prototype.updateXAxisTickValues = function C3_API_AXIS_updateXAxisTickValues(targets, axis) {
        var $$ = this.owner, 
            config = $$.config, 
            tickValues;
        if (config.axis_x_tick_fit || config.axis_x_tick_count) {
            tickValues = this.generateTickValues($$.mapTargetsToUniqueXs(targets), config.axis_x_tick_count, $$.isTimeSeries());
        }
        if (axis) {
            axis.tickValues(tickValues);
        } else {
            $$.xAxis.tickValues(tickValues);
            $$.subXAxis.tickValues(tickValues);
        }
        return tickValues;
    };
    Axis.prototype.getYAxis = function C3_API_AXIS_getYAxis(scale, orient, tickFormat, tickValues, withOuterTick, withoutTransition, withoutRotateTickText, isY2Axis) {
        // TODO: refactor the whole axis_x/y/y2 stuff to become one config block per axis: axis_x.xyz, axis_y.xyz, axis_y2.xyz -->
        // that way we can pass in the config block and not copy individual settings nor hardcode-check inside like we do now. :-(
        var $$ = this.owner,
            d3 = $$.d3,
            config = $$.config,
            axisParams = {
                withOuterTick: withOuterTick,
                tickMultiline: !isY2Axis ? config.axis_y_tick_multiline : config.axis_y2_tick_multiline,
                tickWidth: !isY2Axis ? config.axis_y_tick_width : config.axis_y2_tick_width,
                withoutTransition: withoutTransition,
                tickTextRotate: withoutRotateTickText ? 0 : config.axis_y_tick_rotate,
            },
            axis = c3_axis($$.d3, axisParams).scale(scale).orient(orient).tickFormat(tickFormat);
        if ($$.isTimeSeriesY()) {
            axis.ticks($$.d3.time[!isY2Axis ? config.axis_y_tick_time_value : config.axis_y2_tick_time_value], !isY2Axis ? config.axis_y_tick_time_interval : config.axis_y2_tick_time_interval);
        } else {
            axis.tickValues(tickValues);
        }
        return axis;
    };
    Axis.prototype.getId = function C3_API_AXIS_getId(id) {
        var config = this.owner.config;
        return id in config.data_axes ? config.data_axes[id] : 'y';
    };
    Axis.prototype.getXAxisTickFormat = function C3_API_AXIS_getXAxisTickFormat() {
        var $$ = this.owner, 
            config = $$.config,
            format = $$.isTimeSeries() ? $$.defaultAxisTimeFormat : $$.isCategorized() ? $$.categoryName : function C3_AXIS_defaultXAxisTickFormatter(v) { 
                return v < 0 ? v.toFixed(0) : v; 
            };
        if (config.axis_x_tick_format) {
            if (isFunction(config.axis_x_tick_format)) {
                format = config.axis_x_tick_format;
            } else if ($$.isTimeSeries()) {
                format = function C3_AXIS_defaultXAxisTickDateFormatter(date) {
                    return date ? $$.axisTimeFormat(config.axis_x_tick_format)(date) : "";
                };
            }
        }
        return isFunction(format) ? function C3_AXIS_XAxisTickFormatterWrapper(v) { 
            return format.call($$, v); 
        } : format;
    };
    Axis.prototype.getTickValues = function C3_API_AXIS_getTickValues(tickValues, axis) {
        return tickValues ? tickValues : axis ? axis.tickValues() : undefined;
    };
    Axis.prototype.getXAxisTickValues = function C3_API_AXIS_getXAxisTickValues() {
        return this.getTickValues(this.owner.config.axis_x_tick_values, this.owner.xAxis);
    };
    Axis.prototype.getYAxisTickValues = function C3_API_AXIS_getYAxisTickValues() {
        return this.getTickValues(this.owner.config.axis_y_tick_values, this.owner.yAxis);
    };
    Axis.prototype.getY2AxisTickValues = function C3_API_AXIS_getY2AxisTickValues() {
        return this.getTickValues(this.owner.config.axis_y2_tick_values, this.owner.y2Axis);
    };
    Axis.prototype.getLabelOptionByAxisId = function C3_API_AXIS_getLabelOptionByAxisId(axisId) {
        var $$ = this.owner, 
            config = $$.config, 
            option;
        if (axisId === 'y') {
            option = config.axis_y_label;
        } else if (axisId === 'y2') {
            option = config.axis_y2_label;
        } else if (axisId === 'x') {
            option = config.axis_x_label;
        }
        return option;
    };
    Axis.prototype.getLabelText = function C3_API_AXIS_getLabelText(axisId) {
        var option = this.getLabelOptionByAxisId(axisId);
        return isString(option) ? option : option ? option.text : null;
    };
    Axis.prototype.setLabelText = function C3_API_AXIS_setLabelText(axisId, text) {
        var $$ = this.owner, 
            config = $$.config,
            option = this.getLabelOptionByAxisId(axisId);
        if (isString(option)) {
            if (axisId === 'y') {
                config.axis_y_label = text;
            } else if (axisId === 'y2') {
                config.axis_y2_label = text;
            } else if (axisId === 'x') {
                config.axis_x_label = text;
            }
        } else if (option) {
            option.text = text;
        }
    };
    Axis.prototype.getLabelPosition = function C3_API_AXIS_getLabelPosition(axisId, defaultPosition) {
        var option = this.getLabelOptionByAxisId(axisId),
            position = (option && typeof option === 'object' && option.position) ? option.position : defaultPosition;
        return {
            isInner: position.indexOf('inner') >= 0,
            isOuter: position.indexOf('outer') >= 0,
            isLeft: position.indexOf('left') >= 0,
            isCenter: position.indexOf('center') >= 0,
            isRight: position.indexOf('right') >= 0,
            isTop: position.indexOf('top') >= 0,
            isMiddle: position.indexOf('middle') >= 0,
            isBottom: position.indexOf('bottom') >= 0
        };
    };
    Axis.prototype.getLabelRotateOption = function C3_API_AXIS_getLabelRotateOption(axisId) {
        var option = this.getLabelOptionByAxisId(axisId),
            rotate = (option && typeof option === 'object' && !isUndefined(option.rotate)) ? option.rotate : false;
        return rotate;
    };
    Axis.prototype.isAxisLabelRotate = function C3_API_AXIS_isAxisLabelRotate(axisId) {
        var rotate = this.getLabelRotateOption(axisId);
        return (!rotate && this.owner.config.axis_rotated) || (rotate && !this.owner.config.axis_rotated);
    };
    Axis.prototype.getXAxisLabelPosition = function C3_API_AXIS_getXAxisLabelPosition() {
        return this.getLabelPosition('x', this.owner.config.axis_rotated ? 'inner-top' : 'inner-right');
    };
    Axis.prototype.getYAxisLabelPosition = function C3_API_AXIS_getYAxisLabelPosition() {
        return this.getLabelPosition('y', this.owner.config.axis_rotated ? 'inner-right' : 'inner-top');
    };
    Axis.prototype.getY2AxisLabelPosition = function C3_API_AXIS_getY2AxisLabelPosition() {
        return this.getLabelPosition('y2', this.owner.config.axis_rotated ? 'inner-right' : 'inner-top');
    };
    Axis.prototype.getLabelPositionById = function C3_API_AXIS_getLabelPositionById(id) {
        return id === 'y2' ? this.getY2AxisLabelPosition() : id === 'y' ? this.getYAxisLabelPosition() : this.getXAxisLabelPosition();
    };
    Axis.prototype.textForXAxisLabel = function C3_API_AXIS_textForXAxisLabel() {
        return this.getLabelText('x');
    };
    Axis.prototype.textForYAxisLabel = function C3_API_AXIS_textForYAxisLabel() {
        return this.getLabelText('y');
    };
    Axis.prototype.textForY2AxisLabel = function C3_API_AXIS_textForY2AxisLabel() {
        return this.getLabelText('y2');
    };
    Axis.prototype.xForAxisLabel = function C3_API_AXIS_xForAxisLabel(forHorizontal, position) {
        var $$ = this.owner;
        if (forHorizontal) {
            return position.isLeft ? 0 : position.isCenter ? $$.width / 2 : $$.width;
        } else {
            return position.isBottom ? -$$.height : position.isMiddle ? -$$.height / 2 : 0;
        }
    };
    Axis.prototype.dxForAxisLabel = function C3_API_AXIS_dxForAxisLabel(forHorizontal, position) {
        if (forHorizontal) {
            return position.isLeft ? "0.5em" : position.isRight ? "-0.5em" : "0";
        } else {
            return position.isTop ? "-0.5em" : position.isBottom ? "0.5em" : "0";
        }
    };
    Axis.prototype.textAnchorForAxisLabel = function C3_API_AXIS_textAnchorForAxisLabel(forHorizontal, position) {
        if (forHorizontal) {
            return position.isLeft ? 'start' : position.isCenter ? 'middle' : 'end';
        } else {
            if (position.isInner && position.isTop) {
                return 'start';
            }
            return position.isBottom ? 'start' : position.isMiddle ? 'middle' : 'end';
        }
    };
    Axis.prototype.xForXAxisLabel = function C3_API_AXIS_xForXAxisLabel() {
        return this.xForAxisLabel(!this.owner.config.axis_rotated, this.getXAxisLabelPosition());
    };
    Axis.prototype.xForYAxisLabel = function C3_API_AXIS_xForYAxisLabel() {
        return this.xForAxisLabel(this.owner.config.axis_rotated, this.getYAxisLabelPosition());
    };
    Axis.prototype.xForY2AxisLabel = function C3_API_AXIS_xForY2AxisLabel() {
        return this.xForAxisLabel(this.owner.config.axis_rotated, this.getY2AxisLabelPosition());
    };
    Axis.prototype.dxForXAxisLabel = function C3_API_AXIS_dxForXAxisLabel() {
        return this.dxForAxisLabel(!this.owner.config.axis_rotated, this.getXAxisLabelPosition());
    };
    Axis.prototype.dxForYAxisLabel = function C3_API_AXIS_dxForYAxisLabel() {
        var position = this.getYAxisLabelPosition();
        if (this.getLabelRotateOption("y")) {
            return position.isInner ? "0.2em" : "-1em";
        } else {
            return this.dxForAxisLabel(this.owner.config.axis_rotated, this.getYAxisLabelPosition());
        }
    };
    Axis.prototype.dxForY2AxisLabel = function C3_API_AXIS_dxForY2AxisLabel() {
        var $$ = this.owner; 
        var position = this.getY2AxisLabelPosition();
        var box = $$.getTextRect($$.axes.y2.node(), CLASS.axisY2Label);
        var labelWidth = box.width;
        if (this.getLabelRotateOption("y2")) {
            return position.isInner ? "-1em" : (labelWidth * 0.6 + 15) + "px";
        } else {
            return this.dxForAxisLabel(this.owner.config.axis_rotated, this.getY2AxisLabelPosition());
        }
    };
    Axis.prototype.dyForXAxisLabel = function C3_API_AXIS_dyForXAxisLabel() {
        var $$ = this.owner, 
            config = $$.config,
            position = this.getXAxisLabelPosition();
        if (config.axis_rotated) {
            return position.isInner ? "1.2em" : -25 - this.getMaxTickWidth('x');
        } else {
            return position.isInner ? "-0.5em" : config.axis_x_height ? (config.axis_x_height - 10) + "px" : "3em";
        }
    };
    Axis.prototype.dyForYAxisLabel = function C3_API_AXIS_dyForYAxisLabel() {
        var $$ = this.owner,
            position = this.getYAxisLabelPosition();
        if ($$.config.axis_rotated) {
            return position.isInner ? "-0.5em" : "3em";
        } else if (this.getLabelRotateOption("y")) {
            return "0.45em";
        } else {
            return position.isInner ? "1.2em" : (-10 - ($$.config.axis_y_inner ? 0 : (this.getMaxTickWidth('y') + 10))) + "px";
        }
    };
    Axis.prototype.dyForY2AxisLabel = function C3_API_AXIS_dyForY2AxisLabel() {
        var $$ = this.owner,
            position = this.getY2AxisLabelPosition();
        if ($$.config.axis_rotated) {
            return position.isInner ? "1.2em" : "-2.2em";
        } else if (this.getLabelRotateOption("y2")) {
            return "1.2em";
        } else {
            return position.isInner ? "-0.5em" : (15 + ($$.config.axis_y2_inner ? 0 : (this.getMaxTickWidth('y2') + 15))) + "px";
        }
    };
    Axis.prototype.textAnchorForXAxisLabel = function C3_API_AXIS_textAnchorForXAxisLabel() {
        var $$ = this.owner;
        return this.textAnchorForAxisLabel(!$$.config.axis_rotated, this.getXAxisLabelPosition());
    };
    Axis.prototype.textAnchorForYAxisLabel = function C3_API_AXIS_textAnchorForYAxisLabel() {
        var $$ = this.owner;
        return this.textAnchorForAxisLabel($$.config.axis_rotated, this.getYAxisLabelPosition());
    };
    Axis.prototype.textAnchorForY2AxisLabel = function C3_API_AXIS_textAnchorForY2AxisLabel() {
        var $$ = this.owner;
        return this.textAnchorForAxisLabel($$.config.axis_rotated, this.getY2AxisLabelPosition());
    };
    Axis.prototype.getMaxTickWidth = function C3_API_AXIS_getMaxTickWidth(id, withoutRecompute) {
        var $$ = this.owner, 
            config = $$.config,
            maxWidth = 0, 
            targetsToShow, scale, axis, dummy, svg;
        if (withoutRecompute && $$.currentMaxTickWidths[id]) {
            return $$.currentMaxTickWidths[id];
        }
        if ($$.svg) {
            targetsToShow = $$.filterTargetsToShow($$.data.targets);
            if (id === 'y') {
                scale = $$.y.copy().domain($$.getYDomain(targetsToShow, 'y'));
                axis = this.getYAxis(scale, $$.yOrient, config.axis_y_tick_format, $$.yAxisTickValues, false, true, true, false);
            } else if (id === 'y2') {
                scale = $$.y2.copy().domain($$.getYDomain(targetsToShow, 'y2'));
                axis = this.getYAxis(scale, $$.y2Orient, config.axis_y2_tick_format, $$.y2AxisTickValues, false, true, true, true);
            } else {
                scale = $$.x.copy().domain($$.getXDomain(targetsToShow));
                axis = this.getXAxis(scale, $$.xOrient, $$.xAxisTickFormat, $$.xAxisTickValues, false, true, true);
                this.updateXAxisTickValues(targetsToShow, axis);
            }
            dummy = $$.d3.select('body').append('div').classed('c3', true);
            svg = dummy.append("svg").style('visibility', 'hidden').style('position', 'fixed').style('top', 0).style('left', 0),
            svg.append('g').call(axis).each(function C3_AXIS_findMaxTickWidthForWholeAxis() {
                $$.d3.select(this).selectAll('text').each(function C3_AXIS_findMaxTickWidthForEachLabel() {
                    var box = this.getBoundingClientRect();
                    if (maxWidth < box.width) { 
                        maxWidth = box.width; 
                    }
                });
                dummy.remove();
            });
        }
        $$.currentMaxTickWidths[id] = maxWidth <= 0 ? $$.currentMaxTickWidths[id] : maxWidth;
        return $$.currentMaxTickWidths[id];
    };

    Axis.prototype.updateLabels = function C3_API_AXIS_updateLabels(withTransition) {
        var $$ = this.owner;
        var axisXLabel = $$.main.select('.' + CLASS.axisX + ' .' + CLASS.axisXLabel),
            axisYLabel = $$.main.select('.' + CLASS.axisY + ' .' + CLASS.axisYLabel),
            axisY2Label = $$.main.select('.' + CLASS.axisY2 + ' .' + CLASS.axisY2Label);
        (withTransition ? axisXLabel.transition() : axisXLabel)
            .attr("x", this.xForXAxisLabel.bind(this))
            .attr("dx", this.dxForXAxisLabel.bind(this))
            .attr("dy", this.dyForXAxisLabel.bind(this))
            .text(this.textForXAxisLabel.bind(this));
        (withTransition ? axisYLabel.transition() : axisYLabel)
            .attr("x", this.xForYAxisLabel.bind(this))
            .attr("dx", this.dxForYAxisLabel.bind(this))
            .attr("dy", this.dyForYAxisLabel.bind(this))
            .text(this.textForYAxisLabel.bind(this));
        (withTransition ? axisY2Label.transition() : axisY2Label)
            .attr("x", this.xForY2AxisLabel.bind(this))
            .attr("dx", this.dxForY2AxisLabel.bind(this))
            .attr("dy", this.dyForY2AxisLabel.bind(this))
            .text(this.textForY2AxisLabel.bind(this));
    };
    Axis.prototype.getPadding = function C3_API_AXIS_getPadding(padding, key, defaultValue, domainLength) {
        var p = typeof padding === 'number' ? padding : padding[key];
        if (!isValue(p)) {
            return defaultValue;
        }
        if (padding.unit === 'ratio') {
            return padding[key] * domainLength;
        }
        // assume padding is pixels if unit is not specified
        return this.convertPixelsToAxisPadding(p, domainLength);
    };
    Axis.prototype.convertPixelsToAxisPadding = function C3_API_AXIS_convertPixelsToAxisPadding(pixels, domainLength) {
        var $$ = this.owner,
            length = $$.config.axis_rotated ? $$.width : $$.height;
        return domainLength * (pixels / length);
    };
    Axis.prototype.generateTickValues = function C3_API_AXIS_generateTickValues(values, tickCount, forTimeSeries) {
        var tickValues = values, 
            targetCount, start, end, count, interval, i, tickValue;
        if (tickCount) {
            targetCount = isFunction(tickCount) ? tickCount() : tickCount;
            // compute ticks according to tickCount
            if (targetCount === 1) {
                tickValues = [values[0]];
            } else if (targetCount === 2) {
                tickValues = [values[0], values[values.length - 1]];
            } else if (targetCount > 2) {
                count = targetCount - 2;
                start = values[0];
                end = values[values.length - 1];
                interval = (end - start) / (count + 1);
                // re-construct unique values
                tickValues = [start];
                for (i = 0; i < count; i++) {
                    tickValue = +start + interval * (i + 1);
                    tickValues.push(forTimeSeries ? new Date(tickValue) : tickValue);
                }
                tickValues.push(end);
            }
        }
        if (!forTimeSeries) { 
            tickValues = tickValues.sort(function (a, b) { 
                return a - b; 
            }); 
        }
        return tickValues;
    };
    Axis.prototype.generateTransitions = function C3_API_AXIS_generateTransitions(duration) {
        var $$ = this.owner, 
            axes = $$.axes;
        return {
            axisX: duration ? axes.x.transition().duration(duration) : axes.x,
            axisY: duration ? axes.y.transition().duration(duration) : axes.y,
            axisY2: duration ? axes.y2.transition().duration(duration) : axes.y2,
            axisSubX: duration ? axes.subx.transition().duration(duration) : axes.subx
        };
    };
    Axis.prototype.redraw = function C3_API_AXIS_redraw(transitions, isHidden) {
        var $$ = this.owner;
        $$.axes.x.style("opacity", isHidden ? 0 : 1);
        $$.axes.y.style("opacity", isHidden ? 0 : 1);
        $$.axes.y2.style("opacity", isHidden ? 0 : 1);
        $$.axes.subx.style("opacity", isHidden ? 0 : 1);
        transitions.axisX.call($$.xAxis);
        transitions.axisY.call($$.yAxis);
        transitions.axisY2.call($$.y2Axis);
        transitions.axisSubX.call($$.subXAxis);
    };

    c3_chart_internal_fn.getClipPath = function (id) {
        var isIE9 = window.navigator.appVersion.toLowerCase().indexOf("msie 9.") >= 0;
        return "url(" + (isIE9 ? "" : document.URL.split('#')[0]) + "#" + id + ")";
    };
    c3_chart_internal_fn.appendClip = function (parent, id) {
        return parent.append("clipPath").attr("id", id).append("rect");
    };
    c3_chart_internal_fn.getAxisClipX = function (forHorizontal) {
        // axis line width + padding for left
        var left = Math.max(30, this.margin.left);
        return forHorizontal ? -(1 + left) : -(left - 1);
    };
    c3_chart_internal_fn.getAxisClipY = function (forHorizontal) {
        return forHorizontal ? -20 : -this.margin.top;
    };
    c3_chart_internal_fn.getXAxisClipX = function () {
        var $$ = this;
        return $$.getAxisClipX(!$$.config.axis_rotated);
    };
    c3_chart_internal_fn.getXAxisClipY = function () {
        var $$ = this;
        return $$.getAxisClipY(!$$.config.axis_rotated);
    };
    c3_chart_internal_fn.getYAxisClipX = function () {
        var $$ = this;
        return $$.config.axis_y_inner ? -1 : $$.getAxisClipX($$.config.axis_rotated);
    };
    c3_chart_internal_fn.getYAxisClipY = function () {
        var $$ = this;
        return $$.getAxisClipY($$.config.axis_rotated);
    };
    c3_chart_internal_fn.getAxisClipWidth = function (forHorizontal) {
        var $$ = this,
            left = Math.max(30, $$.margin.left),
            right = Math.max(30, $$.margin.right);
        // width + axis line width + padding for left/right
        return forHorizontal ? $$.width + 2 + left + right : $$.margin.left + 20;
    };
    c3_chart_internal_fn.getAxisClipHeight = function (forHorizontal) {
        // less than 20 is not enough to show the axis label 'outer' without legend
        return (forHorizontal ? this.margin.bottom : (this.margin.top + this.height)) + 20;
    };
    c3_chart_internal_fn.getXAxisClipWidth = function () {
        var $$ = this;
        return $$.getAxisClipWidth(!$$.config.axis_rotated);
    };
    c3_chart_internal_fn.getXAxisClipHeight = function () {
        var $$ = this;
        return $$.getAxisClipHeight(!$$.config.axis_rotated);
    };
    c3_chart_internal_fn.getYAxisClipWidth = function () {
        var $$ = this;
        return $$.getAxisClipWidth($$.config.axis_rotated) + ($$.config.axis_y_inner ? 20 : 0);
    };
    c3_chart_internal_fn.getYAxisClipHeight = function () {
        var $$ = this;
        return $$.getAxisClipHeight($$.config.axis_rotated);
    };

    c3_chart_internal_fn.initPie = function C3_INTERNAL_initPie() {
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config;
        $$.pie = d3.layout.pie().value(function (d) {
            return d.values.reduce(function (a, b) { 
                return a + b.value; 
            }, 0);
        });
        if (!config.data_order) {
            $$.pie.sort(null);
        }
    };

    c3_chart_internal_fn.updateRadius = function C3_INTERNAL_updateRadius() {
        var $$ = this, 
            config = $$.config,
            w = config.gauge_width || config.donut_width,
            gaugeArcWidth = $$.visibleTargetCount * $$.config.gauge_arcs_minWidth;
        $$.radiusExpanded = Math.min($$.arcWidth, $$.arcHeight) / 2 * ($$.hasType('gauge') ? 0.85 : 1);
        $$.radius = $$.radiusExpanded * 0.95;
        $$.innerRadiusRatio = w ? ($$.radius - w) / $$.radius : 0.6;
        $$.innerRadius = $$.hasType('donut') || $$.hasType('gauge') ? $$.radius * $$.innerRadiusRatio : 0;
        $$.gaugeArcWidth = w ? w : (gaugeArcWidth <= $$.radius - $$.innerRadius ? $$.radius - $$.innerRadius : (gaugeArcWidth <= $$.radius ? gaugeArcWidth : $$.radius));
    };

    c3_chart_internal_fn.updateArc = function C3_INTERNAL_updateArc() {
        var $$ = this;
        $$.svgArc = $$.getSvgArc();
        $$.svgArcExpanded = $$.getSvgArcExpanded();
        $$.svgArcExpandedSub = $$.getSvgArcExpanded(0.98);
    };

    c3_chart_internal_fn.updateAngle = function C3_INTERNAL_updateAngle(d) {
        var $$ = this, 
            config = $$.config,
            found = false, 
            index = 0,
            gMin, gMax, gTic, gValue;

        if (!config) {
            return null;
        }

        $$.pie($$.filterTargetsToShow($$.data.targets)).forEach(function (t) {
            if (!found && t.data.id === d.data.id) {
                found = true;
                d = t;
                d.index = index;
            }
            index++;
        });
        if (isNaN(d.startAngle)) {
            d.startAngle = 0;
        }
        if (isNaN(d.endAngle)) {
            d.endAngle = d.startAngle;
        }
        if ($$.isGaugeType(d.data)) {
            gMin = config.gauge_min;
            gMax = config.gauge_max;
            gTic = (Math.PI * (config.gauge_fullCircle ? 2 : 1)) / (gMax - gMin);
            gValue = d.value < gMin ? 0 : d.value < gMax ? d.value - gMin : (gMax - gMin);
            d.startAngle = config.gauge_startingAngle;
            d.endAngle = d.startAngle + gTic * gValue;
        }
        return found ? d : null;
    };

    c3_chart_internal_fn.getSvgArc = function C3_INTERNAL_getSvgArc() {
        var $$ = this, 
            hasGaugeType = $$.hasType('gauge'),
            singleArcWidth = $$.gaugeArcWidth / $$.visibleTargetCount,
            arc = $$.d3.svg.arc().outerRadius(function (d) {
                return hasGaugeType ? $$.radius - singleArcWidth * d.index : $$.radius;
            }).innerRadius(function (d) {
                return hasGaugeType ? $$.radius - singleArcWidth * (d.index + 1) : $$.innerRadius;
            }),
            newArc = function (d, withoutUpdate) {
                var updated;
                if (withoutUpdate) { // for interpolate 
                    return arc(d); 
                } 
                updated = $$.updateAngle(d);
                return updated ? arc(updated) : "M 0 0";
            };
        // TODO: extends all function
        newArc.centroid = arc.centroid;
        return newArc;
    };

    c3_chart_internal_fn.getSvgArcExpanded = function C3_INTERNAL_getSvgArcExpanded(rate) {
        rate = rate || 1;
        var $$ = this, 
            hasGaugeType = $$.hasType('gauge'),
            singleArcWidth = $$.gaugeArcWidth / $$.visibleTargetCount,
            expandWidth = Math.min($$.radiusExpanded * rate - $$.radius, singleArcWidth * 0.8 - (1 - rate) * 100),
            arc = $$.d3.svg.arc().outerRadius(function (d) {
                return hasGaugeType ? $$.radius - singleArcWidth * d.index + expandWidth : $$.radiusExpanded * rate;
            }).innerRadius(function (d) {
                return hasGaugeType ? $$.radius - singleArcWidth * (d.index + 1) : $$.innerRadius;
            });
        return function (d) {
            var updated = $$.updateAngle(d);
            return updated ? arc(updated) : "M 0 0";
        };
    };

    c3_chart_internal_fn.getArc = function C3_INTERNAL_getArc(d, withoutUpdate, force) {
        return force || this.isArcType(d.data) ? this.svgArc(d, withoutUpdate) : "M 0 0";
    };


    c3_chart_internal_fn.transformForArcLabel = function C3_INTERNAL_transformForArcLabel(d) {
        var $$ = this, 
            config = $$.config,
            updated = $$.updateAngle(d), 
            c, x, y, h, ratio, 
            translate = "",
            hasGauge = $$.hasType('gauge');
        if (updated && !hasGauge) {
            c = this.svgArc.centroid(updated);
            x = isNaN(c[0]) ? 0 : c[0];
            y = isNaN(c[1]) ? 0 : c[1];
            h = Math.sqrt(x * x + y * y);
            if ($$.hasType('donut') && config.donut_label_ratio) {
                ratio = isFunction(config.donut_label_ratio) ? config.donut_label_ratio(d, $$.radius, h) : config.donut_label_ratio;
            } else if ($$.hasType('pie') && config.pie_label_ratio) {
                ratio = isFunction(config.pie_label_ratio) ? config.pie_label_ratio(d, $$.radius, h) : config.pie_label_ratio;
            } else {
                ratio = $$.radius && h ? (36 / $$.radius > 0.375 ? 1.175 - 36 / $$.radius : 0.8) * $$.radius / h : 0;
            }
            translate = "translate(" + (x * ratio) +  ',' + (y * ratio) +  ")";
        }
        else if (updated && hasGauge && $$.visibleTargetCount > 1) {
            var y1 = Math.sin(updated.endAngle - Math.PI / 2);
            x = Math.cos(updated.endAngle - Math.PI / 2) * ($$.radiusExpanded + 25);
            y = y1 * ($$.radiusExpanded + 15 - Math.abs(y1 * 10)) + 3;
            translate = "translate(" + x +  ',' + y +  ")";
        }
        return translate;
    };

    c3_chart_internal_fn.getArcRatio = function C3_INTERNAL_getArcRatio(d) {
        var $$ = this,
            config = $$.config,
            whole = Math.PI * ($$.hasType('gauge') && !config.gauge_fullCircle ? 1 : 2);
        return d ? (d.endAngle - d.startAngle) / whole : null;
    };

    c3_chart_internal_fn.convertToArcData = function C3_INTERNAL_convertToArcData(d) {
        return this.addName({
            id: d.data.id,
            value: d.value,
            ratio: this.getArcRatio(d),
            index: d.index
        });
    };

    c3_chart_internal_fn.textForArcLabel = function C3_INTERNAL_textForArcLabel(d) {
        var $$ = this,
            updated, value, ratio, id, format;
        if (!$$.shouldShowArcLabel()) { 
            return ""; 
        }
        updated = $$.updateAngle(d);
        value = updated ? updated.value : null;
        ratio = $$.getArcRatio(updated);
        id = d.data.id;
        if (!$$.hasType('gauge') && !$$.meetsArcLabelThreshold(ratio)) { 
            return ""; 
        }
        format = $$.getArcLabelFormat();
        return format(value, ratio, id);
    };

    c3_chart_internal_fn.expandArc = function C3_INTERNAL_expandArc(targetIds) {
        var $$ = this, 
            interval;

        // MEMO: avoid to cancel transition
        if ($$.transiting) {
            interval = window.setInterval(function () {
                if (!$$.transiting) {
                    window.clearInterval(interval);
                    if ($$.legend && $$.legend.selectAll('.c3-legend-item-focused').size() > 0) {
                        $$.expandArc(targetIds);
                    }
                }
            }, 10);
            return;
        }

        targetIds = $$.mapToTargetIds(targetIds);

        $$.svg.selectAll($$.selectorTargets(targetIds, '.' + CLASS.chartArc)).each(function (d) {
            if (!$$.shouldExpand(d.data.id)) { 
                return; 
            }
            $$.d3.select(this).selectAll('path')
                .transition().duration($$.expandDuration(d.data.id))
                .attr("d", $$.svgArcExpanded)
                .transition().duration($$.expandDuration(d.data.id) * 2)
                .attr("d", $$.svgArcExpandedSub)
                .each(function (d) {
                    if ($$.isDonutType(d.data)) {
                        // callback here
                    }
                });
        });
    };

    c3_chart_internal_fn.unexpandArc = function C3_INTERNAL_unexpandArc(targetIds) {
        var $$ = this;

        if ($$.transiting) { 
            return; 
        }

        targetIds = $$.mapToTargetIds(targetIds);

        $$.svg.selectAll($$.selectorTargets(targetIds, '.' + CLASS.chartArc)).selectAll('path')
            .transition().duration(function (d) {
                return $$.expandDuration(d.data.id);
            })
            .attr("d", $$.svgArc);
        $$.svg.selectAll('.' + CLASS.arc)
            .style("opacity", 1);
    };

    c3_chart_internal_fn.expandDuration = function (id) {
        var $$ = this, 
            config = $$.config;

        if ($$.isDonutType(id)) {
            return config.donut_expand_duration;
        } else if ($$.isGaugeType(id)) {
            return config.gauge_expand_duration;
        } else if ($$.isPieType(id)) {
            return config.pie_expand_duration;
        } else {
            return 50;
        }
    };

    c3_chart_internal_fn.shouldExpand = function C3_INTERNAL_shouldExpand(id) {
        var $$ = this, 
            config = $$.config;
        return ($$.isDonutType(id) && config.donut_expand) ||
               ($$.isGaugeType(id) && config.gauge_expand) ||
               ($$.isPieType(id) && config.pie_expand);
    };

    c3_chart_internal_fn.shouldShowArcLabel = function C3_INTERNAL_shouldShowArcLabel() {
        var $$ = this, 
            config = $$.config, 
            shouldShow = true;
        if ($$.hasType('donut')) {
            shouldShow = config.donut_label_show;
        } else if ($$.hasType('pie')) {
            shouldShow = config.pie_label_show;
        }
        // when gauge, always true
        return shouldShow;
    };

    c3_chart_internal_fn.meetsArcLabelThreshold = function C3_INTERNAL_meetsArcLabelThreshold(ratio) {
        var $$ = this, 
            config = $$.config,
            threshold = $$.hasType('donut') ? config.donut_label_threshold : config.pie_label_threshold;
        return ratio >= threshold;
    };

    c3_chart_internal_fn.getArcLabelFormat = function C3_INTERNAL_getArcLabelFormat() {
        var $$ = this, 
            config = $$.config,
            customFormat = config.pie_label_format;
        if ($$.hasType('gauge')) {
            customFormat = config.gauge_label_format;
        } else if ($$.hasType('donut')) {
            customFormat = config.donut_label_format;
        }
        return customFormat || $$.defaultArcValueFormat;
    };

    c3_chart_internal_fn.getArcTitle = function C3_INTERNAL_getArcTitle() {
        var $$ = this;
        return $$.hasType('donut') ? $$.config.donut_title : "";
    };

    c3_chart_internal_fn.updateTargetsForArc = function C3_INTERNAL_updateTargetsForArc(targets) {
        var $$ = this, 
            main = $$.main,
            mainPieUpdate, mainPieEnter,
            classChartArc = $$.classChartArc.bind($$),
            classArcs = $$.classArcs.bind($$),
            classFocus = $$.classFocus.bind($$);
        mainPieUpdate = main.select('.' + CLASS.chartArcs).selectAll('.' + CLASS.chartArc)
            .data($$.pie(targets))
            .attr("class", function (d) { 
                return classChartArc(d) + classFocus(d.data); 
            });
        mainPieEnter = mainPieUpdate.enter().append("g")
            .attr("class", classChartArc);
        mainPieEnter.append('g')
            .attr('class', classArcs);
        mainPieEnter.append("text")
            .attr("dy", $$.hasType('gauge') ? "-.1em" : ".35em")
            .style("opacity", 0)
            .style("text-anchor", "middle")
            .style("pointer-events", "none");
        // MEMO: can not keep same color..., but not bad to update color in redraw
        //mainPieUpdate.exit().remove();
    };

    c3_chart_internal_fn.initArc = function C3_INTERNAL_initArc() {
        var $$ = this;
        $$.arcs = $$.main.select('.' + CLASS.chart).append("g")
            .attr("class", CLASS.chartArcs)
            .attr("transform", $$.getTranslate('arc'));
        if ($$.config.donut_subtitle) {
            $$.arcs.append('text')
                .attr('class', CLASS.chartArcsSubTitle)
                .attr("transform", "translate(0,-10)")
                .style("text-anchor", "middle")
                .text($$.config.donut_subtitle);
        }
        if ($$.config.donut_title) {
            var title = $$.arcs.append('text')
                .attr('class', CLASS.chartArcsTitle)
                .style("text-anchor", "middle")
                .text($$.getArcTitle());
            if ($$.config.donut_subtitle) {
                title.attr("transform", "translate(0,20)");
            } else {
                title.attr("transform", "translate(0,5)");
            }
        }
    };

    c3_chart_internal_fn.redrawArc = function C3_INTERNAL_redrawArc(duration, durationForExit, withTransform) {
        console.count('redrawArc');
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config, 
            main = $$.main,
            mainArc, 
            gaugeLabelFormat, 
            minGaugeValue, maxGaugeValue,
            mainArcLabelLine, 
            hasGaugeType = $$.hasType('gauge');
        mainArc = main.selectAll('.' + CLASS.arcs).selectAll('.' + CLASS.arc)
            .data($$.arcData.bind($$));
        mainArc.enter().append('path')
            .attr("class", $$.classArc.bind($$))
            .style("fill", function (d) { 
                return $$.color(d.data); 
            })
            .style("cursor", function (d) { 
                return config.interaction_enabled && config.data_selection_isselectable(d) ? "pointer" : null; 
            })
            .style("opacity", 0)
            .each(function (d) {
                if ($$.isGaugeType(d.data)) {
                    d.startAngle = d.endAngle = config.gauge_startingAngle;
                }
                this._current = d;
            });
        if (hasGaugeType) {
            mainArcLabelLine = main.selectAll('.' + CLASS.arcs).selectAll('.' + CLASS.arcLabelLine)
                .data($$.arcData.bind($$));
            mainArcLabelLine.enter().append('rect')
                .attr("class", function (d) { 
                    return CLASS.arcLabelLine + ' ' + CLASS.target + ' ' + CLASS.target + '-' + d.data.id; 
                });
            if ($$.visibleTargetCount === 1) {
                mainArcLabelLine.style("display", "none");
            }
            else {
                mainArcLabelLine
                    .style("fill", function (d) { 
                        return config.color_pattern.length > 0 ? $$.levelColor(d.data.values[0].value) : $$.color(d.data); 
                    })
                    .style("display", "")
                    .each(function (d) {
                        var lineLength = 0, 
                            lineThickness = 2, 
                            x = 0, 
                            y = 0, 
                            transform = "";
                        if ($$.hiddenTargetIds.indexOf(d.data.id) < 0) {
                            var updated = $$.updateAngle(d),
                                innerLineLength = $$.gaugeArcWidth / $$.visibleTargetCount * (updated.index + 1),
                                lineAngle = updated.endAngle - Math.PI / 2,
                                linePositioningAngle = lineAngle - Math.PI / 180 / 3,
                                arcInnerRadius = $$.radius - innerLineLength;
                            lineLength = $$.radiusExpanded - $$.radius + innerLineLength;
                            x = Math.cos(linePositioningAngle) * arcInnerRadius;
                            y = Math.sin(linePositioningAngle) * arcInnerRadius;
                            transform = "rotate(" + (lineAngle * 180 / Math.PI) + ", " + x + ", " + y + ")";
                        }
                        d3.select(this)
                            .attr({ x: x, y: y, width: lineLength, height: lineThickness, transform: transform })
                            .style("stroke-dasharray", "0, " + (lineLength + lineThickness) + ", 0");
                    });
            }
        }
        mainArc
            .attr("transform", function (d) { 
                return !$$.isGaugeType(d.data) && withTransform ? "scale(0)" : ""; 
            })
            .style("opacity", function (d) { 
                return d === this._current ? 0 : 1; 
            })
            .on('mouseover', config.interaction_enabled ? function (d) {
                var updated, arcData;
                if ($$.transiting) { // skip while transiting
                    return;
                }
                updated = $$.updateAngle(d);
                if (updated) {
                    arcData = $$.convertToArcData(updated);
                    // transitions
                    $$.expandArc(updated.data.id);
                    $$.api.focus(updated.data.id);
                    $$.toggleFocusLegend(updated.data.id, true);
                    $$.config.data_onmouseover(arcData, this);
                }
            } : null)
            .on('mousemove', config.interaction_enabled ? function (d) {
                var updated = $$.updateAngle(d), 
                    arcData, 
                    selectedData;
                if (updated) {
                    arcData = $$.convertToArcData(updated);
                    selectedData = [arcData];
                    $$.showTooltip(selectedData, this);
                }
            } : null)
            .on('mouseout', config.interaction_enabled ? function (d) {
                var updated, arcData;
                if ($$.transiting) { // skip while transiting
                    return;
                }
                updated = $$.updateAngle(d);
                if (updated) {
                    arcData = $$.convertToArcData(updated);
                    // transitions
                    $$.unexpandArc(updated.data.id);
                    $$.api.revert();
                    $$.revertLegend();
                    $$.hideTooltip();
                    $$.config.data_onmouseout(arcData, this);
                }
            } : null)
            .on('click', config.interaction_enabled ? function (d, i) {
                var updated = $$.updateAngle(d),
                    arcData;
                if (updated) {
                    arcData = $$.convertToArcData(updated);
                    if ($$.toggleShape) {
                        $$.toggleShape(this, arcData, i);
                    }
                    $$.config.data_onclick.call($$.api, arcData, this);
                }
            } : null)
            .each(function () { 
                $$.transiting = true; 
            })
            .transition().duration(duration)
            .attrTween("d", function (d) {
                var updated = $$.updateAngle(d), 
                    interpolate;
                if (!updated) {
                    return function () { 
                        return "M 0 0"; 
                    };
                }
                //                if (this._current === d) {
                //                    this._current = {
                //                        startAngle: Math.PI*2,
                //                        endAngle: Math.PI*2,
                //                    };
                //                }
                if (isNaN(this._current.startAngle)) {
                    this._current.startAngle = Math.PI * 2;
                }
                if (isNaN(this._current.endAngle)) {
                    this._current.endAngle = this._current.startAngle;
                }
                interpolate = d3.interpolate(this._current, updated);
                this._current = interpolate(0);
                return function (t) {
                    var interpolated = interpolate(t);
                    interpolated.data = d.data; // data.id will be updated by interporator
                    return $$.getArc(interpolated, true);
                };
            })
            .attr("transform", withTransform ? "scale(1)" : "")
            .style("fill", function (d) {
                return $$.levelColor ? $$.levelColor(d.data.values[0].value) : $$.color(d.data.id);
            }) // Where gauge reading color would receive customization.
            .style("opacity", 1)
            .call($$.endall, function () {
                $$.transiting = false;
            });
        mainArc.exit().transition().duration(durationForExit)
            .style('opacity', 0)
            .remove();
        main.selectAll('.' + CLASS.chartArc).select('text')
            .style('opacity', function (d) {
                var hasOpacityTransition = !$$.isGaugeType(d.data) || $$.config.gauge_label_transition;
                return hasOpacityTransition ? 0 : d3.select(this).style('opacity');
            })
            .attr('class', function (d) { 
                return $$.isGaugeType(d.data) ? CLASS.gaugeValue : ''; 
            })
            .text($$.textForArcLabel.bind($$))
            .attr("transform", $$.transformForArcLabel.bind($$))
            .style('font-size', function (d) { 
                return $$.isGaugeType(d.data) && $$.visibleTargetCount === 1 ? Math.round($$.radius / 5) + 'px' : '';
            })
          .transition().duration(duration)
            .style("opacity", function (d) { 
                return $$.isTargetToShow(d.data.id) && $$.isArcType(d.data) ? 1 : 0; 
            });
        main.select('.' + CLASS.chartArcsTitle)
            .style("opacity", $$.hasType('donut') || hasGaugeType ? 1 : 0);

        if (hasGaugeType) {
            var index = 0;

            gaugeLabelFormat = $$.getArcLabelFormat();
            minGaugeValue = $$.config.gauge_label_formatall ? gaugeLabelFormat(config.gauge_min) : config.gauge_min;
            maxGaugeValue = $$.config.gauge_label_formatall ? gaugeLabelFormat(config.gauge_max) : config.gauge_max;
            
            $$.arcs.selectAll('.' + CLASS.chartArcsBackground)
                .attr("d", function (d1) {
                    if ($$.hiddenTargetIds.indexOf(d1.id) >= 0) { 
                        return "M 0 0"; 
                    }

                    var d = {
                        data: [{value: config.gauge_max}],
                        startAngle: config.gauge_startingAngle,
                        endAngle: -1 * config.gauge_startingAngle,
                        index: index++
                    };
                    return $$.getArc(d, true, true);
                });
            $$.arcs.select('.' + CLASS.chartArcsGaugeUnit)
                .attr("dy", ".75em")
                .text(config.gauge_label_show ? config.gauge_units : '');
            $$.arcs.select('.' + CLASS.chartArcsGaugeMin)
                .attr("dx", -1 * ($$.innerRadius + (($$.radius - $$.innerRadius) / (config.gauge_fullCircle ? 1 : 2))) + "px")
                .attr("dy", "1.2em")
                .text(config.gauge_label_show ? minGaugeValue : '');
            $$.arcs.select('.' + CLASS.chartArcsGaugeMax)
                .attr("dx", $$.innerRadius + (($$.radius - $$.innerRadius) / (config.gauge_fullCircle ? 1 : 2)) + "px")
                .attr("dy", "1.2em")
                .text(config.gauge_label_show ? maxGaugeValue : '');
        }
    };
    c3_chart_internal_fn.initGauge = function C3_INTERNAL_initGauge() {
        var $$ = this, 
            arcs = $$.arcs;
        if (this.hasType('gauge')) {
            arcs.selectAll().data($$.data.targets).enter()
                .append('path')
                .attr("class", function (d) {
                    return CLASS.chartArcsBackground + ' ' + CLASS.target +'-'+ d.id;
                });
            arcs.append("text")
                .attr("class", CLASS.chartArcsGaugeUnit)
                .style("text-anchor", "middle")
                .style("pointer-events", "none");
            arcs.append("text")
                .attr("class", CLASS.chartArcsGaugeMin)
                .style("text-anchor", "middle")
                .style("pointer-events", "none");
            arcs.append("text")
                .attr("class", CLASS.chartArcsGaugeMax)
                .style("text-anchor", "middle")
                .style("pointer-events", "none");
        }
    };
    c3_chart_internal_fn.getGaugeLabelHeight = function C3_INTERNAL_getGaugeLabelHeight() {
        return this.config.gauge_label_show ? 20 : 0;
    };

    c3_chart_internal_fn.initRegion = function C3_INTERNAL_initRegion() {
        var $$ = this;
        $$.region = $$.main.append('g')
            .attr("clip-path", $$.clipPath)
            .attr("class", CLASS.regions);
    };
    c3_chart_internal_fn.updateRegion = function C3_INTERNAL_updateRegion(duration) {
        var $$ = this, 
            config = $$.config;

        // hide if arc type
        $$.region.style('visibility', $$.hasArcType() ? 'hidden' : 'visible');

        $$.mainRegion = $$.main.select('.' + CLASS.regions).selectAll('.' + CLASS.region)
            .data(config.regions);
        var g = $$.mainRegion.enter().append('g');
        g.append('rect')
            .style("fill-opacity", 0);
        // g.append('text')
        //     .text($$.labelRegion.bind($$));
        $$.mainRegion
            .attr('class', $$.classRegion.bind($$));
        $$.mainRegion.exit().transition().duration(duration)
            .style("opacity", 0)
            .remove();
    };
    c3_chart_internal_fn.redrawRegion = function C3_INTERNAL_redrawRegion(withTransition) {
        console.count('redrawRegion');
        var $$ = this,
            regions = $$.mainRegion.selectAll('rect').each(function () {
                // data is binded to g and it's not transferred to rect (child node) automatically,
                // then data of each rect has to be updated manually.
                // TODO: there should be more efficient way to solve this?
                var parentData = $$.d3.select(this.parentNode).datum();
                $$.d3.select(this).datum(parentData);
            }),
            x = $$.regionX.bind($$),
            y = $$.regionY.bind($$),
            w = $$.regionWidth.bind($$),
            h = $$.regionHeight.bind($$);
            
        var paddedY = $$.regionY($$) + 10;  // To allow for text height
        var regionLabels = $$.mainRegion.selectAll('text');
            
        return [
            (withTransition ? regions.transition() : regions)
                .attr("x", x)
                .attr("y", y)
                .attr("width", w)
                .attr("height", h)
                .style("fill-opacity", function (d) { 
                    return isValue(d.opacity) ? d.opacity : 0.1; 
                }),
            regionLabels
                .attr("x", x)
                .attr("y", paddedY)
        ];
    };
    c3_chart_internal_fn.regionX = function C3_INTERNAL_regionX(d) {
        var $$ = this, 
            config = $$.config,
            xPos, 
            yScale = d.axis === 'y' ? $$.y : $$.y2;
        if (d.axis === 'y' || d.axis === 'y2') {
            xPos = config.axis_rotated ? (d.start != null ? yScale(d.start) : 0) : 0;
        } else {
            xPos = config.axis_rotated ? 0 : (d.start != null ? $$.x($$.isTimeSeries() ? $$.parseDate(d.start).valueOf() : d.start) : 0);
        }
        return xPos;
    };
    c3_chart_internal_fn.regionY = function C3_INTERNAL_regionY(d) {
        var $$ = this, 
            config = $$.config,
            yPos, 
            yScale = d.axis === 'y' ? $$.y : $$.y2;
        if (d.axis === 'y' || d.axis === 'y2') {
            yPos = config.axis_rotated ? 0 : (d.end != null ? yScale(d.end) : 0);
        } else {
            yPos = config.axis_rotated ? (d.start != null ? $$.x($$.isTimeSeries() ? $$.parseDate(d.start).valueOf() : d.start) : 0) : 0;
        }
        return yPos;
    };
    c3_chart_internal_fn.regionWidth = function C3_INTERNAL_regionWidth(d) {
        var $$ = this, 
            config = $$.config,
            start = $$.regionX(d), 
            end, 
            yScale = d.axis === 'y' ? $$.y : $$.y2;
        if (d.axis === 'y' || d.axis === 'y2') {
            end = config.axis_rotated ? (d.end != null ? yScale(d.end) : $$.width) : $$.width;
        } else {
            end = config.axis_rotated ? $$.width : (d.end != null ? $$.x($$.isTimeSeries() ? $$.parseDate(d.end).valueOf() : d.end) : $$.width);
        }
        return end < start ? 0 : end - start;
    };
    c3_chart_internal_fn.regionHeight = function C3_INTERNAL_regionHeight(d) {
        var $$ = this, 
            config = $$.config,
            start = this.regionY(d), 
            end, 
            yScale = d.axis === 'y' ? $$.y : $$.y2;
        if (d.axis === 'y' || d.axis === 'y2') {
            end = config.axis_rotated ? $$.height : (d.start != null ? yScale(d.start) : $$.height);
        } else {
            end = config.axis_rotated ? (d.end != null ? $$.x($$.isTimeSeries() ? $$.parseDate(d.end).valueOf() : d.end) : $$.height) : $$.height;
        }
        return end < start ? 0 : end - start;
    };
    c3_chart_internal_fn.isRegionOnX = function C3_INTERNAL_isRegionOnX(d) {
        return !d.axis || d.axis === 'x';
    };

    c3_chart_internal_fn.drag = function C3_INTERNAL_drag(mouse) {
        var $$ = this, 
            config = $$.config, 
            main = $$.main, 
            d3 = $$.d3;
        var sx, sy, mx, my, minX, maxX, minY, maxY;

        if ($$.hasArcType()) { return; }
        if (!config.data_selection_enabled) { return; } // do nothing if not selectable
        if (config.zoom_enabled && !$$.zoom.altDomain) { return; } // skip if zoomable because of conflict drag dehavior
        if (!config.data_selection_multiple) { return; } // skip when single selection because drag is used for multiple selection

        sx = $$.dragStart[0];
        sy = $$.dragStart[1];
        mx = mouse[0];
        my = mouse[1];
        minX = Math.min(sx, mx);
        maxX = Math.max(sx, mx);
        minY = (config.data_selection_grouped) ? $$.margin.top : Math.min(sy, my);
        maxY = (config.data_selection_grouped) ? $$.height : Math.max(sy, my);

        main.select('.' + CLASS.dragarea)
            .attr('x', minX)
            .attr('y', minY)
            .attr('width', maxX - minX)
            .attr('height', maxY - minY);
        // TODO: binary search when multiple xs
        main.selectAll('.' + CLASS.shapes).selectAll('.' + CLASS.shape)
            .filter(function (d) { 
                return config.data_selection_isselectable(d); 
            })
            .each(function (d, i) {
                var shape = d3.select(this),
                    isSelected = shape.classed(CLASS.SELECTED),
                    isIncluded = shape.classed(CLASS.INCLUDED),
                    _x, _y, _w, _h, toggle, 
                    isWithin = false, 
                    box;
                if (shape.classed(CLASS.circle)) {
                    _x = shape.attr("cx") * 1;
                    _y = shape.attr("cy") * 1;
                    toggle = $$.togglePoint;
                    isWithin = minX < _x && _x < maxX && minY < _y && _y < maxY;
                }
                else if (shape.classed(CLASS.bar)) {
                    box = getPathBox(this);
                    _x = box.x;
                    _y = box.y;
                    _w = box.width;
                    _h = box.height;
                    toggle = $$.togglePath;
                    isWithin = !(maxX < _x || _x + _w < minX) && !(maxY < _y || _y + _h < minY);
                } else {
                    // line/area selection not supported yet
                    return;
                }
                if (isWithin ^ isSelected || isWithin ^ isIncluded) {
                    shape.classed(CLASS.INCLUDED, isWithin);
                    // TODO: included/unincluded callback here
                    shape.classed(CLASS.SELECTED, isWithin);
                    toggle.call($$, isWithin, shape, d, i);
                }
            });
    };

    c3_chart_internal_fn.dragstart = function C3_INTERNAL_dragstart(mouse) {
        var $$ = this, 
            config = $$.config;
        if ($$.hasArcType()) { return; }
        if (!config.data_selection_enabled) { return; } // do nothing if not selectable
        $$.config.data_ondragstart.call($$);
        $$.dragStart = mouse;
        $$.main.select('.' + CLASS.chart).append('rect')
            .attr('class', CLASS.dragarea)
            .style('opacity', 0.1);
        $$.dragging = true;
    };

    c3_chart_internal_fn.dragend = function C3_INTERNAL_dragend() {
        var $$ = this, 
            config = $$.config;
        if ($$.hasArcType()) { return; }
        if (!config.data_selection_enabled) { return; } // do nothing if not selectable
        $$.config.data_ondragend.call($$);
        $$.main.select('.' + CLASS.dragarea)
            .transition().duration(100)
            .style('opacity', 0)
            .remove();
        $$.main.selectAll('.' + CLASS.shape)
            .classed(CLASS.INCLUDED, false);
        $$.dragging = false;
    };

    c3_chart_internal_fn.selectPoint = function C3_INTERNAL_selectPoint(target, d, i) {
        var $$ = this, 
            config = $$.config,
            cx = (config.axis_rotated ? $$.circleY : $$.circleX).bind($$),
            cy = (config.axis_rotated ? $$.circleX : $$.circleY).bind($$),
            r = $$.pointSelectR.bind($$);
        config.data_onselected.call($$.api, d, target.node());
        // add selected-circle on low layer g
        $$.main.select('.' + CLASS.selectedCircles + $$.getTargetSelectorSuffix(d.id)).selectAll('.' + CLASS.selectedCircle + '-' + i)
            .data([d])
            .enter().append('circle')
            .attr("class", function () { 
                return $$.generateClass(CLASS.selectedCircle, i); 
            })
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("stroke", function () { 
                return $$.color(d); 
            })
            .attr("r", function (d) { 
                return $$.pointSelectR(d) * 1.4; 
            })
            .transition().duration(100)
            .attr("r", r);
    };
    c3_chart_internal_fn.unselectPoint = function C3_INTERNAL_unselectPoint(target, d, i) {
        var $$ = this;
        $$.config.data_onunselected.call($$.api, d, target.node());
        // remove selected-circle from low layer g
        $$.main.select('.' + CLASS.selectedCircles + $$.getTargetSelectorSuffix(d.id)).selectAll('.' + CLASS.selectedCircle + '-' + i)
            .transition().duration(100).attr('r', 0)
            .remove();
    };
    c3_chart_internal_fn.togglePoint = function C3_INTERNAL_togglePoint(selected, target, d, i) {
        if (selected) {
            this.selectPoint(target, d, i);
        } else {
            this.unselectPoint(target, d, i);
        }
    };
    c3_chart_internal_fn.selectPath = function C3_INTERNAL_selectPath(target, d) {
        var $$ = this;
        $$.config.data_onselected.call($$, d, target.node());
        if ($$.config.interaction_brighten) {
            target.transition().duration(100)
            .style("fill", function () { 
                return $$.d3.rgb($$.color(d)).brighter(0.75); 
            });
        }
    };
    c3_chart_internal_fn.unselectPath = function C3_INTERNAL_unselectPath(target, d) {
        var $$ = this;
        $$.config.data_onunselected.call($$, d, target.node());
        if ($$.config.interaction_brighten) {
            target.transition().duration(100)
            .style("fill", function () { 
                return $$.color(d); 
            });
        }
    };
    c3_chart_internal_fn.togglePath = function C3_INTERNAL_togglePath(selected, target, d, i) {
        selected ? this.selectPath(target, d, i) : this.unselectPath(target, d, i);
    };
    c3_chart_internal_fn.getToggle = function C3_INTERNAL_getToggle(that, d) {
        var $$ = this, toggle;
        if (that.nodeName === 'circle') {
            if ($$.isStepType(d)) {
                // circle is hidden in step chart, so treat as within the click area
                toggle = function () {}; // TODO: how to select step chart?
            } else {
                toggle = $$.togglePoint;
            }
        }
        else if (that.nodeName === 'path') {
            toggle = $$.togglePath;
        }
        return toggle;
    };
    c3_chart_internal_fn.toggleShape = function C3_INTERNAL_toggleShape(that, d, i) {
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config,
            shape = d3.select(that), 
            isSelected = shape.classed(CLASS.SELECTED),
            toggle = $$.getToggle(that, d).bind($$);

        if (config.data_selection_enabled && config.data_selection_isselectable(d)) {
            if (!config.data_selection_multiple) {
                $$.main.selectAll('.' + CLASS.shapes + (config.data_selection_grouped ? $$.getTargetSelectorSuffix(d.id) : "")).selectAll('.' + CLASS.shape).each(function (d, i) {
                    var shape = d3.select(this);
                    if (shape.classed(CLASS.SELECTED)) { 
                        toggle(false, shape.classed(CLASS.SELECTED, false), d, i); 
                    }
                });
            }
            shape.classed(CLASS.SELECTED, !isSelected);
            toggle(!isSelected, shape, d, i);
        }
    };

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

    c3_chart_internal_fn.initZoom = function C3_INTERNAL_initZoom() {
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config, 
            startEvent;

        $$.zoom = d3.behavior.zoom()
            .on("zoomstart", function () {
                startEvent = d3.event.sourceEvent;
                $$.zoom.altDomain = d3.event.sourceEvent.altKey ? $$.x.orgDomain() : null;
                config.zoom_onzoomstart.call($$.api, d3.event.sourceEvent);
            })
            .on("zoom", function () {
                $$.redrawForZoom.call($$);
            })
            .on('zoomend', function () {
                var event = d3.event.sourceEvent;
                // if click, do nothing. otherwise, click interaction will be canceled.
                if (event && startEvent.clientX === event.clientX && startEvent.clientY === event.clientY) {
                    return;
                }
                $$.redrawEventRect();
                $$.updateZoom();
                config.zoom_onzoomend.call($$.api, $$.x.orgDomain());
            });
        $$.zoom.scale = function (scale) {
            return config.axis_rotated ? this.y(scale) : this.x(scale);
        };
        $$.zoom.orgScaleExtent = function () {
            var extent = config.zoom_extent ? config.zoom_extent : [1, 10];
            return [extent[0], Math.max($$.getMaxDataCount() / extent[1], extent[1])];
        };
        $$.zoom.updateScaleExtent = function () {
            var ratio = diffDomain($$.x.orgDomain()) / diffDomain($$.getZoomDomain()),
                extent = this.orgScaleExtent();
            this.scaleExtent([extent[0] * ratio, extent[1] * ratio]);
            return this;
        };
    };
    c3_chart_internal_fn.getZoomDomain = function () {
        var $$ = this, config = $$.config, d3 = $$.d3,
            min = d3.min([$$.orgXDomain[0], config.zoom_x_min]),
            max = d3.max([$$.orgXDomain[1], config.zoom_x_max]);
        return [min, max];
    };
    c3_chart_internal_fn.updateZoom = function C3_INTERNAL_updateZoom() {
        var $$ = this, 
            z = $$.config.zoom_enabled ? $$.zoom : function () {};
        $$.main.select('.' + CLASS.zoomRect).call(z).on("dblclick.zoom", null);
        $$.main.selectAll('.' + CLASS.eventRect).call(z).on("dblclick.zoom", null);
    };
    c3_chart_internal_fn.redrawForZoom = function C3_INTERNAL_redrawForZoom() {
        console.count('redrawForZoom');
        var $$ = this, 
            d3 = $$.d3, 
            config = $$.config, 
            zoom = $$.zoom, 
            x = $$.x;
        if (!config.zoom_enabled) {
            return;
        }
        if (!d3.event.sourceEvent) {
            return;
        }
        if ($$.filterTargetsToShow($$.data.targets).length === 0) {
            return;
        }
        if (d3.event.sourceEvent.type === 'mousemove' && zoom.altDomain) {
            x.domain(zoom.altDomain);
            zoom.scale(x).updateScaleExtent();
            return;
        }
        if ($$.isCategorized() && x.orgDomain()[0] === $$.orgXDomain[0]) {
            x.domain([$$.orgXDomain[0] - 1e-10, x.orgDomain()[1]]);
        }
        $$.redraw({
            withTransition: false,
            withY: config.zoom_rescale,
            withSubchart: false,
            withEventRect: false,
            withDimension: false
        });
        if (d3.event.sourceEvent.type === 'mousemove') {
            $$.cancelClick = true;
        }
        config.zoom_onzoom.call($$.api, x.orgDomain());
    };

    c3_chart_internal_fn.generateColor = function C3_INTERNAL_generateColor() {
        var $$ = this, config = $$.config, d3 = $$.d3,
            colors = config.data_colors,
            pattern = notEmpty(config.color_pattern) ? config.color_pattern : d3.scale.category10().range(),
            callback = config.data_color,
            ids = [];

        return function (d) {
            var id = d.id || (d.data && d.data.id) || d, color;

            // if callback function is provided
            if (colors[id] instanceof Function) {
                color = colors[id](d);
            }
            // if specified, choose that color
            else if (colors[id]) {
                color = colors[id];
            }
            // if not specified, choose from pattern
            else {
                if (ids.indexOf(id) < 0) { ids.push(id); }
                color = pattern[ids.indexOf(id) % pattern.length];
                colors[id] = color;
            }
            return callback instanceof Function ? callback(color, d) : color;
        };
    };
    c3_chart_internal_fn.generateLevelColor = function C3_INTERNAL_generateLevelColor() {
        var $$ = this, config = $$.config,
            colors = config.color_pattern,
            threshold = config.color_threshold,
            asValue = threshold.unit === 'value',
            values = threshold.values && threshold.values.length ? threshold.values : [],
            max = threshold.max || 100;
        return notEmpty(config.color_threshold) ? function (value) {
            var i, v, color = colors[colors.length - 1];
            for (i = 0; i < values.length; i++) {
                v = asValue ? value : (value * 100 / max);
                if (v < values[i]) {
                    color = colors[i];
                    break;
                }
            }
            return color;
        } : null;
    };
    c3_chart_internal_fn.generateOpacity = function () {
        var $$ = this, config = $$.config,
            opacity = config.data_opacity,
            callback = config.data_calculateOpacity;

        return function (d) {
            var id = d.id || (d.data && d.data.id) || d;

            // if callback function is provided
            if (callback[id] instanceof Function) {
                return callback[id](d);
            }
            // if opacity is specified
            else if (opacity !== undefined) {
                return opacity;
            }
            // default
            else {
                return 1;
            }
        };
    };

    c3_chart_internal_fn.getYFormat = function C3_INTERNAL_getYFormat(forArc) {
        var $$ = this,
            formatForY = forArc && !$$.hasType('gauge') ? $$.defaultArcValueFormat : $$.yFormat,
            formatForY2 = forArc && !$$.hasType('gauge') ? $$.defaultArcValueFormat : $$.y2Format;
        return function (v, ratio, id) {
            var format = $$.axis.getId(id) === 'y2' ? formatForY2 : formatForY;
            return format.call($$, v, ratio);
        };
    };
    c3_chart_internal_fn.yFormat = function C3_INTERNAL_yFormat(v) {
        var $$ = this, config = $$.config,
            format = config.axis_y_tick_format ? config.axis_y_tick_format : $$.defaultValueFormat;
        return format(v);
    };
    c3_chart_internal_fn.y2Format = function (v) {
        var $$ = this, config = $$.config,
            format = config.axis_y2_tick_format ? config.axis_y2_tick_format : $$.defaultValueFormat;
        return format(v);
    };
    c3_chart_internal_fn.defaultValueFormat = function C3_INTERNAL_defaultValueFormat(v) {
        return isValue(v) ? +v : "";
    };
    c3_chart_internal_fn.defaultArcValueFormat = function C3_INTERNAL_defaultArcValueFormat(v, ratio) {
        return (ratio * 100).toFixed(1) + '%';
    };
    c3_chart_internal_fn.dataLabelFormat = function C3_INTERNAL_dataLabelFormat(targetId) {
        var $$ = this, data_labels = $$.config.data_labels,
            format, defaultFormat = function (v) { return isValue(v) ? +v : ""; };
        // find format according to axis id
        if (typeof data_labels.format === 'function') {
            format = data_labels.format;
        } else if (typeof data_labels.format === 'object') {
            if (data_labels.format[targetId]) {
                format = data_labels.format[targetId] === true ? defaultFormat : data_labels.format[targetId];
            } else {
                format = function () { return ''; };
            }
        } else {
            format = defaultFormat;
        }
        return format;
    };

    c3_chart_internal_fn.hasCaches = function (ids) {
        for (var i = 0; i < ids.length; i++) {
            if (! (ids[i] in this.cache)) { return false; }
        }
        return true;
    };
    c3_chart_internal_fn.addCache = function (id, target) {
        this.cache[id] = this.cloneTarget(target);
    };
    c3_chart_internal_fn.getCaches = function (ids) {
        var targets = [], i;
        for (i = 0; i < ids.length; i++) {
            if (ids[i] in this.cache) { targets.push(this.cloneTarget(this.cache[ids[i]])); }
        }
        return targets;
    };

    var CLASS = c3_chart_internal_fn.CLASS = {
        target: 'c3-target',
        chart: 'c3-chart',
        chartLine: 'c3-chart-line',
        chartLines: 'c3-chart-lines',
        chartBar: 'c3-chart-bar',
        chartBars: 'c3-chart-bars',
        chartText: 'c3-chart-text',
        chartTexts: 'c3-chart-texts',
        chartArc: 'c3-chart-arc',
        chartArcs: 'c3-chart-arcs',
        chartArcsTitle: 'c3-chart-arcs-title',
        chartArcsBackground: 'c3-chart-arcs-background',
        chartArcsGaugeUnit: 'c3-chart-arcs-gauge-unit',
        chartArcsGaugeMax: 'c3-chart-arcs-gauge-max',
        chartArcsGaugeMin: 'c3-chart-arcs-gauge-min',
        selectedCircle: 'c3-selected-circle',
        selectedCircles: 'c3-selected-circles',
        eventRect: 'c3-event-rect',
        eventRects: 'c3-event-rects',
        eventRectsSingle: 'c3-event-rects-single',
        eventRectsMultiple: 'c3-event-rects-multiple',
        zoomRect: 'c3-zoom-rect',
        brush: 'c3-brush',
        focused: 'c3-focused',
        defocused: 'c3-defocused',
        region: 'c3-region',
        regions: 'c3-regions',
        title: 'c3-title',
        tooltipContainer: 'c3-tooltip-container',
        tooltip: 'c3-tooltip',
        tooltipName: 'c3-tooltip-name',
        shape: 'c3-shape',
        shapes: 'c3-shapes',
        line: 'c3-line',
        lines: 'c3-lines',
        bar: 'c3-bar',
        bars: 'c3-bars',
        circle: 'c3-circle',
        circles: 'c3-circles',
        arc: 'c3-arc',
        arcs: 'c3-arcs',
        area: 'c3-area',
        areas: 'c3-areas',
        empty: 'c3-empty',
        text: 'c3-text',
        texts: 'c3-texts',
        gaugeValue: 'c3-gauge-value',
        grid: 'c3-grid',
        gridLines: 'c3-grid-lines',
        xgrid: 'c3-xgrid',
        xgrids: 'c3-xgrids',
        xgridLine: 'c3-xgrid-line',
        xgridLines: 'c3-xgrid-lines',
        xgridFocus: 'c3-xgrid-focus',
        ygrid: 'c3-ygrid',
        ygrids: 'c3-ygrids',
        ygridLine: 'c3-ygrid-line',
        ygridLines: 'c3-ygrid-lines',
        axis: 'c3-axis',
        axisX: 'c3-axis-x',
        axisXLabel: 'c3-axis-x-label',
        axisY: 'c3-axis-y',
        axisYLabel: 'c3-axis-y-label',
        axisY2: 'c3-axis-y2',
        axisY2Label: 'c3-axis-y2-label',
        legendBackground: 'c3-legend-background',
        legendItem: 'c3-legend-item',
        legendItemEvent: 'c3-legend-item-event',
        legendItemTile: 'c3-legend-item-tile',
        legendItemHidden: 'c3-legend-item-hidden',
        legendItemFocused: 'c3-legend-item-focused',
        dragarea: 'c3-dragarea',
        EXPANDED: '_expanded_',
        SELECTED: '_selected_',
        INCLUDED: '_included_'
    };
    c3_chart_internal_fn.generateClass = function (prefix, targetId) {
        return " " + prefix + " " + prefix + this.getTargetSelectorSuffix(targetId);
    };
    c3_chart_internal_fn.classText = function (d) {
        return this.generateClass(CLASS.text, d.index);
    };
    c3_chart_internal_fn.classTexts = function (d) {
        return this.generateClass(CLASS.texts, d.id);
    };
    c3_chart_internal_fn.classShape = function (d) {
        return this.generateClass(CLASS.shape, d.index);
    };
    c3_chart_internal_fn.classShapes = function (d) {
        return this.generateClass(CLASS.shapes, d.id);
    };
    c3_chart_internal_fn.classLine = function (d) {
        return this.classShape(d) + this.generateClass(CLASS.line, d.id);
    };
    c3_chart_internal_fn.classLines = function (d) {
        return this.classShapes(d) + this.generateClass(CLASS.lines, d.id);
    };
    c3_chart_internal_fn.classCircle = function (d) {
        return this.classShape(d) + this.generateClass(CLASS.circle, d.index);
    };
    c3_chart_internal_fn.classCircles = function (d) {
        return this.classShapes(d) + this.generateClass(CLASS.circles, d.id);
    };
    c3_chart_internal_fn.classBar = function (d) {
        return this.classShape(d) + this.generateClass(CLASS.bar, d.index);
    };
    c3_chart_internal_fn.classBars = function (d) {
        return this.classShapes(d) + this.generateClass(CLASS.bars, d.id);
    };
    c3_chart_internal_fn.classArc = function (d) {
        return this.classShape(d.data) + this.generateClass(CLASS.arc, d.data.id);
    };
    c3_chart_internal_fn.classArcs = function (d) {
        return this.classShapes(d.data) + this.generateClass(CLASS.arcs, d.data.id);
    };
    c3_chart_internal_fn.classArea = function (d) {
        return this.classShape(d) + this.generateClass(CLASS.area, d.id);
    };
    c3_chart_internal_fn.classAreas = function (d) {
        return this.classShapes(d) + this.generateClass(CLASS.areas, d.id);
    };
    c3_chart_internal_fn.classRegion = function (d, i) {
        return this.generateClass(CLASS.region, i) + ' ' + ('class' in d ? d['class'] : '');
    };
    c3_chart_internal_fn.classEvent = function (d) {
        return this.generateClass(CLASS.eventRect, d.index);
    };
    c3_chart_internal_fn.classTarget = function (id) {
        var $$ = this;
        var additionalClassSuffix = $$.config.data_classes[id], additionalClass = '';
        if (additionalClassSuffix) {
            additionalClass = ' ' + CLASS.target + '-' + additionalClassSuffix;
        }
        return $$.generateClass(CLASS.target, id) + additionalClass;
    };
    c3_chart_internal_fn.classFocus = function (d) {
        return this.classFocused(d) + this.classDefocused(d);
    };
    c3_chart_internal_fn.classFocused = function (d) {
        return ' ' + (this.focusedTargetIds.indexOf(d.id) >= 0 ? CLASS.focused : '');
    };
    c3_chart_internal_fn.classDefocused = function (d) {
        return ' ' + (this.defocusedTargetIds.indexOf(d.id) >= 0 ? CLASS.defocused : '');
    };
    c3_chart_internal_fn.classChartText = function (d) {
        return CLASS.chartText + this.classTarget(d.id);
    };
    c3_chart_internal_fn.classChartLine = function (d) {
        return CLASS.chartLine + this.classTarget(d.id);
    };
    c3_chart_internal_fn.classChartBar = function (d) {
        return CLASS.chartBar + this.classTarget(d.id);
    };
    c3_chart_internal_fn.classChartArc = function (d) {
        return CLASS.chartArc + this.classTarget(d.data.id);
    };
    c3_chart_internal_fn.getTargetSelectorSuffix = function (targetId) {
        return targetId || targetId === 0 ? ('-' + targetId).replace(/[\s?!@#$%^&*()_=+,.<>'":;\[\]\/|~`{}\\]/g, '-') : '';
    };
    c3_chart_internal_fn.selectorTarget = function (id, prefix) {
        return (prefix || '') + '.' + CLASS.target + this.getTargetSelectorSuffix(id);
    };
    c3_chart_internal_fn.selectorTargets = function (ids, prefix) {
        var $$ = this;
        ids = ids || [];
        return ids.length ? ids.map(function (id) { return $$.selectorTarget(id, prefix); }) : null;
    };
    c3_chart_internal_fn.selectorLegend = function (id) {
        return '.' + CLASS.legendItem + this.getTargetSelectorSuffix(id);
    };
    c3_chart_internal_fn.selectorLegends = function (ids) {
        var $$ = this;
        return ids && ids.length ? ids.map(function (id) { return $$.selectorLegend(id); }) : null;
    };

    var isValue = c3_chart_internal_fn.isValue = function C3_INTERNAL_isValue(v) {
            return v || v === 0;
        },
        isFunction = c3_chart_internal_fn.isFunction = function C3_INTERNAL_isFunction(o) {
            return typeof o === 'function';
        },
        isString = c3_chart_internal_fn.isString = function C3_INTERNAL_isString(o) {
            return typeof o === 'string';
        },
        isUndefined = c3_chart_internal_fn.isUndefined = function C3_INTERNAL_isUndefined(v) {
            return typeof v === 'undefined';
        },
        isDefined = c3_chart_internal_fn.isDefined = function C3_INTERNAL_isDefined(v) {
            return typeof v !== 'undefined';
        },
        ceil10 = c3_chart_internal_fn.ceil10 = function C3_INTERNAL_ceil10(v) {
            return Math.ceil(v / 10) * 10;
        },
        asHalfPixel = c3_chart_internal_fn.asHalfPixel = function C3_INTERNAL_asHalfPixel(n) {
            return Math.ceil(n) + 0.5;
        },
        diffDomain = c3_chart_internal_fn.diffDomain = function C3_INTERNAL_diffDomain(d) {
            return d[1] - d[0];
        },
        isEmpty = c3_chart_internal_fn.isEmpty = function C3_INTERNAL_isEmpty(o) {
            return typeof o === 'undefined' || o === null || (isString(o) && o.length === 0) || (typeof o === 'object' && Object.keys(o).length === 0);
        },
        notEmpty = c3_chart_internal_fn.notEmpty = function C3_INTERNAL_notEmpty(o) {
            return !c3_chart_internal_fn.isEmpty(o);
        },
        getOption = c3_chart_internal_fn.getOption = function C3_INTERNAL_getOption(options, key, defaultValue) {
            return isDefined(options[key]) ? options[key] : defaultValue;
        },
        hasValue = c3_chart_internal_fn.hasValue = function C3_INTERNAL_hasValue(dict, value) {
            var found = false;
            Object.keys(dict).forEach(function (key) {
                if (dict[key] === value) { found = true; }
            });
            return found;
        },
        sanitise = c3_chart_internal_fn.sanitise = function C3_INTERNAL_sanitise(str) {
            return typeof str === 'string' ? str.replace(/</g, '&lt;').replace(/>/g, '&gt;') : str;
        },
        getPathBox = c3_chart_internal_fn.getPathBox = function C3_INTERNAL_getPathBox(path) {
            var box = path.getBoundingClientRect(),
                minX, minY;
            // MSIE supports pathSegList while it crashes on latest Chrome: https://msdn.microsoft.com/en-us/library/ff971976(v=vs.85).aspx
            // See also: https://github.com/masayuki0812/c3/issues/1465
            if (path.pathSegList && path.pathSegList.getItem) {
                var seg0 = path.pathSegList.getItem(0);
                var seg1 = path.pathSegList.getItem(1);
                minX = Math.min(seg0.x, seg1.x); 
                minY = Math.min(seg0.y, seg1.y);
            } else {
                minX = box.left;
                minY = box.top;
            }
            return {
                x: minX, 
                y: minY, 
                width: box.width, 
                height: box.height
            };
        };

    c3_chart_fn.focus = function C3_API_focus(targetIds) {
        var $$ = this.internal, candidates;

        targetIds = $$.mapToTargetIds(targetIds);
        candidates = $$.svg.selectAll($$.selectorTargets(targetIds.filter($$.isTargetToShow, $$))),

        this.revert();
        this.defocus();
        candidates.classed(CLASS.focused, true).classed(CLASS.defocused, false);
        if ($$.hasArcType()) {
            $$.expandArc(targetIds);
        }
        $$.toggleFocusLegend(targetIds, true);

        $$.focusedTargetIds = targetIds;
        $$.defocusedTargetIds = $$.defocusedTargetIds.filter(function (id) {
            return targetIds.indexOf(id) < 0;
        });
    };

    c3_chart_fn.defocus = function C3_API_defocus(targetIds) {
        var $$ = this.internal, candidates;

        targetIds = $$.mapToTargetIds(targetIds);
        candidates = $$.svg.selectAll($$.selectorTargets(targetIds.filter($$.isTargetToShow, $$))),

        candidates.classed(CLASS.focused, false).classed(CLASS.defocused, true);
        if ($$.hasArcType()) {
            $$.unexpandArc(targetIds);
        }
        $$.toggleFocusLegend(targetIds, false);

        $$.focusedTargetIds = $$.focusedTargetIds.filter(function (id) {
            return targetIds.indexOf(id) < 0;
        });
        $$.defocusedTargetIds = targetIds;
    };

    c3_chart_fn.revert = function C3_API_revert(targetIds) {
        var $$ = this.internal, candidates;

        targetIds = $$.mapToTargetIds(targetIds);
        candidates = $$.svg.selectAll($$.selectorTargets(targetIds)); // should be for all targets

        candidates.classed(CLASS.focused, false).classed(CLASS.defocused, false);
        if ($$.hasArcType()) {
            $$.unexpandArc(targetIds);
        }
        if ($$.config.legend_show) {
            $$.showLegend(targetIds.filter($$.isLegendToShow.bind($$)));
            $$.legend.selectAll($$.selectorLegends(targetIds))
                .filter(function () {
                    return $$.d3.select(this).classed(CLASS.legendItemFocused);
                })
                .classed(CLASS.legendItemFocused, false);
        }

        $$.focusedTargetIds = [];
        $$.defocusedTargetIds = [];
    };

    c3_chart_fn.show = function C3_API_show(targetIds, options) {
        var $$ = this.internal, 
            targets;

        targetIds = $$.mapToTargetIds(targetIds);
        options = options || {};

        $$.removeHiddenTargetIds(targetIds);
        targets = $$.svg.selectAll($$.selectorTargets(targetIds));

        targets.transition()
            .style('opacity', 1, 'important')
            .call($$.endall, function () {
                targets.style('opacity', null).style('opacity', 1);
            });

        if (options.withLegend) {
            $$.showLegend(targetIds);
        }

        $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true, withLegend: true});
    };

    c3_chart_fn.hide = function C3_API_hide(targetIds, options) {
        var $$ = this.internal, 
            targets;

        targetIds = $$.mapToTargetIds(targetIds);
        options = options || {};

        $$.addHiddenTargetIds(targetIds);
        targets = $$.svg.selectAll($$.selectorTargets(targetIds));

        targets.transition()
            .style('opacity', 0, 'important')
            .call($$.endall, function () {
                targets.style('opacity', null).style('opacity', 0);
            });

        if (options.withLegend) {
            $$.hideLegend(targetIds);
        }

        $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true, withLegend: true});
    };

    c3_chart_fn.toggle = function C3_API_toggle(targetIds, options) {
        var that = this, 
            $$ = this.internal;
        $$.mapToTargetIds(targetIds).forEach(function (targetId) {
            $$.isTargetToShow(targetId) ? that.hide(targetId, options) : that.show(targetId, options);
        });
    };

    c3_chart_fn.toggleLabels = function C3_API_toggleLabels(value) {
        var $$ = this.internal, 
            config = $$.config;
        if (config.data_labels !== (value || false)) {
            config.data_labels = value || false;
            $$.updateAndRedraw();            
        }
    };

    c3_chart_fn.zoom = function C3_API_zoom(domain) {
        var $$ = this.internal;
        if (domain) {
            if ($$.isTimeSeries()) {
                domain = domain.map(function (x) { 
                    return $$.parseDate(x); 
                });
            }
            $$.brush.extent(domain);
            $$.redraw({withUpdateXDomain: true, withY: $$.config.zoom_rescale});
            $$.config.zoom_onzoom.call(this, $$.x.orgDomain());
        }
        return $$.brush.extent();
    };
    c3_chart_fn.zoom.enable = function C3_API_zoom_enable(enabled) {
        var $$ = this.internal;
        $$.config.zoom_enabled = enabled;
        $$.updateAndRedraw();
    };
    c3_chart_fn.unzoom = function C3_API_unzoom() {
        var $$ = this.internal;
        $$.brush.clear().update();
        $$.redraw({withUpdateXDomain: true});
    };

    c3_chart_fn.zoom.max = function C3_API_zoom_max(max) {
        var $$ = this.internal, config = $$.config, d3 = $$.d3;
        if (max === 0 || max) {
            config.zoom_x_max = d3.max([$$.orgXDomain[1], max]);
        }
        else {
            return config.zoom_x_max;
        }
    };

    c3_chart_fn.zoom.min = function C3_API_zoom_min(min) {
        var $$ = this.internal, config = $$.config, d3 = $$.d3;
        if (min === 0 || min) {
            config.zoom_x_min = d3.min([$$.orgXDomain[0], min]);
        }
        else {
            return config.zoom_x_min;
        }
    };

    c3_chart_fn.zoom.range = function C3_API_zoom_range(range) {
        if (arguments.length) {
            if (isDefined(range.max)) { this.domain.max(range.max); }
            if (isDefined(range.min)) { this.domain.min(range.min); }
        } else {
            return {
                max: this.domain.max(),
                min: this.domain.min()
            };
        }
    };

    c3_chart_fn.load = function C3_API_load(args) {
        var $$ = this.internal, 
            config = $$.config;
        // update xs if specified
        if (args.xs) {
            $$.addXs(args.xs);
        }
        // update names if exists
        if ('names' in args) {
            c3_chart_fn.data.names.bind(this)(args.names);
        }
        // update classes if exists
        if (args.classes) {
            Object.keys(args.classes).forEach(function (id) {
                config.data_classes[id] = args.classes[id];
            });
        }
        // update categories if exists
        if (args.categories && $$.isCategorized()) {
            config.axis_x_categories = args.categories;
        }
        // update axes if exists
        if (args.axes) {
            Object.keys(args.axes).forEach(function (id) {
                config.data_axes[id] = args.axes[id];
            });
        }
        // update colors if exists
        if (args.colors) {
            Object.keys(args.colors).forEach(function (id) {
                config.data_colors[id] = args.colors[id];
            });
        }
        // update calculateOpacity if exists
        if ('calculateOpacity' in args) {
            Object.keys(args.calculateOpacity).forEach(function (id) {
                config.data_calculateOpacity[id] = args.calculateOpacity[id];
            });
        }
        // update names if exists
        if (args.names) {
            this.data.names(args.names, false);
        }
        // update groups if exists
        if (args.groups) {
            this.groups(args.groups, false);
        }
        // use cache if exists
        if (args.cacheIds && $$.hasCaches(args.cacheIds)) {
            $$.load($$.getCaches(args.cacheIds), args.done);
            return;
        }
        // unload if needed (args.unload can be a boolean value TRUE or an ID string or an array of IDs to feed to mapToTargetIds())
        if (args.unload) {
            var idsToUnload = $$.mapToTargetIds((typeof args.unload === 'boolean' && args.unload) ? null : args.unload);

            // TODO: do not unload if target will load (included in url/rows/columns)
            $$.unload(idsToUnload, function () {
                $$.loadFromArgs(args);
            });
        } else {
            $$.loadFromArgs(args);
        }
        // toggle data labels if exists
        if (args.labels) {
            this.toggleLabels(args.labels);
        }
    };

    c3_chart_fn.unload = function C3_API_unload(args) {
        var $$ = this.internal;
        args = args || {};
        if (args instanceof Array) {
            args = {ids: args};
        } else if (typeof args === 'string') {
            args = {ids: [args]};
        }
        $$.unload($$.mapToTargetIds(args.ids), function () {
            $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true, withLegend: true});
            if (args.done) { 
                args.done(); 
            }
        });
    };

    c3_chart_fn.flow = function C3_API_flow(args) {
        var $$ = this.internal,
            targets, data, 
            notfoundIds = [], 
            orgDataCount = $$.getMaxDataCount(),
            dataCount, domain, baseTarget, baseValue, 
            length = 0, 
            tail = 0, 
            diff, to;

        if (args.json) {
            data = $$.convertJsonToData(args.json, args.keys);
        }
        else if (args.rows) {
            data = $$.convertRowsToData(args.rows);
        }
        else if (args.columns) {
            data = $$.convertColumnsToData(args.columns);
        }
        else {
            return;
        }
        targets = $$.convertDataToTargets(data, true);

        // Update/Add data
        $$.data.targets.forEach(function (t) {
            var found = false, 
                i, j;
            for (i = 0; i < targets.length; i++) {
                if (t.id === targets[i].id) {
                    found = true;

                    if (t.values[t.values.length - 1]) {
                        tail = t.values[t.values.length - 1].index + 1;
                    }
                    length = targets[i].values.length;

                    for (j = 0; j < length; j++) {
                        targets[i].values[j].index = tail + j;
                        if (!$$.isTimeSeries()) {
                            if ($$.isCustomX()) {
                                // If we have custom x, just use the value fed in
                                targets[i].values[j].x = targets[i].values[j].x;
                            } else {
                                // otherwise make one based on the last index
                                targets[i].values[j].x = tail + j;
                            }
                        }
                    }
                    t.values = t.values.concat(targets[i].values);

                    targets.splice(i, 1);
                    break;
                }
            }
            if (!found) { 
                notfoundIds.push(t.id); 
            }
        });

        // Append null for not found targets
        $$.data.targets.forEach(function (t) {
            var i, j;
            for (i = 0; i < notfoundIds.length; i++) {
                if (t.id === notfoundIds[i]) {
                    tail = t.values[t.values.length - 1].index + 1;
                    for (j = 0; j < length; j++) {
                        t.values.push({
                            id: t.id,
                            index: tail + j,
                            x: $$.isTimeSeries() ? $$.getOtherTargetX(tail + j) : tail + j,
                            value: null
                        });
                    }
                }
            }
        });

        // Generate null values for new target
        if ($$.data.targets.length) {
            targets.forEach(function (t) {
                var i, missing = [];
                for (i = $$.data.targets[0].values[0].index; i < tail; i++) {
                    missing.push({
                        id: t.id,
                        index: i,
                        x: $$.isTimeSeries() ? $$.getOtherTargetX(i) : i,
                        value: null
                    });
                }
                t.values.forEach(function (v) {
                    v.index += tail;
                    if (!$$.isTimeSeries()) {
                        v.x += tail;
                    }
                });
                t.values = missing.concat(t.values);
            });
        }
        $$.data.targets = $$.data.targets.concat(targets); // add remained

        // check data count because behavior needs to change when it's only one
        dataCount = $$.getMaxDataCount();
        baseTarget = $$.data.targets[0];
        baseValue = baseTarget.values[0];

        // Update length to flow if needed
        if (isDefined(args.to)) {
            length = 0;
            to = $$.isTimeSeries() ? $$.parseDate(args.to) : args.to;
            baseTarget.values.forEach(function (v) {
                if (v.x < to) { 
                    length++; 
                }
            });
        } else if (isDefined(args.length)) {
            length = args.length;
        }

        // If only one data, update the domain to flow from left edge of the chart
        if (!orgDataCount) {
            if ($$.isTimeSeries()) {
                if (baseTarget.values.length > 1) {
                    diff = baseTarget.values[baseTarget.values.length - 1].x - baseValue.x;
                } else {
                    diff = baseValue.x - $$.getXDomain($$.data.targets)[0];
                }
            } else {
                diff = 1;
            }
            domain = [baseValue.x - diff, baseValue.x];
            $$.updateXDomain(null, true, true, false, domain);
        } else if (orgDataCount === 1) {
            if ($$.isTimeSeries()) {
                diff = (baseTarget.values[baseTarget.values.length - 1].x - baseValue.x) / 2;
                domain = [new Date(+baseValue.x - diff), new Date(+baseValue.x + diff)];
                $$.updateXDomain(null, true, true, false, domain);
            }
        }

        // Set targets
        $$.updateTargets($$.data.targets);

        // Redraw with new targets
        $$.redraw({
            flow: {
                index: baseValue.index,
                length: length,
                duration: isValue(args.duration) ? args.duration : $$.config.transition_duration,
                done: args.done,
                orgDataCount: orgDataCount,
            },
            withLegend: true,
            withTransition: orgDataCount > 1,
            withTrimXDomain: false,
            withUpdateXDomain: $$.isTimeSeries,
            withUpdateXAxis: true
        });
    };

    c3_chart_internal_fn.generateFlow = function C3_INTERNAL_generateFlow(args) {
        var $$ = this, 
            config = $$.config, 
            d3 = $$.d3;

        return function () {
            var targets = args.targets,
                flow = args.flow,
                drawBar = args.drawBar,
                drawLine = args.drawLine,
                drawArea = args.drawArea,
                cx = args.cx,
                cy = args.cy,
                xv = args.xv,
                xForText = args.xForText,
                yForText = args.yForText,
                duration = args.duration;

            var translateX, 
                scaleX = 1, 
                transform,
                flowIndex = flow.index,
                flowLength = flow.length,
                flowStart = $$.getValueOnIndex($$.data.targets[0].values, flowIndex),
                flowEnd = $$.getValueOnIndex($$.data.targets[0].values, flowIndex + flowLength),
                orgDomain = $$.x.domain(), domain,
                durationForFlow = flow.duration || duration,
                done = flow.done || function () {},
                wait = $$.generateWait();

            var xgrid = $$.xgrid || d3.selectAll([]),
                xgridLines = $$.xgridLines || d3.selectAll([]),
                mainRegion = $$.mainRegion || d3.selectAll([]),
                mainText = $$.mainText || d3.selectAll([]),
                mainBar = $$.mainBar || d3.selectAll([]),
                mainLine = $$.mainLine || d3.selectAll([]),
                mainArea = $$.mainArea || d3.selectAll([]),
                mainCircle = $$.mainCircle || d3.selectAll([]);

            // set flag
            $$.flowing = true;

            // remove head data after rendered
            $$.data.targets.forEach(function (d) {
                d.values.splice(0, flowLength);
            });

            // update x domain to generate axis elements for flow
            domain = $$.updateXDomain(targets, true, true);
            // update elements related to x scale
            if ($$.updateXGrid) { 
                $$.updateXGrid(true); 
            }

            // generate transform to flow
            if (!flow.orgDataCount) { // if empty
                if ($$.data.targets[0].values.length !== 1) {
                    translateX = $$.x(orgDomain[0]) - $$.x(domain[0]);
                } else {
                    if ($$.isTimeSeries()) {
                        flowStart = $$.getValueOnIndex($$.data.targets[0].values, 0);
                        flowEnd = $$.getValueOnIndex($$.data.targets[0].values, $$.data.targets[0].values.length - 1);
                        translateX = $$.x(flowStart.x) - $$.x(flowEnd.x);
                    } else {
                        translateX = diffDomain(domain) / 2;
                    }
                }
            } else if (flow.orgDataCount === 1 || (flowStart && flowStart.x) === (flowEnd && flowEnd.x)) {
                translateX = $$.x(orgDomain[0]) - $$.x(domain[0]);
            } else {
                if ($$.isTimeSeries()) {
                    translateX = ($$.x(orgDomain[0]) - $$.x(domain[0]));
                } else {
                    translateX = ($$.x(flowStart.x) - $$.x(flowEnd.x));
                }
            }
            scaleX = (diffDomain(orgDomain) / diffDomain(domain));
            transform = 'translate(' + translateX + ',0) scale(' + scaleX + ',1)';

            $$.hideXGridFocus();

            d3.transition().ease('linear').duration(durationForFlow).each(function () {
                wait.add($$.axes.x.transition().call($$.xAxis));
                wait.add(mainBar.transition().attr('transform', transform));
                wait.add(mainLine.transition().attr('transform', transform));
                wait.add(mainArea.transition().attr('transform', transform));
                wait.add(mainCircle.transition().attr('transform', transform));
                wait.add(mainText.transition().attr('transform', transform));
                wait.add(mainRegion.filter($$.isRegionOnX).transition().attr('transform', transform));
                wait.add(xgrid.transition().attr('transform', transform));
                wait.add(xgridLines.transition().attr('transform', transform));
            })
            .call(wait, function () {
                var i, 
                    shapes = [], 
                    texts = [], 
                    eventRects = [];

                // remove flowed elements
                if (flowLength) {
                    for (i = 0; i < flowLength; i++) {
                        shapes.push('.' + CLASS.shape + '-' + (flowIndex + i));
                        texts.push('.' + CLASS.text + '-' + (flowIndex + i));
                        eventRects.push('.' + CLASS.eventRect + '-' + (flowIndex + i));
                    }
                    $$.svg.selectAll('.' + CLASS.shapes).selectAll(shapes).remove();
                    $$.svg.selectAll('.' + CLASS.texts).selectAll(texts).remove();
                    $$.svg.selectAll('.' + CLASS.eventRects).selectAll(eventRects).remove();
                    $$.svg.select('.' + CLASS.xgrid).remove();
                }

                // draw again for removing flowed elements and reverting attr
                xgrid
                    .attr('transform', null)
                    .attr($$.xgridAttr);
                xgridLines
                    .attr('transform', null);
                xgridLines.select('line')
                    .attr("x1", config.axis_rotated ? 0 : xv)
                    .attr("x2", config.axis_rotated ? $$.width : xv);
                xgridLines.select('text')
                    .attr("x", config.axis_rotated ? $$.width : 0)
                    .attr("y", xv);
                mainBar
                    .attr('transform', null)
                    .attr("d", drawBar);
                mainLine
                    .attr('transform', null)
                    .attr("d", drawLine);
                mainArea
                    .attr('transform', null)
                    .attr("d", drawArea);
                mainCircle
                    .attr('transform', null)
                    .attr("cx", cx)
                    .attr("cy", cy);
                mainText
                    .attr('transform', null)
                    .attr('x', xForText)
                    .attr('y', yForText)
                    .style('fill-opacity', $$.opacityForText.bind($$));
                mainRegion
                    .attr('transform', null);
                mainRegion.select('rect').filter($$.isRegionOnX)
                    .attr("x", $$.regionX.bind($$))
                    .attr("width", $$.regionWidth.bind($$));

                if (config.interaction_enabled) {
                    $$.redrawEventRect();
                }

                // callback for end of flow
                done();

                $$.flowing = false;
            });
        };
    };

    c3_chart_fn.selected = function C3_API_selected(targetId) {
        var $$ = this.internal, 
            d3 = $$.d3;
        return d3.merge(
            $$.main.selectAll('.' + CLASS.shapes + $$.getTargetSelectorSuffix(targetId)).selectAll('.' + CLASS.shape)
                .filter(function () { 
                    return d3.select(this).classed(CLASS.SELECTED); 
                })
                .map(function (d) { 
                    return d.map(function (d) { 
                        var data = d.__data__; 
                        return data.data ? data.data : data; 
                    }); 
                })
        );
    };
    c3_chart_fn.select = function C3_API_select(ids, indices, resetOther) {
        var $$ = this.internal, 
            d3 = $$.d3, 
            config = $$.config;
        if (!config.data_selection_enabled) { return; }
        $$.main.selectAll('.' + CLASS.shapes).selectAll('.' + CLASS.shape).each(function (d, i) {
            var shape = d3.select(this), 
                id = d.data ? d.data.id : d.id,
                toggle = $$.getToggle(this, d).bind($$),
                isTargetId = config.data_selection_grouped || !ids || ids.indexOf(id) >= 0,
                isTargetIndex = !indices || indices.indexOf(i) >= 0,
                isSelected = shape.classed(CLASS.SELECTED);
            // line/area selection not supported yet
            if (shape.classed(CLASS.line) || shape.classed(CLASS.area)) {
                return;
            }
            if (isTargetId && isTargetIndex) {
                if (config.data_selection_isselectable(d) && !isSelected) {
                    toggle(true, shape.classed(CLASS.SELECTED, true), d, i);
                }
            } else if (isDefined(resetOther) && resetOther) {
                if (isSelected) {
                    toggle(false, shape.classed(CLASS.SELECTED, false), d, i);
                }
            }
        });
    };
    c3_chart_fn.unselect = function C3_API_unselect(ids, indices) {
        var $$ = this.internal, 
            d3 = $$.d3, 
            config = $$.config;
        if (!config.data_selection_enabled) { return; }
        $$.main.selectAll('.' + CLASS.shapes).selectAll('.' + CLASS.shape).each(function (d, i) {
            var shape = d3.select(this), id = d.data ? d.data.id : d.id,
                toggle = $$.getToggle(this, d).bind($$),
                isTargetId = config.data_selection_grouped || !ids || ids.indexOf(id) >= 0,
                isTargetIndex = !indices || indices.indexOf(i) >= 0,
                isSelected = shape.classed(CLASS.SELECTED);
            // line/area selection not supported yet
            if (shape.classed(CLASS.line) || shape.classed(CLASS.area)) {
                return;
            }
            if (isTargetId && isTargetIndex) {
                if (config.data_selection_isselectable(d)) {
                    if (isSelected) {
                        toggle(false, shape.classed(CLASS.SELECTED, false), d, i);
                    }
                }
            }
        });
    };

    c3_chart_fn.transform = function C3_API_transform(type, targetIds) {
        var $$ = this.internal,
            options = ['pie', 'donut'].indexOf(type) >= 0 ? {withTransform: true} : null;
        $$.transformTo(targetIds, type, options);
    };

    c3_chart_internal_fn.transformTo = function C3_INTERNAL_transformTo(targetIds, type, optionsForRedraw) {
        var $$ = this,
            withTransitionForAxis = $$.config.transition_duration && !$$.hasArcType(),
            options = optionsForRedraw || {withTransitionForAxis: withTransitionForAxis};
        options.withTransitionForTransform = false;
        $$.transiting = false;
        $$.setTargetType(targetIds, type);
        $$.updateTargets($$.data.targets); // this is needed when transforming to arc
        $$.updateAndRedraw(options);
    };

    c3_chart_fn.groups = function C3_API_groups(groups, redraw) {
        var $$ = this.internal, config = $$.config;

        if (!isUndefined(groups)) {
          config.data_groups = groups;

          if (!isUndefined(redraw) ? redraw : true) {
            $$.redraw();
          }
        }

        return config.data_groups;
    };

    c3_chart_fn.xgrids = function C3_API_xgrids(grids) {
        var $$ = this.internal, config = $$.config;
        if (! grids) { return config.grid_x_lines; }
        config.grid_x_lines = grids;
        $$.redrawWithoutRescale();
        return config.grid_x_lines;
    };
    c3_chart_fn.xgrids.add = function C3_API_xgrids_add(grids) {
        var $$ = this.internal;
        return this.xgrids($$.config.grid_x_lines.concat(grids ? grids : []));
    };
    c3_chart_fn.xgrids.remove = function C3_API_xgrids_remove(params) { // TODO: multiple
        var $$ = this.internal;
        $$.removeGridLines(params, true);
    };

    c3_chart_fn.ygrids = function C3_API_ygrids(grids) {
        var $$ = this.internal, config = $$.config;
        if (! grids) { return config.grid_y_lines; }
        config.grid_y_lines = grids;
        $$.redrawWithoutRescale();
        return config.grid_y_lines;
    };
    c3_chart_fn.ygrids.add = function C3_API_ygrids_add(grids) {
        var $$ = this.internal;
        return this.ygrids($$.config.grid_y_lines.concat(grids ? grids : []));
    };
    c3_chart_fn.ygrids.remove = function C3_API_ygrids_remove(params) { // TODO: multiple
        var $$ = this.internal;
        $$.removeGridLines(params, false);
    };

    c3_chart_fn.regions = function C3_API_regions(regions) {
        var $$ = this.internal, 
            config = $$.config;
        if (!regions) { 
            return config.regions; 
        }
        config.regions = regions;
        $$.redrawWithoutRescale();
        return config.regions;
    };
    c3_chart_fn.regions.add = function C3_API_regions_add(regions) {
        var $$ = this.internal, 
            config = $$.config;
        if (!regions) { 
            return config.regions; 
        }
        config.regions = config.regions.concat(regions);
        $$.redrawWithoutRescale();
        return config.regions;
    };
    c3_chart_fn.regions.remove = function C3_API_regions_remove(options) {
        var $$ = this.internal, 
            config = $$.config,
            duration, classes, regions;

        options = options || {};
        duration = $$.getOption(options, "duration", config.transition_duration);
        classes = $$.getOption(options, "classes", [CLASS.region]);

        regions = $$.main.select('.' + CLASS.regions).selectAll(classes.map(function (c) { 
            return '.' + c; 
        }));
        (duration ? regions.transition().duration(duration) : regions)
            .style('opacity', 0)
            .remove();

        config.regions = config.regions.filter(function (region) {
            var found = false;
            if (!region.class) {
                return true;
            }
            region.class.split(' ').forEach(function (c) {
                if (classes.indexOf(c) >= 0) { 
                    found = true; 
                }
            });
            return !found;
        });

        return config.regions;
    };

    c3_chart_fn.data = function C3_API_data(targetIds) {
        var targets = this.internal.data.targets;
        return typeof targetIds === 'undefined' ? targets : targets.filter(function (t) {
            return [].concat(targetIds).indexOf(t.id) >= 0;
        });
    };
    c3_chart_fn.data.shown = function C3_API_data_shown(targetIds) {
        return this.internal.filterTargetsToShow(this.data(targetIds));
    };
    c3_chart_fn.data.values = function C3_API_data_values(targetId) {
        var targets, values = null;
        if (targetId) {
            targets = this.data(targetId);
            values = targets[0] ? targets[0].values.map(function (d) { return d.value; }) : null;
        }
        return values;
    };
    c3_chart_fn.data.names = function C3_API_data_names(names, redraw) {
        this.internal.clearLegendItemTextBoxCache();
        return this.internal.updateDataAttributes('names', names, !isUndefined(redraw) ? redraw : true);
    };
    c3_chart_fn.data.colors = function C3_API_data_colors(colors, redraw) {
        return this.internal.updateDataAttributes('colors', colors, !isUndefined(redraw) ? redraw : true);
    };
    c3_chart_fn.data.axes = function C3_API_data_axes(axes, redraw) {
        return this.internal.updateDataAttributes('axes', axes, !isUndefined(redraw) ? redraw : true);
    };

    c3_chart_fn.category = function (i, category) {
        var $$ = this.internal, config = $$.config;
        if (arguments.length > 1) {
            config.axis_x_categories[i] = category;
            $$.redraw();
        }
        return config.axis_x_categories[i];
    };
    c3_chart_fn.categories = function (categories) {
        var $$ = this.internal, config = $$.config;
        if (!arguments.length) { return config.axis_x_categories; }
        config.axis_x_categories = categories;
        $$.redraw();
        return config.axis_x_categories;
    };

    // TODO: fix
    c3_chart_fn.color = function C3_API_color(id) {
        var $$ = this.internal;
        return $$.color(id); // more patterns
    };

    c3_chart_fn.x = function C3_API_x(x) {
        var $$ = this.internal;
        if (arguments.length) {
            $$.updateTargetX($$.data.targets, x);
            $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true});
        }
        return $$.data.xs;
    };
    c3_chart_fn.xs = function C3_API_xs(xs) {
        var $$ = this.internal;
        if (arguments.length) {
            $$.updateTargetXs($$.data.targets, xs);
            $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true});
        }
        return $$.data.xs;
    };

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

    c3_chart_fn.legend = function C3_API_legend() {};
    c3_chart_fn.legend.show = function C3_API_legend_show(targetIds) {
        var $$ = this.internal;
        $$.showLegend($$.mapToTargetIds(targetIds));
        $$.updateAndRedraw({withLegend: true});
    };
    c3_chart_fn.legend.hide = function C3_API_legend_hide(targetIds) {
        var $$ = this.internal;
        $$.hideLegend($$.mapToTargetIds(targetIds));
        $$.updateAndRedraw({withLegend: true});
    };

    c3_chart_fn.resize = function (size) {
        var $$ = this.internal, config = $$.config;
        config.size_width = size ? size.width : null;
        config.size_height = size ? size.height : null;
        this.flush();
    };

    c3_chart_fn.flush = function () {
        var $$ = this.internal;
        $$.updateAndRedraw({withLegend: true, withTransition: false, withTransitionForTransform: false});
    };

    c3_chart_fn.destroy = function () {
        var $$ = this.internal;

        window.clearInterval($$.intervalForObserveInserted);

        if ($$.resizeTimeout !== undefined) {
            window.clearTimeout($$.resizeTimeout);
        }

        if (window.detachEvent) {
            window.detachEvent('onresize', $$.resizeFunction);
        } else if (window.removeEventListener) {
            window.removeEventListener('resize', $$.resizeFunction);
        } else {
            var wrapper = window.onresize;
            // check if no one else removed our wrapper and remove our resizeFunction from it
            if (wrapper && wrapper.add && wrapper.remove) {
                wrapper.remove($$.resizeFunction);
            }
        }

        $$.selectChart.classed('c3', false).html("");

        // MEMO: this is needed because the reference of some elements will not be released, then memory leak will happen.
        Object.keys($$).forEach(function (key) {
            $$[key] = null;
        });

        return null;
    };

    c3_chart_fn.tooltip = function C3_API_tooltip() {};
    c3_chart_fn.tooltip.show = function C3_API_tooltip_show(args) {
        var $$ = this.internal, index, mouse;

        // determine mouse position on the chart
        if (args.mouse) {
            mouse = args.mouse;
        }

        // determine focus data
        if (args.data) {
            if ($$.isMultipleX()) {
                // if multiple xs, target point will be determined by mouse
                mouse = [$$.x(args.data.x), $$.getYScale(args.data.id)(args.data.value)];
                index = null;
            } else {
                // TODO: when tooltip_grouped = false
                index = isValue(args.data.index) ? args.data.index : $$.getIndexByX(args.data.x);
            }
        }
        else if (typeof args.x !== 'undefined') {
            index = $$.getIndexByX(args.x);
        }
        else if (typeof args.index !== 'undefined') {
            index = args.index;
        }

        // emulate mouse events to show
        $$.dispatchEvent('mouseover', index, mouse);
        $$.dispatchEvent('mousemove', index, mouse);

        $$.config.tooltip_onshow.call($$, args.data);
    };
    c3_chart_fn.tooltip.hide = function C3_API_tooltip_hide() {
        // TODO: get target data by checking the state of focus
        this.internal.dispatchEvent('mouseout', 0);

        this.internal.config.tooltip_onhide.call(this);
    };

    c3_chart_fn.originalJson = function C3_API_originalJson() {
    	return this.internal.getOriginalJson();
    };
    c3_chart_fn.originalJsonArray = function C3_API_originalJsonArray() {
    	return this.internal.json2array(this.internal.getOriginalJson());
    };
    // Features:
    // 1. category axis
    // 2. ceil values of translate/x/y to int for half pixel antialiasing
    // 3. multiline tick text
    var tickTextCharSize;
    function c3_axis(d3, params) {
        var scale = d3.scale.linear(), 
            orient = "bottom", 
            innerTickSize = 6, 
            outerTickSize, 
            tickPadding = 3, 
            tickValues = null, 
            tickFormat, tickArguments;

        var tickOffset = 0, 
            tickCulling = true, 
            tickCentered;

        params = params || {};
        outerTickSize = params.withOuterTick ? 6 : 0;

        function axisX(selection, x) {
            selection.attr("transform", function (d) {
                return "translate(" + Math.ceil(x(d) + tickOffset) + ", 0)";
            });
        }
        function axisY(selection, y) {
            selection.attr("transform", function (d) {
                return "translate(0," + Math.ceil(y(d)) + ")";
            });
        }
        function scaleExtent(domain) {
            var start = domain[0], stop = domain[domain.length - 1];
            return start < stop ? [ start, stop ] : [ stop, start ];
        }
        function generateTicks(scale) {
            var i, domain, 
                ticks = [];
            if (scale.ticks) {
                return scale.ticks.apply(scale, tickArguments);
            }
            domain = scale.domain();
            for (i = Math.ceil(domain[0]); i < domain[1]; i++) {
                ticks.push(i);
            }
            if (ticks.length > 0 && ticks[0] > 0) {
                ticks.unshift(ticks[0] - (ticks[1] - ticks[0]));
            }
            return ticks;
        }
        function copyScale() {
            var newScale = scale.copy(), 
                domain;
            if (params.isCategory) {
                domain = scale.domain();
                newScale.domain([domain[0], domain[1] - 1]);
            }
            return newScale;
        }
        function textFormatted(v) {
            var formatted = tickFormat ? tickFormat(v) : v;
            return typeof formatted !== 'undefined' ? formatted.toString() : '';
        }
        function getSizeFor1Char(tick) {
            if (tickTextCharSize) {
                return tickTextCharSize;
            }
            var size = {
                h: 11.5,
                w: 5.5
            };
            tick.select('text').text(textFormatted).each(function (d) {
                var box = this.getBoundingClientRect(),
                    text = textFormatted(d),
                    h = box.height,
                    w = text ? (box.width / text.length) : undefined;
                if (h && w) {
                    size.h = h;
                    size.w = w;
                }
            }).text('');
            tickTextCharSize = size;
            return size;
        }
        function transitionise(selection) {
            return params.withoutTransition ? selection : d3.transition(selection);
        }
        function axis(g) {
            g.each(function C3_INTERNAL_update_axis() {
                var g = axis.g = d3.select(this);

                var scale0 = this.__chart__ || scale, 
                    scale1 = this.__chart__ = copyScale();

                var ticks = tickValues ? tickValues : generateTicks(scale1),
                    tick = g.selectAll(".tick").data(ticks, scale1),
                    tickEnter = tick.enter().insert("g", ".domain").attr("class", "tick").style("opacity", 1e-6),
                    // MEMO: No exit transition. The reason is this transition affects max tick width calculation because old tick will be included in the ticks.
                    tickExit = tick.exit().remove(),
                    tickUpdate = transitionise(tick).style("opacity", 1),
                    tickTransform, tickX, tickY;

                var range = scale.rangeExtent ? scale.rangeExtent() : scaleExtent(scale.range()),
                    path = g.selectAll(".domain").data([ 0 ]),
                    pathUpdate = (path.enter().append("path").attr("class", "domain"), transitionise(path));
                tickEnter.append("line");
                tickEnter.append("text");

                var lineEnter = tickEnter.select("line"),
                    lineUpdate = tickUpdate.select("line"),
                    textEnter = tickEnter.select("text"),
                    textUpdate = tickUpdate.select("text");

                if (params.isCategory) {
                    tickOffset = Math.ceil((scale1(1) - scale1(0)) / 2);
                    tickX = tickCentered ? 0 : tickOffset;
                    tickY = tickCentered ? tickOffset : 0;
                } else {
                    tickOffset = tickX = 0;
                }

                var text, tspan, 
                    sizeFor1Char = getSizeFor1Char(g.select('.tick')), 
                    counts = [];
                var tickLength = Math.max(innerTickSize, 0) + tickPadding,
                    isVertical = orient === 'left' || orient === 'right';

                // this should be called only when category axis
                function splitTickText(d, maxWidth) {
                    var tickText = textFormatted(d),
                        subtext, spaceIndex, preserveSpace, textWidth, 
                        splitted = [];

                    if (Object.prototype.toString.call(tickText) === "[object Array]") {
                        return tickText;
                    }

                    if (!maxWidth || maxWidth <= 0) {
                        maxWidth = isVertical ? 95 : params.isCategory ? (Math.ceil(scale1(ticks[1]) - scale1(ticks[0])) - 12) : 110;
                    }

                    function split(splitted, text) {
                        spaceIndex = undefined;
                        for (var i = 1; i < text.length; i++) {
                            var currentChar = text.charAt(i);
                            if (currentChar === ' ' || currentChar === '\n') {
                                spaceIndex = i;
                                preserveSpace = 0;
                            } else if (currentChar === '/' || currentChar === '-') {
                                spaceIndex = i;
                                preserveSpace = 1;
                            }
                            subtext = text.substr(0, i + 1);
                            textWidth = sizeFor1Char.w * subtext.length;
                            // if text width gets over tick width OR we have reached a newline character, split by space index or current index
                            if (currentChar === '\n' || maxWidth < textWidth) {
                                return split(
                                    splitted.concat(text.substr(0, spaceIndex ? spaceIndex + preserveSpace : i)),
                                    text.slice(spaceIndex ? spaceIndex + 1 : i)
                                );
                            }
                        }
                        return splitted.concat(text);
                    }

                    return split(splitted, tickText + "");
                }

                function tspanDy(d, i) {
                    var dy = sizeFor1Char.h;
                    if (i === 0) {
                        if (orient === 'left' || orient === 'right') {
                            dy = -Math.round((counts[d.index] - 1) * (sizeFor1Char.h / 2) - sizeFor1Char.h / 4);
                        } else {
                            dy = ".71em";
                        }
                    }
                    return dy;
                }

                function tickSize(d) {
                    var tickPosition = scale(d) + (tickCentered ? 0 : tickOffset);
                    return range[0] < tickPosition && tickPosition < range[1] ? innerTickSize : 0;
                }

                text = tick.select("text");
                tspan = text.selectAll('tspan')
                    .data(function (d, i) {
                        var splitted = params.tickMultiline ? splitTickText(d, params.tickWidth) : [].concat(textFormatted(d));
                        counts[i] = splitted.length;
                        return splitted.map(function (s) {
                            return { 
                                index: i, 
                                splitted: s 
                            };
                        });
                    });
                tspan.enter().append('tspan');
                tspan.exit().remove();
                tspan.text(function (d) { 
                    return d.splitted; 
                });

                var rotate = params.tickTextRotate;

                function textAnchorForText(rotate) {
                    if (!rotate) {
                        return 'middle';
                    }
                    return rotate > 0 ? "start" : "end";
                }
                function textTransform(rotate) {
                    if (!rotate) {
                        return '';
                    }
                    return "rotate(" + rotate + ")";
                }
                function dxForText(rotate) {
                    if (!rotate) {
                        return 0;
                    }
                    return 8 * Math.sin(Math.PI * (rotate / 180));
                }
                function yForText(rotate) {
                    if (!rotate) {
                        return tickLength;
                    }
                    return 11.5 - 2.5 * (rotate / 15) * (rotate > 0 ? 1 : -1);
                }

                switch (orient) {
                case "bottom":
                    {
                        tickTransform = axisX;
                        lineEnter.attr("y2", innerTickSize);
                        textEnter.attr("y", tickLength);
                        lineUpdate.attr("x1", tickX).attr("x2", tickX).attr("y2", tickSize);
                        textUpdate.attr("x", 0).attr("y", yForText(rotate))
                            .style("text-anchor", textAnchorForText(rotate))
                            .attr("transform", textTransform(rotate));
                        tspan.attr('x', 0).attr("dy", tspanDy).attr('dx', dxForText(rotate));
                        pathUpdate.attr("d", "M" + range[0] + "," + outerTickSize + "V0H" + range[1] + "V" + outerTickSize);
                        break;
                    }
                case "top":
                    {
                        // TODO: rotated tick text
                        tickTransform = axisX;
                        lineEnter.attr("y2", -innerTickSize);
                        textEnter.attr("y", -tickLength);
                        lineUpdate.attr("x2", 0).attr("y2", function (d) {
                            return -tickSize(d);
                        });
                        textUpdate.attr("x", 0).attr("y", -yForText(rotate))
                            .style("text-anchor", textAnchorForText(-rotate))
                            .attr("transform", textTransform(-rotate));
                        tspan.attr('x', 0).attr("dy", "0em" /* tspanDy */ ).attr('dx', dxForText(-rotate));
                        pathUpdate.attr("d", "M" + range[0] + "," + -outerTickSize + "V0H" + range[1] + "V" + -outerTickSize);
                        break;
                    }
                case "left":
                    {
                        tickTransform = axisY;
                        lineEnter.attr("x2", -innerTickSize);
                        textEnter.attr("x", -tickLength);
                        lineUpdate.attr("x2", -innerTickSize).attr("y1", tickY).attr("y2", tickY);
                        textUpdate.attr("x", -tickLength).attr("y", tickOffset)
                            .style("text-anchor", textAnchorForText(-rotate))
                            .style("text-anchor", "end")
                            .attr("transform", textTransform(-rotate));
                        tspan.attr('x', -tickLength).attr("dy", tspanDy);
                        pathUpdate.attr("d", "M" + -outerTickSize + "," + range[0] + "H0V" + range[1] + "H" + -outerTickSize);
                        break;
                    }
                case "right":
                    {
                        tickTransform = axisY;
                        lineEnter.attr("x2", innerTickSize);
                        textEnter.attr("x", tickLength);
                        lineUpdate.attr("x2", innerTickSize).attr("y2", 0);
                        textUpdate.attr("x", tickLength).attr("y", 0)
                            .style("text-anchor", textAnchorForText(rotate))
                            .style("text-anchor", "start")
                            .attr("transform", textTransform(rotate));
                        tspan.attr('x', tickLength).attr("dy", tspanDy);
                        pathUpdate.attr("d", "M" + outerTickSize + "," + range[0] + "H0V" + range[1] + "H" + outerTickSize);
                        break;
                    }
                }
                if (scale1.rangeBand) {
                    var x = scale1, 
                        dx = x.rangeBand() / 2;
                    scale0 = scale1 = function (d) {
                        return x(d) + dx;
                    };
                } else if (scale0.rangeBand) {
                    scale0 = scale1;
                } else {
                    tickExit.call(tickTransform, scale1);
                }
                tickEnter.call(tickTransform, scale0);
                tickUpdate.call(tickTransform, scale1);
            });
        }
        axis.scale = function (x) {
            if (!arguments.length) { 
                return scale; 
            }
            scale = x;
            return axis;
        };
        axis.orient = function (x) {
            if (!arguments.length) { 
                return orient; 
            }
            orient = x in {top: 1, right: 1, bottom: 1, left: 1} ? x + "" : "bottom";
            return axis;
        };
        axis.tickFormat = function (format) {
            if (!arguments.length) { 
                return tickFormat; 
            }
            tickFormat = format;
            return axis;
        };
        axis.tickCentered = function (isCentered) {
            if (!arguments.length) { 
                return tickCentered; 
            }
            tickCentered = isCentered;
            return axis;
        };
        axis.tickOffset = function () {
            return tickOffset;
        };
        axis.tickInterval = function () {
            var interval, length;
            if (params.isCategory) {
                interval = tickOffset * 2;
            }
            else {
                length = axis.g.select('path.domain').node().getTotalLength() - outerTickSize * 2;
                interval = length / axis.g.selectAll('line').size();
            }
            return interval === Infinity ? 0 : interval;
        };
        axis.ticks = function () {
            if (!arguments.length) { 
                return tickArguments; 
            }
            tickArguments = arguments;
            return axis;
        };
        axis.tickCulling = function (culling) {
            if (!arguments.length) { 
                return tickCulling; 
            }
            tickCulling = culling;
            return axis;
        };
        axis.tickValues = function (x) {
            if (typeof x === 'function') {
                tickValues = function () {
                    return x(scale.domain());
                };
            }
            else {
                if (!arguments.length) { 
                    return tickValues; 
                }
                tickValues = x;
            }
            return axis;
        };
        return axis;
    }

    c3_chart_internal_fn.isSafari = function C3_INTERNAL_isSafari() {
        var ua = window.navigator.userAgent;
        return ua.indexOf('Safari') >= 0 && ua.indexOf('Chrome') < 0;
    };
    c3_chart_internal_fn.isChrome = function C3_INTERNAL_isChrome() {
        var ua = window.navigator.userAgent;
        return ua.indexOf('Chrome') >= 0;
    };

    /* jshint ignore:start */

    // PhantomJS doesn't have support for Function.prototype.bind, which has caused confusion. Use
    // this polyfill to avoid the confusion.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind#Polyfill

    if (!Function.prototype.bind) {
      Function.prototype.bind = function(oThis) {
        if (typeof this !== 'function') {
          // closest thing possible to the ECMAScript 5
          // internal IsCallable function
          throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
        }

        var aArgs   = Array.prototype.slice.call(arguments, 1),
            fToBind = this,
            fNOP    = function() {},
            fBound  = function() {
              return fToBind.apply(this instanceof fNOP ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
            };

        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();

        return fBound;
      };
    }

    //SVGPathSeg API polyfill
    //https://github.com/progers/pathseg
    //
    //This is a drop-in replacement for the SVGPathSeg and SVGPathSegList APIs that were removed from
    //SVG2 (https://lists.w3.org/Archives/Public/www-svg/2015Jun/0044.html), including the latest spec
    //changes which were implemented in Firefox 43 and Chrome 46.
    //Chrome 48 removes these APIs, so this polyfill is required.

    (function() { "use strict";
     if (!("SVGPathSeg" in window)) {
         // Spec: http://www.w3.org/TR/SVG11/single-page.html#paths-InterfaceSVGPathSeg
         window.SVGPathSeg = function(type, typeAsLetter, owningPathSegList) {
             this.pathSegType = type;
             this.pathSegTypeAsLetter = typeAsLetter;
             this._owningPathSegList = owningPathSegList;
         }

         SVGPathSeg.PATHSEG_UNKNOWN = 0;
         SVGPathSeg.PATHSEG_CLOSEPATH = 1;
         SVGPathSeg.PATHSEG_MOVETO_ABS = 2;
         SVGPathSeg.PATHSEG_MOVETO_REL = 3;
         SVGPathSeg.PATHSEG_LINETO_ABS = 4;
         SVGPathSeg.PATHSEG_LINETO_REL = 5;
         SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS = 6;
         SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL = 7;
         SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS = 8;
         SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL = 9;
         SVGPathSeg.PATHSEG_ARC_ABS = 10;
         SVGPathSeg.PATHSEG_ARC_REL = 11;
         SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS = 12;
         SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL = 13;
         SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS = 14;
         SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL = 15;
         SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS = 16;
         SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL = 17;
         SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS = 18;
         SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL = 19;

         // Notify owning PathSegList on any changes so they can be synchronized back to the path element.
         SVGPathSeg.prototype._segmentChanged = function() {
             if (this._owningPathSegList)
                 this._owningPathSegList.segmentChanged(this);
         }

         window.SVGPathSegClosePath = function(owningPathSegList) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CLOSEPATH, "z", owningPathSegList);
         }
         SVGPathSegClosePath.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegClosePath.prototype.toString = function() { return "[object SVGPathSegClosePath]"; }
         SVGPathSegClosePath.prototype._asPathString = function() { return this.pathSegTypeAsLetter; }
         SVGPathSegClosePath.prototype.clone = function() { return new SVGPathSegClosePath(undefined); }

         window.SVGPathSegMovetoAbs = function(owningPathSegList, x, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_MOVETO_ABS, "M", owningPathSegList);
             this._x = x;
             this._y = y;
         }
         SVGPathSegMovetoAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegMovetoAbs.prototype.toString = function() { return "[object SVGPathSegMovetoAbs]"; }
         SVGPathSegMovetoAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x + " " + this._y; }
         SVGPathSegMovetoAbs.prototype.clone = function() { return new SVGPathSegMovetoAbs(undefined, this._x, this._y); }
         Object.defineProperty(SVGPathSegMovetoAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegMovetoAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegMovetoRel = function(owningPathSegList, x, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_MOVETO_REL, "m", owningPathSegList);
             this._x = x;
             this._y = y;
         }
         SVGPathSegMovetoRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegMovetoRel.prototype.toString = function() { return "[object SVGPathSegMovetoRel]"; }
         SVGPathSegMovetoRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x + " " + this._y; }
         SVGPathSegMovetoRel.prototype.clone = function() { return new SVGPathSegMovetoRel(undefined, this._x, this._y); }
         Object.defineProperty(SVGPathSegMovetoRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegMovetoRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegLinetoAbs = function(owningPathSegList, x, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_LINETO_ABS, "L", owningPathSegList);
             this._x = x;
             this._y = y;
         }
         SVGPathSegLinetoAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegLinetoAbs.prototype.toString = function() { return "[object SVGPathSegLinetoAbs]"; }
         SVGPathSegLinetoAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x + " " + this._y; }
         SVGPathSegLinetoAbs.prototype.clone = function() { return new SVGPathSegLinetoAbs(undefined, this._x, this._y); }
         Object.defineProperty(SVGPathSegLinetoAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegLinetoAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegLinetoRel = function(owningPathSegList, x, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_LINETO_REL, "l", owningPathSegList);
             this._x = x;
             this._y = y;
         }
         SVGPathSegLinetoRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegLinetoRel.prototype.toString = function() { return "[object SVGPathSegLinetoRel]"; }
         SVGPathSegLinetoRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x + " " + this._y; }
         SVGPathSegLinetoRel.prototype.clone = function() { return new SVGPathSegLinetoRel(undefined, this._x, this._y); }
         Object.defineProperty(SVGPathSegLinetoRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegLinetoRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoCubicAbs = function(owningPathSegList, x, y, x1, y1, x2, y2) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS, "C", owningPathSegList);
             this._x = x;
             this._y = y;
             this._x1 = x1;
             this._y1 = y1;
             this._x2 = x2;
             this._y2 = y2;
         }
         SVGPathSegCurvetoCubicAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoCubicAbs.prototype.toString = function() { return "[object SVGPathSegCurvetoCubicAbs]"; }
         SVGPathSegCurvetoCubicAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoCubicAbs.prototype.clone = function() { return new SVGPathSegCurvetoCubicAbs(undefined, this._x, this._y, this._x1, this._y1, this._x2, this._y2); }
         Object.defineProperty(SVGPathSegCurvetoCubicAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicAbs.prototype, "x1", { get: function() { return this._x1; }, set: function(x1) { this._x1 = x1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicAbs.prototype, "y1", { get: function() { return this._y1; }, set: function(y1) { this._y1 = y1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicAbs.prototype, "x2", { get: function() { return this._x2; }, set: function(x2) { this._x2 = x2; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicAbs.prototype, "y2", { get: function() { return this._y2; }, set: function(y2) { this._y2 = y2; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoCubicRel = function(owningPathSegList, x, y, x1, y1, x2, y2) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL, "c", owningPathSegList);
             this._x = x;
             this._y = y;
             this._x1 = x1;
             this._y1 = y1;
             this._x2 = x2;
             this._y2 = y2;
         }
         SVGPathSegCurvetoCubicRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoCubicRel.prototype.toString = function() { return "[object SVGPathSegCurvetoCubicRel]"; }
         SVGPathSegCurvetoCubicRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoCubicRel.prototype.clone = function() { return new SVGPathSegCurvetoCubicRel(undefined, this._x, this._y, this._x1, this._y1, this._x2, this._y2); }
         Object.defineProperty(SVGPathSegCurvetoCubicRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicRel.prototype, "x1", { get: function() { return this._x1; }, set: function(x1) { this._x1 = x1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicRel.prototype, "y1", { get: function() { return this._y1; }, set: function(y1) { this._y1 = y1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicRel.prototype, "x2", { get: function() { return this._x2; }, set: function(x2) { this._x2 = x2; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicRel.prototype, "y2", { get: function() { return this._y2; }, set: function(y2) { this._y2 = y2; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoQuadraticAbs = function(owningPathSegList, x, y, x1, y1) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS, "Q", owningPathSegList);
             this._x = x;
             this._y = y;
             this._x1 = x1;
             this._y1 = y1;
         }
         SVGPathSegCurvetoQuadraticAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoQuadraticAbs.prototype.toString = function() { return "[object SVGPathSegCurvetoQuadraticAbs]"; }
         SVGPathSegCurvetoQuadraticAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoQuadraticAbs.prototype.clone = function() { return new SVGPathSegCurvetoQuadraticAbs(undefined, this._x, this._y, this._x1, this._y1); }
         Object.defineProperty(SVGPathSegCurvetoQuadraticAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticAbs.prototype, "x1", { get: function() { return this._x1; }, set: function(x1) { this._x1 = x1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticAbs.prototype, "y1", { get: function() { return this._y1; }, set: function(y1) { this._y1 = y1; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoQuadraticRel = function(owningPathSegList, x, y, x1, y1) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL, "q", owningPathSegList);
             this._x = x;
             this._y = y;
             this._x1 = x1;
             this._y1 = y1;
         }
         SVGPathSegCurvetoQuadraticRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoQuadraticRel.prototype.toString = function() { return "[object SVGPathSegCurvetoQuadraticRel]"; }
         SVGPathSegCurvetoQuadraticRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x1 + " " + this._y1 + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoQuadraticRel.prototype.clone = function() { return new SVGPathSegCurvetoQuadraticRel(undefined, this._x, this._y, this._x1, this._y1); }
         Object.defineProperty(SVGPathSegCurvetoQuadraticRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticRel.prototype, "x1", { get: function() { return this._x1; }, set: function(x1) { this._x1 = x1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticRel.prototype, "y1", { get: function() { return this._y1; }, set: function(y1) { this._y1 = y1; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegArcAbs = function(owningPathSegList, x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_ARC_ABS, "A", owningPathSegList);
             this._x = x;
             this._y = y;
             this._r1 = r1;
             this._r2 = r2;
             this._angle = angle;
             this._largeArcFlag = largeArcFlag;
             this._sweepFlag = sweepFlag;
         }
         SVGPathSegArcAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegArcAbs.prototype.toString = function() { return "[object SVGPathSegArcAbs]"; }
         SVGPathSegArcAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._r1 + " " + this._r2 + " " + this._angle + " " + (this._largeArcFlag ? "1" : "0") + " " + (this._sweepFlag ? "1" : "0") + " " + this._x + " " + this._y; }
         SVGPathSegArcAbs.prototype.clone = function() { return new SVGPathSegArcAbs(undefined, this._x, this._y, this._r1, this._r2, this._angle, this._largeArcFlag, this._sweepFlag); }
         Object.defineProperty(SVGPathSegArcAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcAbs.prototype, "r1", { get: function() { return this._r1; }, set: function(r1) { this._r1 = r1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcAbs.prototype, "r2", { get: function() { return this._r2; }, set: function(r2) { this._r2 = r2; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcAbs.prototype, "angle", { get: function() { return this._angle; }, set: function(angle) { this._angle = angle; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcAbs.prototype, "largeArcFlag", { get: function() { return this._largeArcFlag; }, set: function(largeArcFlag) { this._largeArcFlag = largeArcFlag; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcAbs.prototype, "sweepFlag", { get: function() { return this._sweepFlag; }, set: function(sweepFlag) { this._sweepFlag = sweepFlag; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegArcRel = function(owningPathSegList, x, y, r1, r2, angle, largeArcFlag, sweepFlag) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_ARC_REL, "a", owningPathSegList);
             this._x = x;
             this._y = y;
             this._r1 = r1;
             this._r2 = r2;
             this._angle = angle;
             this._largeArcFlag = largeArcFlag;
             this._sweepFlag = sweepFlag;
         }
         SVGPathSegArcRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegArcRel.prototype.toString = function() { return "[object SVGPathSegArcRel]"; }
         SVGPathSegArcRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._r1 + " " + this._r2 + " " + this._angle + " " + (this._largeArcFlag ? "1" : "0") + " " + (this._sweepFlag ? "1" : "0") + " " + this._x + " " + this._y; }
         SVGPathSegArcRel.prototype.clone = function() { return new SVGPathSegArcRel(undefined, this._x, this._y, this._r1, this._r2, this._angle, this._largeArcFlag, this._sweepFlag); }
         Object.defineProperty(SVGPathSegArcRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcRel.prototype, "r1", { get: function() { return this._r1; }, set: function(r1) { this._r1 = r1; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcRel.prototype, "r2", { get: function() { return this._r2; }, set: function(r2) { this._r2 = r2; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcRel.prototype, "angle", { get: function() { return this._angle; }, set: function(angle) { this._angle = angle; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcRel.prototype, "largeArcFlag", { get: function() { return this._largeArcFlag; }, set: function(largeArcFlag) { this._largeArcFlag = largeArcFlag; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegArcRel.prototype, "sweepFlag", { get: function() { return this._sweepFlag; }, set: function(sweepFlag) { this._sweepFlag = sweepFlag; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegLinetoHorizontalAbs = function(owningPathSegList, x) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS, "H", owningPathSegList);
             this._x = x;
         }
         SVGPathSegLinetoHorizontalAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegLinetoHorizontalAbs.prototype.toString = function() { return "[object SVGPathSegLinetoHorizontalAbs]"; }
         SVGPathSegLinetoHorizontalAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x; }
         SVGPathSegLinetoHorizontalAbs.prototype.clone = function() { return new SVGPathSegLinetoHorizontalAbs(undefined, this._x); }
         Object.defineProperty(SVGPathSegLinetoHorizontalAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegLinetoHorizontalRel = function(owningPathSegList, x) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL, "h", owningPathSegList);
             this._x = x;
         }
         SVGPathSegLinetoHorizontalRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegLinetoHorizontalRel.prototype.toString = function() { return "[object SVGPathSegLinetoHorizontalRel]"; }
         SVGPathSegLinetoHorizontalRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x; }
         SVGPathSegLinetoHorizontalRel.prototype.clone = function() { return new SVGPathSegLinetoHorizontalRel(undefined, this._x); }
         Object.defineProperty(SVGPathSegLinetoHorizontalRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegLinetoVerticalAbs = function(owningPathSegList, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS, "V", owningPathSegList);
             this._y = y;
         }
         SVGPathSegLinetoVerticalAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegLinetoVerticalAbs.prototype.toString = function() { return "[object SVGPathSegLinetoVerticalAbs]"; }
         SVGPathSegLinetoVerticalAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._y; }
         SVGPathSegLinetoVerticalAbs.prototype.clone = function() { return new SVGPathSegLinetoVerticalAbs(undefined, this._y); }
         Object.defineProperty(SVGPathSegLinetoVerticalAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegLinetoVerticalRel = function(owningPathSegList, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL, "v", owningPathSegList);
             this._y = y;
         }
         SVGPathSegLinetoVerticalRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegLinetoVerticalRel.prototype.toString = function() { return "[object SVGPathSegLinetoVerticalRel]"; }
         SVGPathSegLinetoVerticalRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._y; }
         SVGPathSegLinetoVerticalRel.prototype.clone = function() { return new SVGPathSegLinetoVerticalRel(undefined, this._y); }
         Object.defineProperty(SVGPathSegLinetoVerticalRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoCubicSmoothAbs = function(owningPathSegList, x, y, x2, y2) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS, "S", owningPathSegList);
             this._x = x;
             this._y = y;
             this._x2 = x2;
             this._y2 = y2;
         }
         SVGPathSegCurvetoCubicSmoothAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoCubicSmoothAbs.prototype.toString = function() { return "[object SVGPathSegCurvetoCubicSmoothAbs]"; }
         SVGPathSegCurvetoCubicSmoothAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoCubicSmoothAbs.prototype.clone = function() { return new SVGPathSegCurvetoCubicSmoothAbs(undefined, this._x, this._y, this._x2, this._y2); }
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothAbs.prototype, "x2", { get: function() { return this._x2; }, set: function(x2) { this._x2 = x2; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothAbs.prototype, "y2", { get: function() { return this._y2; }, set: function(y2) { this._y2 = y2; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoCubicSmoothRel = function(owningPathSegList, x, y, x2, y2) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL, "s", owningPathSegList);
             this._x = x;
             this._y = y;
             this._x2 = x2;
             this._y2 = y2;
         }
         SVGPathSegCurvetoCubicSmoothRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoCubicSmoothRel.prototype.toString = function() { return "[object SVGPathSegCurvetoCubicSmoothRel]"; }
         SVGPathSegCurvetoCubicSmoothRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x2 + " " + this._y2 + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoCubicSmoothRel.prototype.clone = function() { return new SVGPathSegCurvetoCubicSmoothRel(undefined, this._x, this._y, this._x2, this._y2); }
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothRel.prototype, "x2", { get: function() { return this._x2; }, set: function(x2) { this._x2 = x2; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoCubicSmoothRel.prototype, "y2", { get: function() { return this._y2; }, set: function(y2) { this._y2 = y2; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoQuadraticSmoothAbs = function(owningPathSegList, x, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS, "T", owningPathSegList);
             this._x = x;
             this._y = y;
         }
         SVGPathSegCurvetoQuadraticSmoothAbs.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoQuadraticSmoothAbs.prototype.toString = function() { return "[object SVGPathSegCurvetoQuadraticSmoothAbs]"; }
         SVGPathSegCurvetoQuadraticSmoothAbs.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoQuadraticSmoothAbs.prototype.clone = function() { return new SVGPathSegCurvetoQuadraticSmoothAbs(undefined, this._x, this._y); }
         Object.defineProperty(SVGPathSegCurvetoQuadraticSmoothAbs.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticSmoothAbs.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         window.SVGPathSegCurvetoQuadraticSmoothRel = function(owningPathSegList, x, y) {
             SVGPathSeg.call(this, SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL, "t", owningPathSegList);
             this._x = x;
             this._y = y;
         }
         SVGPathSegCurvetoQuadraticSmoothRel.prototype = Object.create(SVGPathSeg.prototype);
         SVGPathSegCurvetoQuadraticSmoothRel.prototype.toString = function() { return "[object SVGPathSegCurvetoQuadraticSmoothRel]"; }
         SVGPathSegCurvetoQuadraticSmoothRel.prototype._asPathString = function() { return this.pathSegTypeAsLetter + " " + this._x + " " + this._y; }
         SVGPathSegCurvetoQuadraticSmoothRel.prototype.clone = function() { return new SVGPathSegCurvetoQuadraticSmoothRel(undefined, this._x, this._y); }
         Object.defineProperty(SVGPathSegCurvetoQuadraticSmoothRel.prototype, "x", { get: function() { return this._x; }, set: function(x) { this._x = x; this._segmentChanged(); }, enumerable: true });
         Object.defineProperty(SVGPathSegCurvetoQuadraticSmoothRel.prototype, "y", { get: function() { return this._y; }, set: function(y) { this._y = y; this._segmentChanged(); }, enumerable: true });

         // Add createSVGPathSeg* functions to SVGPathElement.
         // Spec: http://www.w3.org/TR/SVG11/single-page.html#paths-InterfaceSVGPathElement.
         SVGPathElement.prototype.createSVGPathSegClosePath = function() { return new SVGPathSegClosePath(undefined); }
         SVGPathElement.prototype.createSVGPathSegMovetoAbs = function(x, y) { return new SVGPathSegMovetoAbs(undefined, x, y); }
         SVGPathElement.prototype.createSVGPathSegMovetoRel = function(x, y) { return new SVGPathSegMovetoRel(undefined, x, y); }
         SVGPathElement.prototype.createSVGPathSegLinetoAbs = function(x, y) { return new SVGPathSegLinetoAbs(undefined, x, y); }
         SVGPathElement.prototype.createSVGPathSegLinetoRel = function(x, y) { return new SVGPathSegLinetoRel(undefined, x, y); }
         SVGPathElement.prototype.createSVGPathSegCurvetoCubicAbs = function(x, y, x1, y1, x2, y2) { return new SVGPathSegCurvetoCubicAbs(undefined, x, y, x1, y1, x2, y2); }
         SVGPathElement.prototype.createSVGPathSegCurvetoCubicRel = function(x, y, x1, y1, x2, y2) { return new SVGPathSegCurvetoCubicRel(undefined, x, y, x1, y1, x2, y2); }
         SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticAbs = function(x, y, x1, y1) { return new SVGPathSegCurvetoQuadraticAbs(undefined, x, y, x1, y1); }
         SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticRel = function(x, y, x1, y1) { return new SVGPathSegCurvetoQuadraticRel(undefined, x, y, x1, y1); }
         SVGPathElement.prototype.createSVGPathSegArcAbs = function(x, y, r1, r2, angle, largeArcFlag, sweepFlag) { return new SVGPathSegArcAbs(undefined, x, y, r1, r2, angle, largeArcFlag, sweepFlag); }
         SVGPathElement.prototype.createSVGPathSegArcRel = function(x, y, r1, r2, angle, largeArcFlag, sweepFlag) { return new SVGPathSegArcRel(undefined, x, y, r1, r2, angle, largeArcFlag, sweepFlag); }
         SVGPathElement.prototype.createSVGPathSegLinetoHorizontalAbs = function(x) { return new SVGPathSegLinetoHorizontalAbs(undefined, x); }
         SVGPathElement.prototype.createSVGPathSegLinetoHorizontalRel = function(x) { return new SVGPathSegLinetoHorizontalRel(undefined, x); }
         SVGPathElement.prototype.createSVGPathSegLinetoVerticalAbs = function(y) { return new SVGPathSegLinetoVerticalAbs(undefined, y); }
         SVGPathElement.prototype.createSVGPathSegLinetoVerticalRel = function(y) { return new SVGPathSegLinetoVerticalRel(undefined, y); }
         SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothAbs = function(x, y, x2, y2) { return new SVGPathSegCurvetoCubicSmoothAbs(undefined, x, y, x2, y2); }
         SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothRel = function(x, y, x2, y2) { return new SVGPathSegCurvetoCubicSmoothRel(undefined, x, y, x2, y2); }
         SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothAbs = function(x, y) { return new SVGPathSegCurvetoQuadraticSmoothAbs(undefined, x, y); }
         SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothRel = function(x, y) { return new SVGPathSegCurvetoQuadraticSmoothRel(undefined, x, y); }
     }

     if (!("SVGPathSegList" in window)) {
         // Spec: http://www.w3.org/TR/SVG11/single-page.html#paths-InterfaceSVGPathSegList
         window.SVGPathSegList = function(pathElement) {
             this._pathElement = pathElement;
             this._list = this._parsePath(this._pathElement.getAttribute("d"));

             // Use a MutationObserver to catch changes to the path's "d" attribute.
             this._mutationObserverConfig = { "attributes": true, "attributeFilter": ["d"] };
             this._pathElementMutationObserver = new MutationObserver(this._updateListFromPathMutations.bind(this));
             this._pathElementMutationObserver.observe(this._pathElement, this._mutationObserverConfig);
         }

         Object.defineProperty(SVGPathSegList.prototype, "numberOfItems", {
             get: function() {
                 this._checkPathSynchronizedToList();
                 return this._list.length;
             },
             enumerable: true
         });

         // Add the pathSegList accessors to SVGPathElement.
         // Spec: http://www.w3.org/TR/SVG11/single-page.html#paths-InterfaceSVGAnimatedPathData
         Object.defineProperty(SVGPathElement.prototype, "pathSegList", {
             get: function() {
                 if (!this._pathSegList)
                     this._pathSegList = new SVGPathSegList(this);
                 return this._pathSegList;
             },
             enumerable: true
         });
         // FIXME: The following are not implemented and simply return SVGPathElement.pathSegList.
         Object.defineProperty(SVGPathElement.prototype, "normalizedPathSegList", { get: function() { return this.pathSegList; }, enumerable: true });
         Object.defineProperty(SVGPathElement.prototype, "animatedPathSegList", { get: function() { return this.pathSegList; }, enumerable: true });
         Object.defineProperty(SVGPathElement.prototype, "animatedNormalizedPathSegList", { get: function() { return this.pathSegList; }, enumerable: true });

         // Process any pending mutations to the path element and update the list as needed.
         // This should be the first call of all public functions and is needed because
         // MutationObservers are not synchronous so we can have pending asynchronous mutations.
         SVGPathSegList.prototype._checkPathSynchronizedToList = function() {
             this._updateListFromPathMutations(this._pathElementMutationObserver.takeRecords());
         }

         SVGPathSegList.prototype._updateListFromPathMutations = function(mutationRecords) {
             if (!this._pathElement)
                 return;
             var hasPathMutations = false;
             mutationRecords.forEach(function(record) {
                 if (record.attributeName == "d")
                     hasPathMutations = true;
             });
             if (hasPathMutations)
                 this._list = this._parsePath(this._pathElement.getAttribute("d"));
         }

         // Serialize the list and update the path's 'd' attribute.
         SVGPathSegList.prototype._writeListToPath = function() {
             this._pathElementMutationObserver.disconnect();
             this._pathElement.setAttribute("d", SVGPathSegList._pathSegArrayAsString(this._list));
             this._pathElementMutationObserver.observe(this._pathElement, this._mutationObserverConfig);
         }

         // When a path segment changes the list needs to be synchronized back to the path element.
         SVGPathSegList.prototype.segmentChanged = function(pathSeg) {
             this._writeListToPath();
         }

         SVGPathSegList.prototype.clear = function() {
             this._checkPathSynchronizedToList();

             this._list.forEach(function(pathSeg) {
                 pathSeg._owningPathSegList = null;
             });
             this._list = [];
             this._writeListToPath();
         }

         SVGPathSegList.prototype.initialize = function(newItem) {
             this._checkPathSynchronizedToList();

             this._list = [newItem];
             newItem._owningPathSegList = this;
             this._writeListToPath();
             return newItem;
         }

         SVGPathSegList.prototype._checkValidIndex = function(index) {
             if (isNaN(index) || index < 0 || index >= this.numberOfItems)
                 throw "INDEX_SIZE_ERR";
         }

         SVGPathSegList.prototype.getItem = function(index) {
             this._checkPathSynchronizedToList();

             this._checkValidIndex(index);
             return this._list[index];
         }

         SVGPathSegList.prototype.insertItemBefore = function(newItem, index) {
             this._checkPathSynchronizedToList();

             // Spec: If the index is greater than or equal to numberOfItems, then the new item is appended to the end of the list.
             if (index > this.numberOfItems)
                 index = this.numberOfItems;
             if (newItem._owningPathSegList) {
                 // SVG2 spec says to make a copy.
                 newItem = newItem.clone();
             }
             this._list.splice(index, 0, newItem);
             newItem._owningPathSegList = this;
             this._writeListToPath();
             return newItem;
         }

         SVGPathSegList.prototype.replaceItem = function(newItem, index) {
             this._checkPathSynchronizedToList();

             if (newItem._owningPathSegList) {
                 // SVG2 spec says to make a copy.
                 newItem = newItem.clone();
             }
             this._checkValidIndex(index);
             this._list[index] = newItem;
             newItem._owningPathSegList = this;
             this._writeListToPath();
             return newItem;
         }

         SVGPathSegList.prototype.removeItem = function(index) {
             this._checkPathSynchronizedToList();

             this._checkValidIndex(index);
             var item = this._list[index];
             this._list.splice(index, 1);
             this._writeListToPath();
             return item;
         }

         SVGPathSegList.prototype.appendItem = function(newItem) {
             this._checkPathSynchronizedToList();

             if (newItem._owningPathSegList) {
                 // SVG2 spec says to make a copy.
                 newItem = newItem.clone();
             }
             this._list.push(newItem);
             newItem._owningPathSegList = this;
             // TODO: Optimize this to just append to the existing attribute.
             this._writeListToPath();
             return newItem;
         }

         SVGPathSegList._pathSegArrayAsString = function(pathSegArray) {
             var string = "";
             var first = true;
             pathSegArray.forEach(function(pathSeg) {
                 if (first) {
                     first = false;
                     string += pathSeg._asPathString();
                 } else {
                     string += " " + pathSeg._asPathString();
                 }
             });
             return string;
         }

         // This closely follows SVGPathParser::parsePath from Source/core/svg/SVGPathParser.cpp.
         SVGPathSegList.prototype._parsePath = function(string) {
             if (!string || string.length == 0)
                 return [];

             var owningPathSegList = this;

             var Builder = function() {
                 this.pathSegList = [];
             }

             Builder.prototype.appendSegment = function(pathSeg) {
                 this.pathSegList.push(pathSeg);
             }

             var Source = function(string) {
                 this._string = string;
                 this._currentIndex = 0;
                 this._endIndex = this._string.length;
                 this._previousCommand = SVGPathSeg.PATHSEG_UNKNOWN;

                 this._skipOptionalSpaces();
             }

             Source.prototype._isCurrentSpace = function() {
                 var character = this._string[this._currentIndex];
                 return character <= " " && (character == " " || character == "\n" || character == "\t" || character == "\r" || character == "\f");
             }

             Source.prototype._skipOptionalSpaces = function() {
                 while (this._currentIndex < this._endIndex && this._isCurrentSpace())
                     this._currentIndex++;
                 return this._currentIndex < this._endIndex;
             }

             Source.prototype._skipOptionalSpacesOrDelimiter = function() {
                 if (this._currentIndex < this._endIndex && !this._isCurrentSpace() && this._string.charAt(this._currentIndex) != ",")
                     return false;
                 if (this._skipOptionalSpaces()) {
                     if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == ",") {
                         this._currentIndex++;
                         this._skipOptionalSpaces();
                     }
                 }
                 return this._currentIndex < this._endIndex;
             }

             Source.prototype.hasMoreData = function() {
                 return this._currentIndex < this._endIndex;
             }

             Source.prototype.peekSegmentType = function() {
                 var lookahead = this._string[this._currentIndex];
                 return this._pathSegTypeFromChar(lookahead);
             }

             Source.prototype._pathSegTypeFromChar = function(lookahead) {
                 switch (lookahead) {
                 case "Z":
                 case "z":
                     return SVGPathSeg.PATHSEG_CLOSEPATH;
                 case "M":
                     return SVGPathSeg.PATHSEG_MOVETO_ABS;
                 case "m":
                     return SVGPathSeg.PATHSEG_MOVETO_REL;
                 case "L":
                     return SVGPathSeg.PATHSEG_LINETO_ABS;
                 case "l":
                     return SVGPathSeg.PATHSEG_LINETO_REL;
                 case "C":
                     return SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS;
                 case "c":
                     return SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL;
                 case "Q":
                     return SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS;
                 case "q":
                     return SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL;
                 case "A":
                     return SVGPathSeg.PATHSEG_ARC_ABS;
                 case "a":
                     return SVGPathSeg.PATHSEG_ARC_REL;
                 case "H":
                     return SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS;
                 case "h":
                     return SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL;
                 case "V":
                     return SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS;
                 case "v":
                     return SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL;
                 case "S":
                     return SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS;
                 case "s":
                     return SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL;
                 case "T":
                     return SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS;
                 case "t":
                     return SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL;
                 default:
                     return SVGPathSeg.PATHSEG_UNKNOWN;
                 }
             }

             Source.prototype._nextCommandHelper = function(lookahead, previousCommand) {
                 // Check for remaining coordinates in the current command.
                 if ((lookahead == "+" || lookahead == "-" || lookahead == "." || (lookahead >= "0" && lookahead <= "9")) && previousCommand != SVGPathSeg.PATHSEG_CLOSEPATH) {
                     if (previousCommand == SVGPathSeg.PATHSEG_MOVETO_ABS)
                         return SVGPathSeg.PATHSEG_LINETO_ABS;
                     if (previousCommand == SVGPathSeg.PATHSEG_MOVETO_REL)
                         return SVGPathSeg.PATHSEG_LINETO_REL;
                     return previousCommand;
                 }
                 return SVGPathSeg.PATHSEG_UNKNOWN;
             }

             Source.prototype.initialCommandIsMoveTo = function() {
                 // If the path is empty it is still valid, so return true.
                 if (!this.hasMoreData())
                     return true;
                 var command = this.peekSegmentType();
                 // Path must start with moveTo.
                 return command == SVGPathSeg.PATHSEG_MOVETO_ABS || command == SVGPathSeg.PATHSEG_MOVETO_REL;
             }

             // Parse a number from an SVG path. This very closely follows genericParseNumber(...) from Source/core/svg/SVGParserUtilities.cpp.
             // Spec: http://www.w3.org/TR/SVG11/single-page.html#paths-PathDataBNF
             Source.prototype._parseNumber = function() {
                 var exponent = 0;
                 var integer = 0;
                 var frac = 1;
                 var decimal = 0;
                 var sign = 1;
                 var expsign = 1;

                 var startIndex = this._currentIndex;

                 this._skipOptionalSpaces();

                 // Read the sign.
                 if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == "+")
                     this._currentIndex++;
                 else if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == "-") {
                     this._currentIndex++;
                     sign = -1;
                 }

                 if (this._currentIndex == this._endIndex || ((this._string.charAt(this._currentIndex) < "0" || this._string.charAt(this._currentIndex) > "9") && this._string.charAt(this._currentIndex) != "."))
                     // The first character of a number must be one of [0-9+-.].
                     return undefined;

                 // Read the integer part, build right-to-left.
                 var startIntPartIndex = this._currentIndex;
                 while (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) >= "0" && this._string.charAt(this._currentIndex) <= "9")
                     this._currentIndex++; // Advance to first non-digit.

                 if (this._currentIndex != startIntPartIndex) {
                     var scanIntPartIndex = this._currentIndex - 1;
                     var multiplier = 1;
                     while (scanIntPartIndex >= startIntPartIndex) {
                         integer += multiplier * (this._string.charAt(scanIntPartIndex--) - "0");
                         multiplier *= 10;
                     }
                 }

                 // Read the decimals.
                 if (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) == ".") {
                     this._currentIndex++;

                     // There must be a least one digit following the .
                     if (this._currentIndex >= this._endIndex || this._string.charAt(this._currentIndex) < "0" || this._string.charAt(this._currentIndex) > "9")
                         return undefined;
                     while (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) >= "0" && this._string.charAt(this._currentIndex) <= "9")
                         decimal += (this._string.charAt(this._currentIndex++) - "0") * (frac *= 0.1);
                 }

                 // Read the exponent part.
                 if (this._currentIndex != startIndex && this._currentIndex + 1 < this._endIndex && (this._string.charAt(this._currentIndex) == "e" || this._string.charAt(this._currentIndex) == "E") && (this._string.charAt(this._currentIndex + 1) != "x" && this._string.charAt(this._currentIndex + 1) != "m")) {
                     this._currentIndex++;

                     // Read the sign of the exponent.
                     if (this._string.charAt(this._currentIndex) == "+") {
                         this._currentIndex++;
                     } else if (this._string.charAt(this._currentIndex) == "-") {
                         this._currentIndex++;
                         expsign = -1;
                     }

                     // There must be an exponent.
                     if (this._currentIndex >= this._endIndex || this._string.charAt(this._currentIndex) < "0" || this._string.charAt(this._currentIndex) > "9")
                         return undefined;

                     while (this._currentIndex < this._endIndex && this._string.charAt(this._currentIndex) >= "0" && this._string.charAt(this._currentIndex) <= "9") {
                         exponent *= 10;
                         exponent += (this._string.charAt(this._currentIndex) - "0");
                         this._currentIndex++;
                     }
                 }

                 var number = integer + decimal;
                 number *= sign;

                 if (exponent)
                     number *= Math.pow(10, expsign * exponent);

                 if (startIndex == this._currentIndex)
                     return undefined;

                 this._skipOptionalSpacesOrDelimiter();

                 return number;
             }

             Source.prototype._parseArcFlag = function() {
                 if (this._currentIndex >= this._endIndex)
                     return undefined;
                 var flag = false;
                 var flagChar = this._string.charAt(this._currentIndex++);
                 if (flagChar == "0")
                     flag = false;
                 else if (flagChar == "1")
                     flag = true;
                 else
                     return undefined;

                 this._skipOptionalSpacesOrDelimiter();
                 return flag;
             }

             Source.prototype.parseSegment = function() {
                 var lookahead = this._string[this._currentIndex];
                 var command = this._pathSegTypeFromChar(lookahead);
                 if (command == SVGPathSeg.PATHSEG_UNKNOWN) {
                     // Possibly an implicit command. Not allowed if this is the first command.
                     if (this._previousCommand == SVGPathSeg.PATHSEG_UNKNOWN)
                         return null;
                     command = this._nextCommandHelper(lookahead, this._previousCommand);
                     if (command == SVGPathSeg.PATHSEG_UNKNOWN)
                         return null;
                 } else {
                     this._currentIndex++;
                 }

                 this._previousCommand = command;

                 switch (command) {
                 case SVGPathSeg.PATHSEG_MOVETO_REL:
                     return new SVGPathSegMovetoRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                 case SVGPathSeg.PATHSEG_MOVETO_ABS:
                     return new SVGPathSegMovetoAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                 case SVGPathSeg.PATHSEG_LINETO_REL:
                     return new SVGPathSegLinetoRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                 case SVGPathSeg.PATHSEG_LINETO_ABS:
                     return new SVGPathSegLinetoAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                 case SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL:
                     return new SVGPathSegLinetoHorizontalRel(owningPathSegList, this._parseNumber());
                 case SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS:
                     return new SVGPathSegLinetoHorizontalAbs(owningPathSegList, this._parseNumber());
                 case SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL:
                     return new SVGPathSegLinetoVerticalRel(owningPathSegList, this._parseNumber());
                 case SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS:
                     return new SVGPathSegLinetoVerticalAbs(owningPathSegList, this._parseNumber());
                 case SVGPathSeg.PATHSEG_CLOSEPATH:
                     this._skipOptionalSpaces();
                     return new SVGPathSegClosePath(owningPathSegList);
                 case SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL:
                     var points = {x1: this._parseNumber(), y1: this._parseNumber(), x2: this._parseNumber(), y2: this._parseNumber(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegCurvetoCubicRel(owningPathSegList, points.x, points.y, points.x1, points.y1, points.x2, points.y2);
                 case SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS:
                     var points = {x1: this._parseNumber(), y1: this._parseNumber(), x2: this._parseNumber(), y2: this._parseNumber(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegCurvetoCubicAbs(owningPathSegList, points.x, points.y, points.x1, points.y1, points.x2, points.y2);
                 case SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL:
                     var points = {x2: this._parseNumber(), y2: this._parseNumber(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegCurvetoCubicSmoothRel(owningPathSegList, points.x, points.y, points.x2, points.y2);
                 case SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS:
                     var points = {x2: this._parseNumber(), y2: this._parseNumber(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegCurvetoCubicSmoothAbs(owningPathSegList, points.x, points.y, points.x2, points.y2);
                 case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL:
                     var points = {x1: this._parseNumber(), y1: this._parseNumber(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegCurvetoQuadraticRel(owningPathSegList, points.x, points.y, points.x1, points.y1);
                 case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS:
                     var points = {x1: this._parseNumber(), y1: this._parseNumber(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegCurvetoQuadraticAbs(owningPathSegList, points.x, points.y, points.x1, points.y1);
                 case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL:
                     return new SVGPathSegCurvetoQuadraticSmoothRel(owningPathSegList, this._parseNumber(), this._parseNumber());
                 case SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS:
                     return new SVGPathSegCurvetoQuadraticSmoothAbs(owningPathSegList, this._parseNumber(), this._parseNumber());
                 case SVGPathSeg.PATHSEG_ARC_REL:
                     var points = {x1: this._parseNumber(), y1: this._parseNumber(), arcAngle: this._parseNumber(), arcLarge: this._parseArcFlag(), arcSweep: this._parseArcFlag(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegArcRel(owningPathSegList, points.x, points.y, points.x1, points.y1, points.arcAngle, points.arcLarge, points.arcSweep);
                 case SVGPathSeg.PATHSEG_ARC_ABS:
                     var points = {x1: this._parseNumber(), y1: this._parseNumber(), arcAngle: this._parseNumber(), arcLarge: this._parseArcFlag(), arcSweep: this._parseArcFlag(), x: this._parseNumber(), y: this._parseNumber()};
                     return new SVGPathSegArcAbs(owningPathSegList, points.x, points.y, points.x1, points.y1, points.arcAngle, points.arcLarge, points.arcSweep);
                 default:
                     throw "Unknown path seg type."
                 }
             }

             var builder = new Builder();
             var source = new Source(string);

             if (!source.initialCommandIsMoveTo())
                 return [];
             while (source.hasMoreData()) {
                 var pathSeg = source.parseSegment();
                 if (!pathSeg)
                     return [];
                 builder.appendSegment(pathSeg);
             }

             return builder.pathSegList;
         }
     }
    }());

    /* jshint ignore:end */

    if (typeof define === 'function' && define.amd) {
        define("c3", ["d3"], function () { return c3; });
    } else if ('undefined' !== typeof exports && 'undefined' !== typeof module) {
        module.exports = c3;
    } else {
        window.c3 = c3;
    }

})(window);
