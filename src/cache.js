c3_chart_internal_fn.hasCaches = function C3_INTERNAL_hasCaches(ids) {
    for (var i = 0; i < ids.length; i++) {
        if (! (ids[i] in this.cache)) { return false; }
    }
    return true;
};
c3_chart_internal_fn.addCache = function C3_INTERNAL_addCache(id, target) {
    this.cache[id] = this.cloneTarget(target);
};
c3_chart_internal_fn.getCaches = function C3_INTERNAL_getCaches(ids) {
    var targets = [], i;
    for (i = 0; i < ids.length; i++) {
        if (ids[i] in this.cache) { targets.push(this.cloneTarget(this.cache[ids[i]])); }
    }
    return targets;
};
