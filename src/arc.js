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
            return updated ? arc(updated) : 'M 0 0';
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
        return updated ? arc(updated) : 'M 0 0';
    };
};

c3_chart_internal_fn.getArc = function C3_INTERNAL_getArc(d, withoutUpdate, force) {
    return force || this.isArcType(d.data) ? this.svgArc(d, withoutUpdate) : 'M 0 0';
};


c3_chart_internal_fn.transformForArcLabel = function C3_INTERNAL_transformForArcLabel(d) {
    var $$ = this, 
        config = $$.config,
        updated = $$.updateAngle(d), 
        c, x, y, h, ratio, 
        translate = '',
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
        translate = 'translate(' + (x * ratio) +  ',' + (y * ratio) +  ')';
    }
    else if (updated && hasGauge && $$.visibleTargetCount > 1) {
        var y1 = Math.sin(updated.endAngle - Math.PI / 2);
        x = Math.cos(updated.endAngle - Math.PI / 2) * ($$.radiusExpanded + 25);
        y = y1 * ($$.radiusExpanded + 15 - Math.abs(y1 * 10)) + 3;
        translate = 'translate(' + x +  ',' + y +  ')';
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
        return ''; 
    }
    updated = $$.updateAngle(d);
    value = updated ? updated.value : null;
    ratio = $$.getArcRatio(updated);
    id = d.data.id;
    if (!$$.hasType('gauge') && !$$.meetsArcLabelThreshold(ratio)) { 
        return ''; 
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
            .attr('d', $$.svgArcExpanded)
            .transition().duration($$.expandDuration(d.data.id) * 2)
            .attr('d', $$.svgArcExpandedSub)
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
        .attr('d', $$.svgArc);
    $$.svg.selectAll('.' + CLASS.arc)
        .style('opacity', 1);
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
    return $$.hasType('donut') ? $$.config.donut_title : '';
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
        .attr('class', function (d) { 
            return classChartArc(d) + classFocus(d.data); 
        });
    mainPieEnter = mainPieUpdate.enter().append('g')
        .attr('class', classChartArc);
    mainPieEnter.append('g')
        .attr('class', classArcs);
    mainPieEnter.append('text')
        .attr('dy', $$.hasType('gauge') ? '-.1em' : '.35em')
        .style('opacity', 0)
        .style('text-anchor', 'middle')
        .style('pointer-events', 'none');
    // MEMO: can not keep same color..., but not bad to update color in redraw
    //mainPieUpdate.exit().remove();
};

c3_chart_internal_fn.initArc = function C3_INTERNAL_initArc() {
    var $$ = this;
    $$.arcs = $$.main.select('.' + CLASS.chart).append('g')
        .attr('class', CLASS.chartArcs)
        .attr('transform', $$.getTranslate('arc'));
    if ($$.config.donut_subtitle) {
        $$.arcs.append('text')
            .attr('class', CLASS.chartArcsSubTitle)
            .attr('transform', 'translate(0,-10)')
            .style('text-anchor', 'middle')
            .text($$.config.donut_subtitle);
    }
    if ($$.config.donut_title) {
        var title = $$.arcs.append('text')
            .attr('class', CLASS.chartArcsTitle)
            .style('text-anchor', 'middle')
            .text($$.getArcTitle());
        if ($$.config.donut_subtitle) {
            title.attr('transform', 'translate(0,20)');
        } else {
            title.attr('transform', 'translate(0,5)');
        }
    }
};

c3_chart_internal_fn.redrawArc = function C3_INTERNAL_redrawArc(duration, durationForExit, withTransform) {
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
        .attr('class', $$.classArc.bind($$))
        .style('fill', function (d) { 
            return $$.color(d.data); 
        })
        .style('cursor', function (d) { 
            return config.interaction_enabled && config.data_selection_isselectable(d) ? 'pointer' : null; 
        })
        .style('opacity', 0)
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
            .attr('class', function (d) { 
                return CLASS.arcLabelLine + ' ' + CLASS.target + ' ' + CLASS.target + '-' + d.data.id; 
            });
        if ($$.visibleTargetCount === 1) {
            mainArcLabelLine.style('display', 'none');
        }
        else {
            mainArcLabelLine
                .style('fill', function (d) { 
                    return config.color_pattern.length > 0 ? $$.levelColor(d.data.values[0].value) : $$.color(d.data); 
                })
                .style('display', '')
                .each(function (d) {
                    var lineLength = 0, 
                        lineThickness = 2, 
                        x = 0, 
                        y = 0, 
                        transform = '';
                    if ($$.hiddenTargetIds.indexOf(d.data.id) < 0) {
                        var updated = $$.updateAngle(d),
                            innerLineLength = $$.gaugeArcWidth / $$.visibleTargetCount * (updated.index + 1),
                            lineAngle = updated.endAngle - Math.PI / 2,
                            linePositioningAngle = lineAngle - Math.PI / 180 / 3,
                            arcInnerRadius = $$.radius - innerLineLength;
                        lineLength = $$.radiusExpanded - $$.radius + innerLineLength;
                        x = Math.cos(linePositioningAngle) * arcInnerRadius;
                        y = Math.sin(linePositioningAngle) * arcInnerRadius;
                        transform = 'rotate(' + (lineAngle * 180 / Math.PI) + ', ' + x + ', ' + y + ')';
                    }
                    d3.select(this)
                        .attr({ x: x, y: y, width: lineLength, height: lineThickness, transform: transform })
                        .style('stroke-dasharray', '0, ' + (lineLength + lineThickness) + ', 0');
                });
        }
    }
    mainArc
        .attr('transform', function (d) { 
            return !$$.isGaugeType(d.data) && withTransform ? 'scale(0)' : ''; 
        })
        .style('opacity', function (d) { 
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
        .attrTween('d', function (d) {
            var updated = $$.updateAngle(d), 
                interpolate;
            if (!updated) {
                return function () { 
                    return 'M 0 0'; 
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
        .attr('transform', withTransform ? 'scale(1)' : '')
        .style('fill', function (d) {
            return $$.levelColor ? $$.levelColor(d.data.values[0].value) : $$.color(d.data.id);
        }) // Where gauge reading color would receive customization.
        .style('opacity', 1)
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
        .attr('transform', $$.transformForArcLabel.bind($$))
        .style('font-size', function (d) { 
            return $$.isGaugeType(d.data) && $$.visibleTargetCount === 1 ? Math.round($$.radius / 5) + 'px' : '';
        })
      .transition().duration(duration)
        .style('opacity', function (d) { 
            return $$.isTargetToShow(d.data.id) && $$.isArcType(d.data) ? 1 : 0; 
        });
    main.select('.' + CLASS.chartArcsTitle)
        .style('opacity', $$.hasType('donut') || hasGaugeType ? 1 : 0);

    if (hasGaugeType) {
        var index = 0;

        gaugeLabelFormat = $$.getArcLabelFormat();
        minGaugeValue = $$.config.gauge_label_formatall ? gaugeLabelFormat(config.gauge_min) : config.gauge_min;
        maxGaugeValue = $$.config.gauge_label_formatall ? gaugeLabelFormat(config.gauge_max) : config.gauge_max;
        
        $$.arcs.selectAll('.' + CLASS.chartArcsBackground)
            .attr('d', function (d1) {
                if ($$.hiddenTargetIds.indexOf(d1.id) >= 0) { 
                    return 'M 0 0'; 
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
            .attr('dy', '.75em')
            .text(config.gauge_label_show ? config.gauge_units : '');
        $$.arcs.select('.' + CLASS.chartArcsGaugeMin)
            .attr('dx', -1 * ($$.innerRadius + (($$.radius - $$.innerRadius) / (config.gauge_fullCircle ? 1 : 2))) + 'px')
            .attr('dy', '1.2em')
            .text(config.gauge_label_show ? minGaugeValue : '');
        $$.arcs.select('.' + CLASS.chartArcsGaugeMax)
            .attr('dx', $$.innerRadius + (($$.radius - $$.innerRadius) / (config.gauge_fullCircle ? 1 : 2)) + 'px')
            .attr('dy', '1.2em')
            .text(config.gauge_label_show ? maxGaugeValue : '');
    }
};
c3_chart_internal_fn.initGauge = function C3_INTERNAL_initGauge() {
    var $$ = this, 
        arcs = $$.arcs;
    if (this.hasType('gauge')) {
        arcs.selectAll().data($$.data.targets).enter()
            .append('path')
            .attr('class', function (d) {
                return CLASS.chartArcsBackground + ' ' + CLASS.target +'-'+ d.id;
            });
        arcs.append('text')
            .attr('class', CLASS.chartArcsGaugeUnit)
            .style('text-anchor', 'middle')
            .style('pointer-events', 'none');
        arcs.append('text')
            .attr('class', CLASS.chartArcsGaugeMin)
            .style('text-anchor', 'middle')
            .style('pointer-events', 'none');
        arcs.append('text')
            .attr('class', CLASS.chartArcsGaugeMax)
            .style('text-anchor', 'middle')
            .style('pointer-events', 'none');
    }
};
c3_chart_internal_fn.getGaugeLabelHeight = function C3_INTERNAL_getGaugeLabelHeight() {
    return this.config.gauge_label_show ? 20 : 0;
};
