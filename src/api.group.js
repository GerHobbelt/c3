c3_chart_fn.groups = function C3_API_groups(groups, redraw) {
    var $$ = this.internal, config = $$.config;

    if (!isUndefined(groups)) {
      config.data_groups = groups;

      if (!isUndefined(redraw) ? redraw : true) {
        $$.redraw();
      }
    }

    return config.data_groups;
};
