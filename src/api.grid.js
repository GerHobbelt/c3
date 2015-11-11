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
