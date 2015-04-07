c3_chart_internal_fn.initTitle = function C3_INTERNAL_initTitle() {
    var $$ = this;
    $$.title = $$.svg.append("text")
          .text($$.config.title_text)
          .attr("class", "c3-chart-title")
          .attr("x", $$.config.title_x)
          .attr("y", $$.config.title_y);
};

c3_chart_internal_fn.redrawTitle = function C3_INTERNAL_redrawTitle() {
    console.count('redrawTitle');
    var $$ = this;
    $$.title
          .attr("x", $$.config.title_x)
          .attr("y", $$.config.title_y || $$.title.node().getBBox().height);
};
