describe('c3', function () {
    'use strict';

    var c3 = window.c3;

    it('exists', function () {
        expect(c3).not.toBeNull();
        expect(typeof c3).toBe('object');
    });
    // ...write other tests here
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
