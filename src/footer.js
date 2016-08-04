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
