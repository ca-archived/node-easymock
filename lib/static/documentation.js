(function() {
$('.call .body').hide();
$('.call .head').click(function(e) {
  $(this).siblings('.body').toggle();
});
})();