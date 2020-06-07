'use strict';

var TimelineStream = require('./lib/timeline-stream');
var MediaTimelineStream = require('./lib/media-stream');
var ConversationStream = require('./lib/conversation-stream');
var ThreadedConversationStream = require('./lib/threaded-conversation-stream');
var TweetStream = require('./lib/tweet-stream');
var ListStream = require('./lib/list-stream');
var LikeStream = require('./lib/like-stream');
var ConnectionStream = require('./lib/connection-stream');
var twitterQuery = require('./lib/twitter-query');
var getUserProfile = twitterQuery.getUserProfile;
var getUserConversation = twitterQuery.getUserConversation;

module.exports = {
  TimelineStream: TimelineStream,
  MediaTimelineStream: MediaTimelineStream,
  ConversationStream: ConversationStream,
  ThreadedConversationStream: ThreadedConversationStream,
  TweetStream: TweetStream,
  ListStream: ListStream,
  LikeStream: LikeStream,
  ConnectionStream: ConnectionStream,
  twitterQuery: twitterQuery,
  getUserConversation: getUserConversation,
  getUserProfile: getUserProfile
};