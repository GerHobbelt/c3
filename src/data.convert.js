c3_chart_internal_fn.convertUrlToData = function C3_INTERNAL_convertUrlToData(url, mimeType, headers, keys, done) {
    var $$ = this, 
        type = mimeType ? mimeType : 'csv';
    var req = $$.d3.xhr(url);
    if (headers) {
        Object.keys(headers).forEach(function (header) {
            req.header(header, headers[header]);
        });
    }
    req.get(function (error, data) {
        var d;
        if (!data) {
            throw new Error((error.responseURL || url) + ' [' + error.status + '] (' + (error.statusText || 'Cannot load data from URL') + ')');
        }
        var dataResponse = data.response || data.responseText;
        if (type === 'json') {
            d = $$.convertJsonToData(JSON.parse(dataResponse), keys);
        } else if (type === 'tsv') {
            d = $$.convertTsvToData(dataResponse);
        } else {
            d = $$.convertCsvToData(dataResponse);
        }
        done.call($$, d);
    });
};
c3_chart_internal_fn.convertXsvToData = function C3_INTERNAL_convertXsvToData(xsv, parser) {
    var rows = parser.parseRows(xsv), 
        d;
    if (rows.length === 1) {
        d = [{}];
        rows[0].forEach(function (id) {
            d[0][id] = null;
        });
    } else {
        d = parser.parse(xsv);
    }
    return d;
};
c3_chart_internal_fn.convertCsvToData = function C3_INTERNAL_convertCsvToData(csv) {
    return this.convertXsvToData(csv, this.d3.csv);
};
c3_chart_internal_fn.convertTsvToData = function C3_INTERNAL_convertTsvToData(tsv) {
    return this.convertXsvToData(tsv, this.d3.tsv);
};
c3_chart_internal_fn.convertJsonToData = function C3_INTERNAL_convertJsonToData(json, keys) {
    var $$ = this,
        new_rows = [], 
        targetKeys, data;
    $$.config.json_original = json;
    if (keys) { // when keys specified, json would be an array that includes objects
        if (keys.x) {
            targetKeys = keys.value.concat(keys.x);
            $$.config.data_x = keys.x;
        } else {
            targetKeys = keys.value;
        }
        new_rows.push(targetKeys);
        json.forEach(function (o) {
            var new_row = [];
            targetKeys.forEach(function (key) {
                // convert undefined to null because undefined data will be removed in convertDataToTargets()
                var v = $$.findValueInJson(o, key);
                if (isUndefined(v)) {
                    v = null;
                }
                new_row.push(v);
            });
            new_rows.push(new_row);
        });
        data = $$.convertRowsToData(new_rows);
    } else {
        Object.keys(json).forEach(function (key) {
            new_rows.push([key].concat(json[key]));
        });
        data = $$.convertColumnsToData(new_rows);
    }
    return data;
};
c3_chart_internal_fn.findValueInJson = function (object, path) {
    if (path in object) {
        // if object has a key that contains . or [], return the key's value
        // instead of searching for an inner object
        return object[path];
    }

    path = path.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties (replace [] with .)
    path = path.replace(/^\./, '');           // strip a leading dot
    var pathArray = path.split('.');

    // search for any inner objects or arrays denoted by the path
    for (var i = 0; i < pathArray.length; ++i) {
        var k = pathArray[i];
        if (k in object) {
            object = object[k];
        } else {
            return;
        }
    }
    return object;
};
c3_chart_internal_fn.convertRowsToData = function C3_INTERNAL_convertRowsToData(rows) {
    var keys = rows[0], 
        new_row = {}, 
        new_rows = [], 
        i, j,
        ilen, jlen, row;
    for (i = 1, ilen = rows.length; i < ilen; i++) {
        new_row = {};
        row = rows[i];
        for (j = 0, jlen = row.length; j < jlen; j++) {
            if (isUndefined(row[j])) {
                throw new Error("Source data is missing a component at (" + i + "," + j + ")!");
            }
            new_row[keys[j]] = row[j];
        }
        new_rows.push(new_row);
    }
    return new_rows;
};
c3_chart_internal_fn.convertColumnsToData = function C3_INTERNAL_convertColumnsToData(columns) {
    var new_rows = [], 
        i, j, ilen, jlen, key, column;
    for (i = 0, ilen = columns.length; i < ilen; i++) {
        column = columns[i];
        key = column[0];
        for (j = 1, jlen = column.length; j < jlen; j++) {
            if (isUndefined(new_rows[j - 1])) {
                new_rows[j - 1] = {};
            }
            if (isUndefined(column[j])) {
                throw new Error("Source data is missing a component at (" + i + "," + j + ")!");
            }
            new_rows[j - 1][key] = column[j];
        }
    }
    return new_rows;
};
c3_chart_internal_fn.convertDataToTargets = function C3_INTERNAL_convertDataToTargets(data, appendXs) {
    var $$ = this, 
        config = $$.config,
        ids = $$.d3.keys(data[0]).filter($$.isNotX, $$),
        xs = $$.d3.keys(data[0]).filter($$.isX, $$),
        targets;

    // save x for update data by load when custom x and c3.x API
    ids.forEach(function (id) {
        var xKey = $$.getXKey(id);

        if ($$.isCustomX() || $$.isTimeSeries()) {
            // if included in input data
            if (xs.indexOf(xKey) >= 0) {
                $$.data.xs[id] = (appendXs && $$.data.xs[id] ? $$.data.xs[id] : []).concat(
                    data.map(function (d) { 
                        return d[xKey]; 
                    })
                    .filter(isValue)
                    .map(function (rawX, i) { 
                        return $$.generateTargetX(rawX, id, i); 
                    })
                );
            }
            // if not included in input data, find from preloaded data of other id's x
            else if (config.data_x) {
                $$.data.xs[id] = $$.getOtherTargetXs();
            }
            // if not included in input data, find from preloaded data
            else if (notEmpty(config.data_xs)) {
                $$.data.xs[id] = $$.getXValuesOfXKey(xKey, $$.data.targets);
            }
            // MEMO: if no x included, use same x of current will be used
        } else {
            $$.data.xs[id] = data.map(function (d, i) { 
                return i; 
            });
        }
    });


    // check x is defined
    ids.forEach(function (id) {
        if (!$$.data.xs[id]) {
            throw new Error('x is not defined for id = "' + id + '".');
        }
    });

    // convert to target
    targets = ids.map(function (id, index) {
        var convertedId = config.data_idConverter(id);
        return {
            id: convertedId,
            id_org: id,
            values: data.map(function (d, i) {
                var xKey = $$.getXKey(id), 
                    rawX = d[xKey],
                    x,
                    value = d[id] !== null && !isNaN(d[id]) ? +d[id] : null;
                // use x as categories if custom x and categorized
                if ($$.isCustomX() && $$.isCategorized() && !isUndefined(rawX)) {
                    if (index === 0 && i === 0) {
                        config.axis_x_categories = [];
                    }
                    x = config.axis_x_categories.indexOf(rawX);
                    if (x === -1) {
                        x = config.axis_x_categories.length;
                        config.axis_x_categories.push(rawX);
                    }
                } else {
                    x  = $$.generateTargetX(rawX, id, i);
                }
                // mark as x = undefined if value is undefined and filter to remove after mapped
                if (isUndefined(d[id]) || $$.data.xs[id].length <= i) {
                    x = undefined;
                }

                return {
                    x: x, 
                    value: value, 
                    id: convertedId
                };
            }).filter(function (v) { 
                return isDefined(v.x); 
            })
        };
    });

    // finish targets
    targets.forEach(function (t) {
        var i;
        // sort values by its x
        if (config.data_xSort) {
            t.values = t.values.sort(function (v1, v2) {
                var x1 = v1.x || v1.x === 0 ? v1.x : Infinity,
                    x2 = v2.x || v2.x === 0 ? v2.x : Infinity;
                return x1 - x2;
            });
        }
        // indexing each value
        i = 0;
        t.values.forEach(function (v) {
            v.index = i++;
        });
        // this needs to be sorted because its index and value.index is identical
        $$.data.xs[t.id].sort(function (v1, v2) {
            return v1 - v2;
        });
    });

    // cache information about values
    $$.hasNegativeValue = $$.hasNegativeValueInTargets(targets);
    $$.hasPositiveValue = $$.hasPositiveValueInTargets(targets);

    // set target types
    if (config.data_type) {
        $$.setTargetType($$.mapToIds(targets).filter(function (id) { 
            return !(id in config.data_types); 
        }), config.data_type);
    }

    // cache as original id keyed
    targets.forEach(function (d) {
        $$.addCache(d.id_org, d);
    });

    return targets;
};
