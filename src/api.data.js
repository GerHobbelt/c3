c3_chart_fn.data = function C3_API_data(targetIds) {
    var targets = this.internal.data.targets;
    return typeof targetIds === 'undefined' ? targets : targets.filter(function (t) {
        return [].concat(targetIds).indexOf(t.id) >= 0;
    });
};
c3_chart_fn.data.shown = function C3_API_data_shown(targetIds) {
    return this.internal.filterTargetsToShow(this.data(targetIds));
};
c3_chart_fn.data.values = function C3_API_data_values(targetId) {
    var targets, values = null;
    if (targetId) {
        targets = this.data(targetId);
        values = targets[0] ? targets[0].values.map(function (d) { return d.value; }) : null;
    }
    return values;
};
c3_chart_fn.data.names = function C3_API_data_names(names) {
    this.internal.clearLegendItemTextBoxCache();
    return this.internal.updateDataAttributes('names', names);
};
c3_chart_fn.data.colors = function C3_API_data_colors(colors) {
    return this.internal.updateDataAttributes('colors', colors);
};
c3_chart_fn.data.axes = function C3_API_data_axes(axes) {
    return this.internal.updateDataAttributes('axes', axes);
};
