var isValue = c3_chart_internal_fn.isValue = function C3_INTERNAL_isValue(v) {
        return v || v === 0;
    },
    isFunction = c3_chart_internal_fn.isFunction = function C3_INTERNAL_isFunction(o) {
        return typeof o === 'function';
    },
    isString = c3_chart_internal_fn.isString = function C3_INTERNAL_isString(o) {
        return typeof o === 'string';
    },
    isUndefined = c3_chart_internal_fn.isUndefined = function C3_INTERNAL_isUndefined(v) {
        return typeof v === 'undefined';
    },
    isDefined = c3_chart_internal_fn.isDefined = function C3_INTERNAL_isDefined(v) {
        return typeof v !== 'undefined';
    },
    ceil10 = c3_chart_internal_fn.ceil10 = function C3_INTERNAL_ceil10(v) {
        return Math.ceil(v / 10) * 10;
    },
    asHalfPixel = c3_chart_internal_fn.asHalfPixel = function C3_INTERNAL_asHalfPixel(n) {
        return Math.ceil(n) + 0.5;
    },
    diffDomain = c3_chart_internal_fn.diffDomain = function C3_INTERNAL_diffDomain(d) {
        return d[1] - d[0];
    },
    isEmpty = c3_chart_internal_fn.isEmpty = function C3_INTERNAL_isEmpty(o) {
        return typeof o === 'undefined' || o === null || (isString(o) && o.length === 0) || (typeof o === 'object' && Object.keys(o).length === 0);
    },
    notEmpty = c3_chart_internal_fn.notEmpty = function C3_INTERNAL_notEmpty(o) {
        return !c3_chart_internal_fn.isEmpty(o);
    },
    getOption = c3_chart_internal_fn.getOption = function C3_INTERNAL_getOption(options, key, defaultValue) {
        return isDefined(options[key]) ? options[key] : defaultValue;
    },
    hasValue = c3_chart_internal_fn.hasValue = function C3_INTERNAL_hasValue(dict, value) {
        var found = false;
        Object.keys(dict).forEach(function (key) {
            if (dict[key] === value) { found = true; }
        });
        return found;
    },
    getPathBox = c3_chart_internal_fn.getPathBox = function C3_INTERNAL_getPathBox(path) {
        var box = path.getBoundingClientRect(),
            minX, minY;
        // MSIE supports pathSEgList while it crashes on latest Chrome: https://msdn.microsoft.com/en-us/library/ff971976(v=vs.85).aspx
        if (path.pathSegList && path.pathSegList.getItem) {
            var seg0 = path.pathSegList.getItem(0);
            var seg1 = path.pathSegList.getItem(1);
            minX = Math.min(seg0.x, seg1.x); 
            minY = Math.min(seg0.y, seg1.y);
        } else {
            minX = box.left;
            minY = box.top;
        }
        return {
            x: minX, 
            y: minY, 
            width: box.width, 
            height: box.height
        };
    };
