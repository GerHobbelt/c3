c3_chart_internal_fn.initText = function () {
    var $$ = this;
    $$.main.select('.' + CLASS.chart).append("g")
        .attr("class", CLASS.chartTexts);
    $$.mainText = $$.d3.selectAll([]);
};
c3_chart_internal_fn.updateTargetsForText = function (targets) {
    var $$ = this, mainTextUpdate, mainTextEnter,
        classChartText = $$.classChartText.bind($$),
        classTexts = $$.classTexts.bind($$),
        classFocus = $$.classFocus.bind($$);
    mainTextUpdate = $$.main.select('.' + CLASS.chartTexts).selectAll('.' + CLASS.chartText)
        .data(targets)
        .attr('class', function (d) { return classChartText(d) + classFocus(d); });
    mainTextEnter = mainTextUpdate.enter().append('g')
        .attr('class', classChartText)
        .style('opacity', 0)
        .style("pointer-events", "none");
    mainTextEnter.append('g')
        .attr('class', classTexts);
};
c3_chart_internal_fn.getLabelColor = function (d) {
    if (this.config.data_labels && this.config.data_labels.color) {
        return this.config.data_labels.color;
    }
    if (this.config.axis_rotated &&
        ((d.anchor === 'start' && d.value < 0) || (d.anchor === 'end' && d.value > 0))) {
        return 'white';
    }
    return this.color(d);
};
c3_chart_internal_fn.redrawText = function (durationForExit, barIndices) {
    var $$ = this,
        config = $$.config,
        barOrLineData = $$.barOrLineData.bind($$),
        threshold = (config.data_labels && config.data_labels.threshold) || 0,
        drawText = $$.generateDrawBarText(barIndices, threshold),
        classText = $$.classText.bind($$);

    $$.mainText = $$.main.selectAll('.' + CLASS.texts).selectAll('.' + CLASS.text)
        .data(barOrLineData);
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
        .style("fill", function (d) { return $$.getLabelColor(d); })
        .style("fill-opacity", 0);
    $$.mainText
        .text(drawText);
    $$.mainText.exit()
        .transition().duration(durationForExit)
        .style('fill-opacity', 0)
        .remove();
};
c3_chart_internal_fn.generateDrawBarText = function (barIndices, threshold) {
    var $$ = this,
        getPoints = $$.generateGetBarPoints(barIndices, false);

    return function (d, i) {
        // 4 points that make a bar
        var points = getPoints(d, i);
        var width = Math.abs(points[0][1] - points[1][1]);
        var text = '';
        if (width > threshold) {
            text = $$.formatByAxisId($$.getAxisId(d.id))(d.value, d.id, i);
        }
        return text;
    };
};

c3_chart_internal_fn.addTransitionForText = function (transitions, xForText, yForText, forFlow) {
    var $$ = this,
        config = $$.config,
        opacityForText = forFlow ? 0 : $$.opacityForText.bind($$);

    transitions.push($$.mainText.transition()
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
        .style("fill", function (d) { return $$.getLabelColor(d); })
        .style("fill-opacity", opacityForText));
};
c3_chart_internal_fn.getTextRect = function (text, cls) {
    var svg = this.d3.select('body').append("svg").style('visibility', 'hidden'), rect;
    svg.selectAll('.dummy')
        .data([text])
      .enter().append('text')
        .classed(cls ? cls : "", true)
        .text(text)
      .each(function () { rect = this.getBoundingClientRect(); });
    svg.remove();
    return rect;
};
c3_chart_internal_fn.generateXYForText = function (areaIndices, barIndices, lineIndices, forX) {
    var $$ = this,
        getAreaPoints = $$.generateGetAreaPoints(barIndices, false),
        getBarPoints = $$.generateGetBarPoints(barIndices, false),
        getLinePoints = $$.generateGetLinePoints(lineIndices, false),
        getter = forX ? $$.getXForText : $$.getYForText;
    return function (d, i) {
        var getPoints = $$.isAreaType(d) ? getAreaPoints : $$.isBarType(d) ? getBarPoints : getLinePoints;
        return getter.call($$, getPoints(d, i), d, this);
    };
};
c3_chart_internal_fn.getXForText = function (points, d, textElement) {
    var $$ = this,
        box = textElement.getBoundingClientRect(), xPos, padding;
    if ($$.config.axis_rotated) {
        padding = $$.isBarType(d) ? 4 : 6;
        xPos = points[2][1] + padding * (d.value < 0 ? -1 : 1);
    } else {
        xPos = $$.hasType('bar') ? (points[2][0] + points[0][0]) / 2 : points[0][0];
    }
    return d.value !== null ? xPos : xPos > $$.width ? $$.width - box.width : xPos;
};
c3_chart_internal_fn.getYForText = function (points, d, textElement) {
    var $$ = this,
        box = textElement.getBoundingClientRect(), yPos;
    if ($$.config.axis_rotated) {
        yPos = (points[0][0] + points[2][0] + box.height * 0.6) / 2;
    } else {
        yPos = points[2][1] + (d.value < 0 ? box.height : $$.isBarType(d) ? -3 : -6);
    }
    return d.value !== null ? yPos : yPos < box.height ? box.height : yPos;
};
