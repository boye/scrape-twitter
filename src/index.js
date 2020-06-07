const TimelineStream = require('./lib/timeline-stream')
const MediaTimelineStream = require('./lib/media-stream')
const ConversationStream = require('./lib/conversation-stream')
const ThreadedConversationStream = require('./lib/threaded-conversation-stream')
const TweetStream = require('./lib/tweet-stream')
const ListStream = require('./lib/list-stream')
const LikeStream = require('./lib/like-stream')
const ConnectionStream = require('./lib/connection-stream')
const twitterQuery = require('./lib/twitter-query')
const getUserProfile = twitterQuery.getUserProfile
const getUserConversation = twitterQuery.getUserConversation

module.exports = {
  TimelineStream,
  MediaTimelineStream,
  ConversationStream,
  ThreadedConversationStream,
  TweetStream,
  ListStream,
  LikeStream,
  ConnectionStream,
  twitterQuery,
  getUserConversation,
  getUserProfile
}
