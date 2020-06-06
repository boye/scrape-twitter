const urlRegex = require('url-regex')

const debug = require('debug')('scrape-twitter:parser')

const POINTS_REPLY = 1
const POINTS_LIKE = 2
const POINTS_RETWEET = 3

const flatten = arr => arr.reduce((prev, curr) => prev.concat(curr), [])

const parseText = ($, textElement) => {
  // Replace each emoji image with the actual emoji unicode
  textElement.find('img.Emoji, img.twitter-emoji').each((i, emoji) => {
    const alt = $(emoji).attr('alt')
    return $(emoji).html(alt)
  })

  // Remove hidden URLS
  textElement.find('a.u-hidden').remove()

  return textElement.text().replace(/(\r\n|\n|\r)/gm, '').trim()
}

const parseActionCount = ($, element, action) => {
  const wrapper = $(element).find(
    `.ProfileTweet-action--${action} .ProfileTweet-actionCount`
  )
  return wrapper.length !== 0
    ? +$(wrapper)
        .first()
        .attr('data-tweet-stat-count')
    : 0
}

const parseImages = ($, element) => {
  const pics = $(element)
    .find(
      `
    .multi-photos .multi-photo[data-image-url],
    [data-card-type=photo] [data-image-url],
    .AdaptiveMedia-photoContainer[data-image-url]
  `
    )
    .toArray()
  const images = []
  for (const pic of pics) {
    images.push($(pic).attr('data-image-url'))
  }
  return images
}

const parseUsernamesFromText = text => {
  // NOTE: Currently this will match `someText@username@anotherUsername@someOtherUserName`
  //       but it should not.
  const USERNAME_REGEX = /@(\w+)/g

  const toUsernames = []
  let usernameMatched
  while ((usernameMatched = USERNAME_REGEX.exec(text)) !== null) {
    toUsernames.push({
      screenName: usernameMatched[1],
      indices: [usernameMatched.index, USERNAME_REGEX.lastIndex]
    })
  }

  return toUsernames
}

const parseHashtagsFromText = text => {
  // NOTE: Currently this will match `someText#hashtag#anotherHashtag#someOtherHashtag`
  //       but it should not.
  const HASHTAG_REGEX = /#(\w+)/g

  const hashtags = []
  let hashtagMatched
  while ((hashtagMatched = HASHTAG_REGEX.exec(text)) !== null) {
    hashtags.push({
      hashtag: hashtagMatched[1],
      indices: [hashtagMatched.index, HASHTAG_REGEX.lastIndex]
    })
  }

  return hashtags
}

const parseUrlsFromText = text => {
  const URL_REGEX = urlRegex()

  const urls = []
  let urlMatched
  while ((urlMatched = URL_REGEX.exec(text)) !== null) {
    urls.push({
      url: urlMatched[0],
      indices: [urlMatched.index, URL_REGEX.lastIndex]
    })
  }

  return urls
}

const parseTweet = ($, element) => {
  const _untouchedText = $(element)
    .find('.tweet-text')
    .first()
    .text()

  const screenName = parseText($, $(element).find('.user-info .username'))
  const avatar = $(element)
    .find('.avatar img')
    .attr('src')
  const name = parseText($, $(element).find('.fullname'))
  const url = `https://twitter.com${$(element).attr('href') || $(element).find('.action-last a').attr('href').replace('/actions', '')}`
  const id = $(element).find('.tweet-text').first().attr('data-id')
  const text = parseText(
    $,
    $(element)
      .find('.tweet-text')
      .first()
  )
  const images = parseImages($, element)

  const userMentions = parseUsernamesFromText(_untouchedText)
  const hashtags = parseHashtagsFromText(_untouchedText)
  const urls = parseUrlsFromText(_untouchedText)

  debug(
    `${screenName} tweeted ${id}${
      userMentions.length ? ` @ ${userMentions.join(' ')}` : ''
    }: ${text}`
  )

  const isReplyTo =
    $(element).attr('data-is-reply-to') === 'true' ||
    $(element).attr('data-has-parent-tweet') === 'true'
  const isPinned = $(element).hasClass('user-pinned')
  const isRetweet = $(element).find('.js-retweet-text').length !== 0
  // const time = fromUnixEpochToISO8601(
  //   $(element)
  //     .find('.js-short-timestamp')
  //     .first()
  //     .attr('data-time-ms')
  // )

  const replyCount = parseActionCount($, element, 'reply')
  const retweetCount = parseActionCount($, element, 'retweet')
  const favoriteCount = parseActionCount($, element, 'favorite')
  const shillPoints =
    (replyCount * POINTS_REPLY) +
    (favoriteCount * POINTS_LIKE) +
    (retweetCount * POINTS_RETWEET)

  debug(`tweet ${id} received ${replyCount} replies`)
  debug(`tweet ${id} received ${retweetCount} retweets`)
  debug(`tweet ${id} received ${favoriteCount} favorites`)
  debug(`tweet ${id} received ${shillPoints} shillpoints`)

  const quotedTweetElement = $(element).find('.QuoteTweet-innerContainer')
  const quotedScreenName = quotedTweetElement.attr('data-screen-name')
  const quotedId = quotedTweetElement.attr('data-item-id')
  const quotedText = parseText(
    $,
    quotedTweetElement.find('.tweet-text').first()
  )
  let quote
  if (quotedTweetElement.length) {
    debug(
      `tweet ${id} quotes the tweet ${quotedId} by ${quotedScreenName}: ${quotedText}`
    )
    quote = {
      screenName: quotedScreenName,
      id: quotedId,
      text: quotedText
    }
  }

  const tweet = {
    screenName,
    name,
    avatar,
    url,
    id,
    // time,
    isRetweet,
    isPinned,
    isReplyTo,
    text,
    userMentions,
    hashtags,
    images,
    urls,
    replyCount,
    retweetCount,
    favoriteCount,
    shillPoints
  }
  if (quote) {
    tweet.quote = quote
  }

  debug('tweet found:', tweet)

  return tweet
}

const toNumber = value => parseInt((value || '').replace(/[^0-9]/g, '')) || 0

const toTwitterProfile = ({ $ }) => {
  const $canopy = $('.profile')
  const $header = $('.profile-details')
  const $nav = $('.profile-stats')

  const profileImage = $canopy.find('.avatar img').attr('src')
  const screenName = $header
    .find('.screen-name')
    .first()
    .text()
  const name = parseText($, $header.find('.fullname').first())
  const bio = parseText($, $header.find('.bio > div').first())
  const location = $header
    .find('.location')
    .first()
    .text()
    .trim()
  const url = $header
    .find('.url a')
    .first()
    .attr('data-url')
  const tweetCount = toNumber(
    $nav
      .find('.stat')
      .first()
      .find('.statnum')
      .text()
  )
  const followingCount = toNumber(
    $nav
      .find('.stat')
      .eq(1)
      .find('.statnum')
      .text()
  )
  const followerCount = toNumber(
    $nav
      .find('.stat')
      .eq(2)
      .find('.statnum')
      .text()
  )
  const likeCount = toNumber(
    $nav
      .find('.ProfileNav-item--favorites .ProfileNav-value')
      .first()
      .attr('data-count')
  )

  const userMentions = parseUsernamesFromText(bio)
  const hashtags = parseHashtagsFromText(bio)
  const urls = parseUrlsFromText(bio)

  const userProfile = {
    screenName,
    profileImage,
    name,
    bio,
    userMentions,
    hashtags,
    urls,
    location,
    url,
    tweetCount,
    followingCount,
    followerCount,
    likeCount
  }

  debug('user profile found:', userProfile)

  return userProfile
}

const parseConnection = ($, connectionElement) => {
  const $c = $(connectionElement)

  const screenName = $c
    .find('.ProfileCard-screenname span')
    .text()
    .trim()
  const profileImage = $c.find('.ProfileCard-avatarImage').attr('src')
  const name = $c
    .find('.ProfileNameTruncated-link')
    .text()
    .trim()
  const bio = $c
    .find('.ProfileCard-bio')
    .text()
    .trim()

  const userMentions = parseUsernamesFromText(bio)
  const hashtags = parseHashtagsFromText(bio)
  const urls = parseUrlsFromText(bio)

  const userConnection = {
    screenName,
    profileImage,
    name,
    bio,
    userMentions,
    hashtags,
    urls
  }

  debug('user connection found:', userConnection)

  return userConnection
}

const toConnections = ({ $, _minPosition }) => {
  const min = _minPosition || $('.GridTimeline-items').attr('data-min-position')

  const MATCH_CONNECTIONS_ONLY = '.ProfileCard'
  const connections = $(MATCH_CONNECTIONS_ONLY)
    .toArray()
    .map(connectionElement => parseConnection($, connectionElement))

  connections._minPosition = min

  return connections
}

const toTweets = ({ $ }) => {
  const MATCH_TWEETS_ONLY = '.tweet:not(.modal-body)'
  return $(MATCH_TWEETS_ONLY)
    .toArray()
    .map(tweetElement => parseTweet($, tweetElement))
}

const toThreadedTweets = id => ({ $, _minPosition }) => {
  const MATCH_STREAM_CONTAINER = '.stream-container'
  const MATCH_ANCESTOR_TWEETS_ONLY = '.permalink-ancestor-tweet'
  const MATCH_PERMALINK_TWEET_ONLY = '.tweet-detail'
  const MATCH_THREADS = '.replies .tweet'
  const MATCH_SHOW_MORE = '.metadata a'
  const MATCH_TWEETS_ONLY = '.tweet'

  const streamContainerElement = $(MATCH_STREAM_CONTAINER)
  const minPosition =
    _minPosition || streamContainerElement.attr('data-min-position')

  const ancestorTweetElements = $(MATCH_ANCESTOR_TWEETS_ONLY).toArray()

  let lastAncestorTweetId
  const ancestorTweets = []
  ancestorTweetElements.forEach((tweetElement, index) => {
    const tweet = {
      ...parseTweet($, tweetElement),
      isReplyToId: lastAncestorTweetId
    }
    ancestorTweets.push(tweet)
    lastAncestorTweetId = tweet.id
  })

  const parentTweetElement = $(MATCH_PERMALINK_TWEET_ONLY).first()
  const parentTweet = parentTweetElement.length
    ? { ...parseTweet($, parentTweetElement), isReplyToId: lastAncestorTweetId }
    : null

  const threadElements = $(MATCH_THREADS).toArray()
  const threadedConversations = threadElements.map(
    threadedConversationElement => {
      const showMoreElement = $(threadedConversationElement)
        .find(MATCH_SHOW_MORE)
        .first()
      const showMoreId = showMoreElement.attr('href')
        ? showMoreElement
            .attr('href')
            .match(/\d+/)
            .pop()
        : undefined
      const tweetElements = $(threadedConversationElement)
        // .find(MATCH_TWEETS_ONLY)
        .toArray()

      let lastTweetId = id
      let tweets = []
      tweetElements.forEach((tweetElement, index) => {
        const _showMoreTweetsFromConversation =
          index === tweetElements.length - 1 && showMoreId
            ? showMoreId
            : undefined
        const tweet = {
          ...parseTweet($, tweetElement),
          isReplyToId: lastTweetId,
          _showMoreTweetsFromConversation
        }
        tweets.push(tweet)
        lastTweetId = tweet.id
      })

      return tweets
    }
  )
  const childTweets = flatten(threadedConversations)

  const tweets = parentTweet
    ? [...ancestorTweets, parentTweet, ...childTweets]
    : childTweets
  tweets.minPosition = minPosition

  return tweets
}

module.exports.toTwitterProfile = toTwitterProfile
module.exports.toConnections = toConnections
module.exports.toTweets = toTweets
module.exports.toThreadedTweets = toThreadedTweets
