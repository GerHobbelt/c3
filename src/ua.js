c3_chart_internal_fn.isSafari = function C3_INTERNAL_isSafari() {
    var ua = window.navigator.userAgent;
    return ua.indexOf('Safari') >= 0 && ua.indexOf('Chrome') < 0;
};
c3_chart_internal_fn.isChrome = function C3_INTERNAL_isChrome() {
    var ua = window.navigator.userAgent;
    return ua.indexOf('Chrome') >= 0;
};
