c3_chart_internal_fn.getOriginalJson = function C3_INTERNAL_getOriginalJson() {
	return this.config.json_original;
};
c3_chart_internal_fn.json2array = function C3_INTERNAL_json2array(json) {
	var arr = [];
	for (var i in json) {
		arr.push(json[i]);
	}
	return arr;
};
