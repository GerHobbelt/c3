describe('c3 chart footer', function () {
    'use strict';
    var chart, config;

    describe('when given a footer config with only show', function() {
        beforeEach(function(done) {
            config = {
                data: {
                    columns: [
                        ['data1', 30, 200, 100, 400, 150, 250]
                    ]
                },
                footer: {
                    show: true
                }
            };
            chart = window.initChart(chart, config, done);
        });

        it('renders the footer with default values', function () {
            var footerEl = d3.select(".c3-chart-footer");
            expect(footerEl.attr("height")).toEqual('15');
            expect(footerEl.attr("style")).toEqual('fill: #FFF');
        });
    });

    describe('when given a border config with only show', function() {
        beforeEach(function(done) {
            config = {
                data: {
                    columns: [
                        ['data1', 30, 200, 100, 400, 150, 250]
                    ]
                },
                footer: {
                    show: true,
                    border: {
                      show: true
                    }
                }
            };
            chart = window.initChart(chart, config, done);
        });

        it('renders the border with default values', function () {
            var borderEl = d3.select(".c3-chart-footer-border");
            expect(borderEl.attr("style")).toEqual('stroke-width: 1; stroke: #000');
        });
    });

    describe('when given a footer config with no bottom padding', function () {     
        beforeEach(function(done) {
            config = {
                data: {
                    columns: [
                        ['data1', 30, 200, 100, 400, 150, 250]
                    ]
                },
                footer: {
                    show: true,
                    color: '#444'
                }
            };
            chart = window.initChart(chart, config, done);
        });

        it('does not render the footer element or border', function () {
            var footerEl = d3.selectAll(".c3-chart-footer"),
                borderEl = d3.selectAll(".c3-chart-footer-border");
            expect(footerEl[0].length).toEqual(0);
            expect(borderEl[0].length).toEqual(0);
        });
    });

    describe('when given a footer config option with bottom padding', function () {     
        beforeEach(function(done) {
            config = {
                data: {
                    columns: [
                        ['data1', 30, 200, 100, 400, 150, 250]
                    ]
                },
                footer: {
                    show: true,
                    color: '#444',
                    border: {
                        show: true,
                        color: '#333',
                        width: 2
                    }
                },
                padding: {
                    bottom: 10
                }
            };
            chart = window.initChart(chart, config, done);
        });

        it('renders the footer element with the correct color', function () {
            var footerEl = d3.select(".c3-chart-footer");
            expect(footerEl.attr("style")).toEqual('fill: #444');
        });

        it('renders the footer element with the correct color', function () {
            var borderEl = d3.select(".c3-chart-footer-border");
            expect(borderEl.attr("style")).toEqual('stroke-width: 2; stroke: #333');
        });
    });

    describe('when given a footer config option with height and options', function () {
        beforeEach(function(done) {
            config = {
                data: {
                    columns: [
                        ['data1', 30, 200, 100, 400, 150, 250]
                    ]
                },
                footer: {
                    show: true,
                    color: '#444',
                    height: 20,
                    border: {
                        show: true,
                        color: '#333',
                        width: 2
                    }
                }
            };
            chart = window.initChart(chart, config, done);
        });

        it('renders the footer element with the correct color and height', function () {
            var footerEl = d3.select(".c3-chart-footer");
            expect(footerEl.attr("style")).toEqual('fill: #444');
            expect(footerEl.attr("height")).toEqual('20');
        });

        it('renders the border element with the correct color', function () {
            var borderEl = d3.select(".c3-chart-footer-border");
            expect(borderEl.attr("style")).toEqual('stroke-width: 2; stroke: #333');
        });
    });
});
