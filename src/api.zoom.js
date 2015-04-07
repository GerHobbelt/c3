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
