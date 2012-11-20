(function() {
$('.response').hide();
$('.head').click(function(e) {
  $(this).siblings('.response').toggle();
});
})();