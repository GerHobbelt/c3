c3_chart_internal_fn.hasCaches = function C3_INTERNAL_hasCaches(ids) {
    for (var i = 0, len = ids.length; i < len; i++) {
        if (!(ids[i] in this.cache)) { 
            return false; 
        }
    }
    return true;
};
c3_chart_internal_fn.addCache = function C3_INTERNAL_addCache(id, target) {
    this.cache[id] = this.cloneTarget(target);
};
c3_chart_internal_fn.getCaches = function C3_INTERNAL_getCaches(ids) {
    var targets = [], 
        i, len;
    for (i = 0, len = ids.length; i < len; i++) {
        if (ids[i] in this.cache) { 
            targets.push(this.cloneTarget(this.cache[ids[i]])); 
        }
    }
    return targets;
};
