
var describe = window.describe;
var expect = window.expect;
var it = window.it;

var c3 = window.c3;

describe('c3', function () {
    'use strict';

    it('exists', function () {

        expect(c3).not.toBe(null);
        expect(typeof c3).toBe('object');

    });

    // describe('api.flow', function () {
    //     it('does something', function () {
    //         var args = {
    //             columns: [
    //                 ['x', 10, 20, 30],
    //                 ['data1', 500, 210, 180]
    //             ]
    //         };
    //         c3.chart.fn.flow(args);
    //     });
    // });

});
