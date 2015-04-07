c3_chart_fn.category = function C3_API_category(i, category) {
    var $$ = this.internal, config = $$.config;
    if (arguments.length > 1) {
        config.axis_x_categories[i] = category;
        $$.redraw();
    }
    return config.axis_x_categories[i];
};
c3_chart_fn.categories = function C3_API_categories(categories) {
    var $$ = this.internal, config = $$.config;
    if (!arguments.length) { return config.axis_x_categories; }
    config.axis_x_categories = categories;
    $$.redraw();
    return config.axis_x_categories;
};
