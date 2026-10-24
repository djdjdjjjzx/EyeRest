const { translate } = require('../shared/i18n');
// Read the current preference at use time, including dialogs opened after a change.
function t(key, values) {
  return translate(require('./store').getSettings().language, key, values);
}
module.exports = { t };
