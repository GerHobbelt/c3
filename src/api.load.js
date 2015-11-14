c3_chart_fn.load = function C3_API_load(args) {
    var $$ = this.internal, 
        config = $$.config;
    // update xs if specified
    if (args.xs) {
        $$.addXs(args.xs);
    }
    // update classes if exists
    if (args.classes) {
        Object.keys(args.classes).forEach(function (id) {
            config.data_classes[id] = args.classes[id];
        });
    }
    // update categories if exists
    if (args.categories && $$.isCategorized()) {
        config.axis_x_categories = args.categories;
    }
    // update axes if exists
    if (args.axes) {
        Object.keys(args.axes).forEach(function (id) {
            config.data_axes[id] = args.axes[id];
        });
    }
    // update colors if exists
    if (args.colors) {
        Object.keys(args.colors).forEach(function (id) {
            config.data_colors[id] = args.colors[id];
        });
    }
    // update names if exists
    if (args.names) {
        this.data.names(args.names, false);
    }
    // update groups if exists
    if (args.groups) {
        this.groups(args.groups, false);
    }
    // use cache if exists
    if (args.cacheIds && $$.hasCaches(args.cacheIds)) {
        $$.load($$.getCaches(args.cacheIds), args.done);
        return;
    }
    // unload if needed (args.unload can be a boolean value TRUE or an ID string or an array of IDs to feed to mapToTargetIds())
    if (args.unload) {
        var idsToUnload = $$.mapToTargetIds((typeof args.unload === 'boolean' && args.unload) ? null : args.unload);

        // TODO: do not unload if target will load (included in url/rows/columns)
        $$.unload(idsToUnload, function () {
            $$.loadFromArgs(args);
        });
    } else {
        $$.loadFromArgs(args);
    }
    // toggle data labels if exists
    if (args.labels) {
        this.toggleLabels(args.labels);
    }
};

c3_chart_fn.unload = function C3_API_unload(args) {
    var $$ = this.internal;
    args = args || {};
    if (args instanceof Array) {
        args = {ids: args};
    } else if (typeof args === 'string') {
        args = {ids: [args]};
    }
    $$.unload($$.mapToTargetIds(args.ids), function () {
        $$.redraw({withUpdateOrgXDomain: true, withUpdateXDomain: true, withLegend: true});
        if (args.done) { 
            args.done(); 
        }
    });
};
