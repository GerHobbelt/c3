c3_chart_fn.originalJson = function() {
	return this.internal.getOriginalJson();
};
c3_chart_fn.originalJsonArray = function() {
	return this.internal.json2array(this.internal.getOriginalJson());
};