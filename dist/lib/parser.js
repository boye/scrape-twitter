'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var urlRegex = require('url-regex');

var debug = require('debug')('scrape-twitter:parser');

var POINTS_REPLY = 1;
var POINTS_LIKE = 2;
var POINTS_RETWEET = 3;

var flatten = function flatten(arr) {
  return arr.reduce(function (prev, curr) {
    return prev.concat(curr);
  }, []);
};

var parseText = function parseText($, textElement) {
  // Replace each emoji image with the actual emoji unicode
  textElement.find('img.Emoji, img.twitter-emoji').each(function (i, emoji) {
    var alt = $(emoji).attr('alt');
    return $(emoji).html(alt);
  });

  // Remove hidden URLS
  textElement.find('a.u-hidden').remove();

  return textElement.text().replace(/(\r\n|\n|\r)/gm, '').trim();
};

var parseActionCount = function parseActionCount($, element, action) {
  var wrapper = $(element).find('.ProfileTweet-action--' + action + ' .ProfileTweet-actionCount');
  return wrapper.length !== 0 ? +$(wrapper).first().attr('data-tweet-stat-count') : 0;
};

var parseImages = function parseImages($, element) {
  var pics = $(element).find('\n    .multi-photos .multi-photo[data-image-url],\n    [data-card-type=photo] [data-image-url],\n    .AdaptiveMedia-photoContainer[data-image-url]\n  ').toArray();
  var images = [];
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = pics[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var pic = _step.value;

      images.push($(pic).attr('data-image-url'));
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return images;
};

var parseUsernamesFromText = function parseUsernamesFromText(text) {
  // NOTE: Currently this will match `someText@username@anotherUsername@someOtherUserName`
  //       but it should not.
  var USERNAME_REGEX = /@(\w+)/g;

  var toUsernames = [];
  var usernameMatched = void 0;
  while ((usernameMatched = USERNAME_REGEX.exec(text)) !== null) {
    toUsernames.push({
      screenName: usernameMatched[1],
      indices: [usernameMatched.index, USERNAME_REGEX.lastIndex]
    });
  }

  return toUsernames;
};

var parseHashtagsFromText = function parseHashtagsFromText(text) {
  // NOTE: Currently this will match `someText#hashtag#anotherHashtag#someOtherHashtag`
  //       but it should not.
  var HASHTAG_REGEX = /#(\w+)/g;

  var hashtags = [];
  var hashtagMatched = void 0;
  while ((hashtagMatched = HASHTAG_REGEX.exec(text)) !== null) {
    hashtags.push({
      hashtag: hashtagMatched[1],
      indices: [hashtagMatched.index, HASHTAG_REGEX.lastIndex]
    });
  }

  return hashtags;
};

var parseUrlsFromText = function parseUrlsFromText(text) {
  var URL_REGEX = urlRegex();

  var urls = [];
  var urlMatched = void 0;
  while ((urlMatched = URL_REGEX.exec(text)) !== null) {
    urls.push({
      url: urlMatched[0],
      indices: [urlMatched.index, URL_REGEX.lastIndex]
    });
  }

  return urls;
};

var parseTweet = function parseTweet($, element) {
  var _untouchedText = $(element).find('.tweet-text').first().text();

  var screenName = parseText($, $(element).find('.user-info .username'));
  var avatar = $(element).find('.avatar img').attr('src');
  var name = parseText($, $(element).find('.fullname'));
  var url = 'https://twitter.com' + ($(element).attr('href') || $(element).find('.action-last a').attr('href').replace('/actions', ''));
  var id = $(element).find('.tweet-text').first().attr('data-id');
  var text = parseText($, $(element).find('.tweet-text').first());
  var images = parseImages($, element);

  var userMentions = parseUsernamesFromText(_untouchedText);
  var hashtags = parseHashtagsFromText(_untouchedText);
  var urls = parseUrlsFromText(_untouchedText);

  debug(screenName + ' tweeted ' + id + (userMentions.length ? ' @ ' + userMentions.join(' ') : '') + ': ' + text);

  var isReplyTo = $(element).attr('data-is-reply-to') === 'true' || $(element).attr('data-has-parent-tweet') === 'true';
  var isPinned = $(element).hasClass('user-pinned');
  var isRetweet = $(element).find('.js-retweet-text').length !== 0;
  // const time = fromUnixEpochToISO8601(
  //   $(element)
  //     .find('.js-short-timestamp')
  //     .first()
  //     .attr('data-time-ms')
  // )

  var replyCount = parseActionCount($, element, 'reply');
  var retweetCount = parseActionCount($, element, 'retweet');
  var favoriteCount = parseActionCount($, element, 'favorite');
  var shillPoints = replyCount * POINTS_REPLY + favoriteCount * POINTS_LIKE + retweetCount * POINTS_RETWEET;

  debug('tweet ' + id + ' received ' + replyCount + ' replies');
  debug('tweet ' + id + ' received ' + retweetCount + ' retweets');
  debug('tweet ' + id + ' received ' + favoriteCount + ' favorites');
  debug('tweet ' + id + ' received ' + shillPoints + ' shillpoints');

  var quotedTweetElement = $(element).find('.QuoteTweet-innerContainer');
  var quotedScreenName = quotedTweetElement.attr('data-screen-name');
  var quotedId = quotedTweetElement.attr('data-item-id');
  var quotedText = parseText($, quotedTweetElement.find('.tweet-text').first());
  var quote = void 0;
  if (quotedTweetElement.length) {
    debug('tweet ' + id + ' quotes the tweet ' + quotedId + ' by ' + quotedScreenName + ': ' + quotedText);
    quote = {
      screenName: quotedScreenName,
      id: quotedId,
      text: quotedText
    };
  }

  var tweet = {
    screenName: screenName,
    name: name,
    avatar: avatar,
    url: url,
    id: id,
    // time,
    isRetweet: isRetweet,
    isPinned: isPinned,
    isReplyTo: isReplyTo,
    text: text,
    userMentions: userMentions,
    hashtags: hashtags,
    images: images,
    urls: urls,
    replyCount: replyCount,
    retweetCount: retweetCount,
    favoriteCount: favoriteCount,
    shillPoints: shillPoints
  };
  if (quote) {
    tweet.quote = quote;
  }

  debug('tweet found:', tweet);

  return tweet;
};

var toNumber = function toNumber(value) {
  return parseInt((value || '').replace(/[^0-9]/g, '')) || 0;
};

var toTwitterProfile = function toTwitterProfile(_ref) {
  var $ = _ref.$;

  var $canopy = $('.profile');
  var $header = $('.profile-details');
  var $nav = $('.profile-stats');

  var profileImage = $canopy.find('.avatar img').attr('src');
  var screenName = $header.find('.screen-name').first().text();
  var name = parseText($, $header.find('.fullname').first());
  var bio = parseText($, $header.find('.bio > div').first());
  var location = $header.find('.location').first().text().trim();
  var url = $header.find('.url a').first().attr('data-url');
  var tweetCount = toNumber($nav.find('.stat').first().find('.statnum').text());
  var followingCount = toNumber($nav.find('.stat').eq(1).find('.statnum').text());
  var followerCount = toNumber($nav.find('.stat').eq(2).find('.statnum').text());
  var likeCount = toNumber($nav.find('.ProfileNav-item--favorites .ProfileNav-value').first().attr('data-count'));

  var userMentions = parseUsernamesFromText(bio);
  var hashtags = parseHashtagsFromText(bio);
  var urls = parseUrlsFromText(bio);

  var userProfile = {
    screenName: screenName,
    profileImage: profileImage,
    name: name,
    bio: bio,
    userMentions: userMentions,
    hashtags: hashtags,
    urls: urls,
    location: location,
    url: url,
    tweetCount: tweetCount,
    followingCount: followingCount,
    followerCount: followerCount,
    likeCount: likeCount
  };

  debug('user profile found:', userProfile);

  return userProfile;
};

var parseConnection = function parseConnection($, connectionElement) {
  var $c = $(connectionElement);

  var screenName = $c.find('.ProfileCard-screenname span').text().trim();
  var profileImage = $c.find('.ProfileCard-avatarImage').attr('src');
  var name = $c.find('.ProfileNameTruncated-link').text().trim();
  var bio = $c.find('.ProfileCard-bio').text().trim();

  var userMentions = parseUsernamesFromText(bio);
  var hashtags = parseHashtagsFromText(bio);
  var urls = parseUrlsFromText(bio);

  var userConnection = {
    screenName: screenName,
    profileImage: profileImage,
    name: name,
    bio: bio,
    userMentions: userMentions,
    hashtags: hashtags,
    urls: urls
  };

  debug('user connection found:', userConnection);

  return userConnection;
};

var toConnections = function toConnections(_ref2) {
  var $ = _ref2.$,
      _minPosition = _ref2._minPosition;

  var min = _minPosition || $('.GridTimeline-items').attr('data-min-position');

  var MATCH_CONNECTIONS_ONLY = '.ProfileCard';
  var connections = $(MATCH_CONNECTIONS_ONLY).toArray().map(function (connectionElement) {
    return parseConnection($, connectionElement);
  });

  connections._minPosition = min;

  return connections;
};

var toTweets = function toTweets(_ref3) {
  var $ = _ref3.$;

  var MATCH_TWEETS_ONLY = '.tweet:not(.modal-body)';
  return $(MATCH_TWEETS_ONLY).toArray().map(function (tweetElement) {
    return parseTweet($, tweetElement);
  });
};

var toThreadedTweets = function toThreadedTweets(id) {
  return function (_ref4) {
    var $ = _ref4.$,
        _minPosition = _ref4._minPosition;

    var MATCH_STREAM_CONTAINER = '.stream-container';
    var MATCH_ANCESTOR_TWEETS_ONLY = '.permalink-ancestor-tweet';
    var MATCH_PERMALINK_TWEET_ONLY = '.tweet-detail';
    var MATCH_THREADS = '.replies .tweet';
    var MATCH_SHOW_MORE = '.metadata a';
    var MATCH_TWEETS_ONLY = '.tweet';

    var streamContainerElement = $(MATCH_STREAM_CONTAINER);
    var minPosition = _minPosition || streamContainerElement.attr('data-min-position');

    var ancestorTweetElements = $(MATCH_ANCESTOR_TWEETS_ONLY).toArray();

    var lastAncestorTweetId = void 0;
    var ancestorTweets = [];
    ancestorTweetElements.forEach(function (tweetElement, index) {
      var tweet = _extends({}, parseTweet($, tweetElement), {
        isReplyToId: lastAncestorTweetId
      });
      ancestorTweets.push(tweet);
      lastAncestorTweetId = tweet.id;
    });

    var parentTweetElement = $(MATCH_PERMALINK_TWEET_ONLY).first();
    var parentTweet = parentTweetElement.length ? _extends({}, parseTweet($, parentTweetElement), { isReplyToId: lastAncestorTweetId }) : null;

    var threadElements = $(MATCH_THREADS).toArray();
    var threadedConversations = threadElements.map(function (threadedConversationElement) {
      var showMoreElement = $(threadedConversationElement).find(MATCH_SHOW_MORE).first();
      var showMoreId = showMoreElement.attr('href') ? showMoreElement.attr('href').match(/\d+/).pop() : undefined;
      var tweetElements = $(threadedConversationElement)
      // .find(MATCH_TWEETS_ONLY)
      .toArray();

      var lastTweetId = id;
      var tweets = [];
      tweetElements.forEach(function (tweetElement, index) {
        var _showMoreTweetsFromConversation = index === tweetElements.length - 1 && showMoreId ? showMoreId : undefined;
        var tweet = _extends({}, parseTweet($, tweetElement), {
          isReplyToId: lastTweetId,
          _showMoreTweetsFromConversation: _showMoreTweetsFromConversation
        });
        tweets.push(tweet);
        lastTweetId = tweet.id;
      });

      return tweets;
    });
    var childTweets = flatten(threadedConversations);

    var tweets = parentTweet ? [].concat(ancestorTweets, [parentTweet], _toConsumableArray(childTweets)) : childTweets;
    tweets.minPosition = minPosition;

    return tweets;
  };
};

module.exports.toTwitterProfile = toTwitterProfile;
module.exports.toConnections = toConnections;
module.exports.toTweets = toTweets;
module.exports.toThreadedTweets = toThreadedTweets;