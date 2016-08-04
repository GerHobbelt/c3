c3_chart_internal_fn.initTitle = function C3_INTERNAL_initTitle() {
    var $$ = this;
    $$.title = $$.svg.append("text")
          .text($$.config.title_text)
//          .attr("x", $$.xForTitle.bind($$))
//          .attr("y", $$.yForTitle.bind($$))
          .attr("class", $$.CLASS.title);
};

c3_chart_internal_fn.redrawTitle = function C3_INTERNAL_redrawTitle() {
    var $$ = this;
    $$.title
          .attr("x", $$.xForTitle.bind($$))
          .attr("y", $$.yForTitle.bind($$));
};
c3_chart_internal_fn.xForTitle = function C3_INTERNAL_xForTitle() {
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
        x = $$.currentWidth - $$.getTextRect($$.title.node(), $$.CLASS.title).width - config.title_padding.right;
    } else if (position.indexOf('center') >= 0) {
        x = ($$.currentWidth - $$.getTextRect($$.title.node(), $$.CLASS.title).width) / 2;
    } else { // left
        x = config.title_padding.left;
    }
    return x;
};
c3_chart_internal_fn.yForTitle = function C3_INTERNAL_yForTitle() {
    var $$ = this, 
        position = $$.config.title_position || 'left',
        textRect = $$.getTextRect($$.title.node(), $$.CLASS.title);
    if (position.indexOf('bottom') >= 0) {
      return $$.getCurrentHeight() - ($$.config.title_padding.bottom + textRect.height);
    }
    return $$.config.title_padding.top + textRect.height;
};
c3_chart_internal_fn.getTitlePadding = function C3_INTERNAL_getTitlePadding() {
    var $$ = this, position = $$.config.title_position || 'left';
    if (position.indexOf('bottom') !== -1) {
      return $$.config.title_padding.bottom + $$.config.title_padding.top;
    }
    return $$.yForTitle() + $$.config.title_padding.bottom;
};

