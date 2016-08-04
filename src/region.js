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
if (0) {
    g.append('text')
        .text(function (d) {
            return 'xxxxxxxxxxxxxxxxxxxxxxxxx:' + $$.labelRegion.bind($$)(d);
        });
}
    $$.mainRegion
        .attr('class', $$.classRegion.bind($$));
    $$.mainRegion.exit().transition().duration(duration)
        .style("opacity", 0)
        .remove();
};
c3_chart_internal_fn.redrawRegion = function C3_INTERNAL_redrawRegion(withTransition) {
    var $$ = this,
        regions = $$.mainRegion.selectAll('rect, text').each(function () {
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
        
    var paddedY = function (d) {
        return $$.regionY(d) + 10;  // To allow for text height
    };
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
