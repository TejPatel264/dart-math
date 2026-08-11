/**
 * pickerIconsInit.js
 * ---------------------------------------------------------
 * Populates every icon slot on the page - .picker-card__icon on
 * the picker pages, .mode-button__icon on the home page - from
 * its data-icon (and, for dartGroup, data-icon-count) attribute.
 * Shared across every page that wants one of these icons so each
 * page's HTML only needs to declare WHICH icon a slot wants, not
 * repeat the SVG markup itself - see js/pickerIcons.js for where
 * that markup actually comes from.
 * ---------------------------------------------------------
 */
(function () {
  if (!window.DartsTrainer || !window.DartsTrainer.pickerIcons) {
    // Icons are a purely decorative enhancement - if the icon
    // module didn't load for some reason, the buttons/cards still
    // work fine as plain text, so fail silently rather than
    // breaking navigation.
    return;
  }

  const { pickerIcons } = window.DartsTrainer;

  document.querySelectorAll('[data-icon]').forEach((el) => {
    const iconName = el.dataset.icon;
    const builder = pickerIcons[iconName];
    if (typeof builder !== 'function') return;

    if (iconName === 'dartGroup') {
      const count = Number(el.dataset.iconCount) || 1;
      el.innerHTML = builder(count);
    } else {
      el.innerHTML = builder();
    }
  });
})();
