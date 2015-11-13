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
