import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
  Opt,
} from 'azle';
import { v4 as uuidv4 } from 'uuid';

type Tweet = Record<{
  id: string;
  content: string;
  username: string;
  likes: number;
  comments: Vec<Comment>;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type Comment = Record<{
  id: string;
  content: string;
  username: string;
  createdAt: nat64;
}>;

type CommentPayload = Record<{
  content: string;
  username: string;
}>;

type TweetPayload = Record<{
  content: string;
  username: string;
}>;

const tweetStorage = new StableBTreeMap<string, Tweet>(0, 44, 1024);

$query;
export function getTweet(id: string): Result<Tweet, string> {
  return match(tweetStorage.get(id), {
    Some: (tweet) => Result.Ok<Tweet, string>(tweet),
    None: () => Result.Err<Tweet, string>(`Tweet with id=${id} not found`),
  });
}

$query;
export function getAllTweets(): Result<Vec<Tweet>, string> {
  return Result.Ok(tweetStorage.values());
}

$update;
export function postTweet(payload: TweetPayload): Result<Tweet, string> {
  const tweet: Tweet = {
    id: uuidv4(),
    content: payload.content,
    username: payload.username,
    likes: 0,
    comments: [],
    createdAt: ic.time(),
    updatedAt: Opt.None,
  };
  tweetStorage.insert(tweet.id, tweet);
  return Result.Ok(tweet);
}

$update;
export function editTweet(id: string, content: string): Result<Tweet, string> {
  return match(tweetStorage.get(id), {
    Some: (tweet) => {
      const updatedTweet: Tweet = { ...tweet, content, updatedAt: Opt.Some(ic.time()) };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${id} not found`),
  });
}

$update;
export function deleteTweet(id: string): Result<Tweet, string> {
  return match(tweetStorage.remove(id), {
    Some: (delete_tweet) => Result.Ok<Tweet, string>(delete_tweet),
    None: () => Result.Err<Tweet, string>(`Cannot Delete this Tweet id=${id}.`),
  });
}

$update;
export function addComment(tweetId: string, payload: CommentPayload): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      const comment: Comment = {
        id: uuidv4(),
        content: payload.content,
        username: payload.username,
        createdAt: ic.time(),
      };
      const updatedTweet: Tweet = { ...tweet, comments: [...tweet.comments, comment] };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

$update;
export function addLike(tweetId: string): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      const updatedTweet: Tweet = { ...tweet, likes: tweet.likes + 1 };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

$update;
export function removeLike(tweetId: string): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      if (tweet.likes > 0) {
        const updatedTweet: Tweet = { ...tweet, likes: tweet.likes - 1 };
        tweetStorage.insert(tweet.id, updatedTweet);
        return Result.Ok<Tweet, string>(updatedTweet);
      } else {
        return Result.Err<Tweet, string>(`Tweet with id=${tweetId} has no likes to remove.`);
      }
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

$update;
export function deleteComment(tweetId: string, commentId: string): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      const updatedComments = tweet.comments.filter((comment) => comment.id !== commentId);
      if (updatedComments.length === tweet.comments.length) {
        return Result.Err<Tweet, string>(`Comment with id=${commentId} not found in the tweet.`);
      }
      const updatedTweet: Tweet = { ...tweet, comments: updatedComments };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

$update;
export function retweetTweet(tweetId: string, username: string): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      const retweetContent = `RT @${tweet.username}: ${tweet.content}`;
      const retweet: Tweet = {
        id: uuidv4(),
        content: retweetContent,
        username: username,
        likes: 0,
        comments: [],
        createdAt: ic.time(),
        updatedAt: Opt.None,
      };
      tweetStorage.insert(retweet.id, retweet);
      return Result.Ok<Tweet, string>(retweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

// a workaround to make uuid package work with Azle
globalThis.crypto = {
  //@ts-ignore
  getRandomValues: () => {
    let array = new Uint8Array(32);

    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }

    return array;
  },
};
