c3_chart_internal_fn.categoryName = function C3_INTERNAL_categoryName(i) {
    var config = this.config;
    return i < config.axis_x_categories.length ? config.axis_x_categories[i] : i;
};
