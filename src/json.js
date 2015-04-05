c3_chart_internal_fn.getOriginalJson = function() {
	return this.config.json_original;
};
c3_chart_internal_fn.json2array = function(json) {
	var arr = [];
	for (var i in json) {
		arr.push(json[i]);
	}
	return arr;
};