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
