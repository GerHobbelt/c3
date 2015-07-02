c3_chart_internal_fn.initTitle = function C3_INTERNAL_initTitle() {
    var $$ = this;
    $$.title = $$.svg.append("text")
          .text($$.config.title_text)
//          .attr("x", $$.xForTitle.bind($$))
//          .attr("y", $$.yForTitle.bind($$))
          .attr("class", $$.CLASS.title);
};

c3_chart_internal_fn.redrawTitle = function C3_INTERNAL_redrawTitle() {
    console.count('redrawTitle');
    var $$ = this;
    $$.title
          .attr("x", $$.xForTitle.bind($$))
          .attr("y", $$.yForTitle.bind($$));
};
c3_chart_internal_fn.xForTitle = function () {
    var $$ = this, 
        config = $$.config, 
        position = config.title_position || 'left', 
        x;                 
    /*
    TODO: re-integrate title_x/title_y:
    
          .attr("x", $$.config.title_x)
          .attr("y", $$.getCurrentPaddingTop() + $$.config.title_y)
    */
    if (position.indexOf('right') >= 0) {
        x = $$.currentWidth - $$.title.node().getBBox().width - config.title_padding.right;
    } else if (position.indexOf('center') >= 0) {
        x = ($$.currentWidth - $$.title.node().getBBox().width) / 2;
    } else { // left
        x = config.title_padding.left;
    }
    return x;
};
c3_chart_internal_fn.yForTitle = function () {
    var $$ = this;
    return /* $$.getCurrentPaddingTop() + */ $$.config.title_padding.top + $$.title.node().getBBox().height;
};
c3_chart_internal_fn.getTitlePadding = function() {
    var $$ = this;
    return $$.yForTitle() + $$.config.title_padding.bottom;
};

