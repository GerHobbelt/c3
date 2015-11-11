c3_chart_fn.originalJson = function C3_API_originalJson() {
	return this.internal.getOriginalJson();
};
c3_chart_fn.originalJsonArray = function C3_API_originalJsonArray() {
	return this.internal.json2array(this.internal.getOriginalJson());
};