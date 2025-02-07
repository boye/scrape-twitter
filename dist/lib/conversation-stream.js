'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Readable = require('readable-stream/readable');
var debug = require('debug')('scrape-twitter:conversation-stream');

var twitterQuery = require('./twitter-query');

var flatten = function flatten(arr) {
  return arr.reduce(function (prev, curr) {
    return prev.concat(curr);
  }, []);
};

var ConversationStream = function (_Readable) {
  _inherits(ConversationStream, _Readable);

  function ConversationStream(username, id) {
    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        count = _ref.count;

    _classCallCheck(this, ConversationStream);

    var _this = _possibleConstructorReturn(this, (ConversationStream.__proto__ || Object.getPrototypeOf(ConversationStream)).call(this, { objectMode: true }));

    _this.isLocked = false;
    _this._numberOfTweetsRead = 0;
    _this._lastMinPosition = undefined;
    _this._lastReadTweetId = undefined;

    _this.username = username;
    _this.id = id;
    _this.count = count;
    debug('ConversationStream for ' + _this.username + ' and ' + _this.id);
    return _this;
  }

  _createClass(ConversationStream, [{
    key: '_read',
    value: function _read() {
      var _this2 = this;

      if (this.isLocked) {
        debug('ConversationStream cannot be read as it is locked');
        return false;
      }
      if (!!this.count && this._numberOfTweetsRead >= this.count) {
        debug('ConversationStream has read up to the max count');
        this.push(null);
        return false;
      }
      if (this._readableState.destroyed) {
        debug('ConversationStream cannot be read as it is destroyed');
        this.push(null);
        return false;
      }

      this.isLocked = true;
      debug('ConversationStream is now locked');
      twitterQuery.getUserConversation(this.username, this.id, this._lastMinPosition).then(function (tweets) {
        var extendedTweets = tweets.reduce(function (ets, ct, idx) {
          // const _showMoreTweetsFromConversation =
          //   ct._showMoreTweetsFromConversation
          // delete ct._showMoreTweetsFromConversation

          ets.push(ct);
          // if (_showMoreTweetsFromConversation) {
          //   ets.push(
          //     twitterQuery.getThreadedConversation(
          //       _showMoreTweetsFromConversation
          //     )
          //   )
          // }

          return ets;
        }, []);

        return Promise.all(extendedTweets);
      })
      // .then(tweets => {
      //   const lastReadTweetId = tweets.length
      //     ? tweets[tweets.length - 1].id
      //     : undefined
      //   if (this._lastReadTweetId === lastReadTweetId) {
      //     this.push(null)
      //     this.isLocked = false
      //     return
      //   }
      //
      //   for (const tweet of tweets) {
      //     this.push(tweet)
      //     this._numberOfTweetsRead++
      //     if (this._numberOfTweetsRead >= this.count) {
      //       debug('ConversationStream has read up to the max count')
      //       break
      //     }
      //   }
      //
      //   const hasZeroTweets = lastReadTweetId === undefined
      //   const hasDifferentLastTweet = this._lastReadTweetId !== lastReadTweetId
      //   const hasMoreTweets = !hasZeroTweets && hasDifferentLastTweet
      //   if (hasMoreTweets === false) {
      //     debug('ConversationStream has no more tweets:', {
      //       hasZeroTweets,
      //       hasDifferentLastTweet,
      //       hasMoreTweets
      //     })
      //     this.push(null)
      //   } else {
      //     debug('ConversationStream has more tweets:', {
      //       hasZeroTweets,
      //       hasDifferentLastTweet,
      //       hasMoreTweets
      //     })
      //   }
      //
      //   if (tweets.minPosition) {
      //     debug(
      //       `ConversationStream sets the last min position to ${
      //         tweets.minPosition
      //       }`
      //     )
      //     this._lastMinPosition = tweets.minPosition
      //   }
      //
      //   debug(`TimelineStream sets the last tweet to ${lastReadTweetId}`)
      //   this._lastReadTweetId = lastReadTweetId
      //
      //   this.isLocked = false
      //   debug('ConversationStream is now unlocked')
      //
      //   if (hasMoreTweets) {
      //     debug('ConversationStream has more tweets so calls this._read')
      //     this._read()
      //   }
      // })
      .catch(function (err) {
        return _this2.emit('error', err);
      });
    }
  }]);

  return ConversationStream;
}(Readable);

module.exports = ConversationStream;