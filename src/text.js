c3_chart_internal_fn.initText = function C3_INTERNAL_initText() {
    var $$ = this;
    $$.main.select('.' + CLASS.chart).append('g')
        .attr('class', CLASS.chartTexts);
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
        .style('pointer-events', 'none');
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
        .attr('class', classText)
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
        .style('stroke', 'none')
        .style('fill', function (d) { 
            return $$.getLabelColor(d); 
        })
        .style('fill-opacity', 0);
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
            .style('fill', function (d) { 
                return $$.getLabelColor(d); 
            })
            .style('fill-opacity', opacityForText)
    ];
};
c3_chart_internal_fn.getTextRect = function C3_INTERNAL_getTextRect(element, cls) {
    var dummy = this.d3.select('body').append('div').classed('c3', true),
        svg = dummy.append('svg').style('visibility', 'hidden').style('position', 'fixed').style('top', 0).style('left', 0),
        text = element.textContent,
        font = this.d3.select(element).style('font'),
        rect,
        count = 0;
    svg.selectAll('.dummy')
        .data([text])
      .enter().append('text')
        .classed(cls ? cls : '', true)
        .style('font', font)
        .text(text)
      .each(function () {
        count++; 
        rect = this.getBoundingClientRect(); 
      });
    dummy.remove();
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
