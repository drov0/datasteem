function setupSteem() {
    const steem = require('steem');
    steem.api.setOptions({url: 'https://api.steemit.com'});
    return steem;
}
