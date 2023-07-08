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
  Principal,
} from "azle";
import { v4 as uuidv4 } from "uuid";

type Tweet = Record<{
  id: string;
  owner: Principal;
  content: string;
  username: string;
  likes: number;
  liked: Vec<string>;
  comments: Vec<Comment>;
  createdAt: nat64;
  updatedAt: Opt<nat64>;
}>;

type Comment = Record<{
  id: string;
  owner: Principal;
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

// Function to fetch a tweet
// returns an error message if tweet with id isn't found
$query;
export function getTweet(id: string): Result<Tweet, string> {
  return match(tweetStorage.get(id), {
    Some: (tweet) => Result.Ok<Tweet, string>(tweet),
    None: () => Result.Err<Tweet, string>(`Tweet with id=${id} not found`),
  });
}
// Function to fetch all tweets
$query;
export function getAllTweets(): Result<Vec<Tweet>, string> {
  return Result.Ok(tweetStorage.values());
}

// Function that allows users to post tweets
$update;
export function postTweet(payload: TweetPayload): Result<Tweet, string> {
  const tweet: Tweet = {
    id: uuidv4(),
    owner: ic.caller(),
    content: payload.content,
    username: payload.username,
    likes: 0,
    liked: [],
    comments: [],
    createdAt: ic.time(),
    updatedAt: Opt.None,
  };
  tweetStorage.insert(tweet.id, tweet);
  return Result.Ok(tweet);
}

// Function that allows the author/owner of a tweet to edit the tweet
$update;
export function editTweet(id: string, content: string): Result<Tweet, string> {
  return match(tweetStorage.get(id), {
    Some: (tweet) => {
      // if caller isn't the tweet's owner, return an error
      if (tweet.owner.toString() !== ic.caller().toString()) {
        return Result.Err<Tweet, string>("You are not the tweet's owner");
      }
      const updatedTweet: Tweet = {
        ...tweet,
        content,
        updatedAt: Opt.Some(ic.time()),
      };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${id} not found`),
  });
}
// Function that allows the author/owner of a tweet to delete the tweet
$update;
export function deleteTweet(id: string): Result<Tweet, string> {
  return match(tweetStorage.get(id), {
    Some: (delete_tweet) => {
      // if caller isn't the tweet's owner, return an error
      if (delete_tweet.owner.toString() !== ic.caller().toString()) {
        return Result.Err<Tweet, string>("You are not the tweet's owner");
      }
      tweetStorage.remove(id);
      return Result.Ok<Tweet, string>(delete_tweet);
    },
    None: () => Result.Err<Tweet, string>(`Cannot Delete this Tweet id=${id}.`),
  });
}
// Function that allows users to comment on a tweet
$update;
export function addComment(
  tweetId: string,
  payload: CommentPayload
): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      const comment: Comment = {
        id: uuidv4(),
        owner: ic.caller(),
        content: payload.content,
        username: payload.username,
        createdAt: ic.time(),
      };
      const updatedTweet: Tweet = {
        ...tweet,
        comments: [...tweet.comments, comment],
      };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

// Function that allows users to like a tweet
$update;
export function addLike(tweetId: string): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      let liked: Vec<string> = tweet.liked;
      // checks if caller has already liked the tweet
      if (liked.includes(ic.caller().toString())) {
        return Result.Err<Tweet, string>(
          `Already liked tweet with id ${tweetId}`
        );
      }
      // add caller to the liked array and increment the likes property by 1
      const updatedTweet: Tweet = {
        ...tweet,
        likes: tweet.likes + 1,
        liked: [...liked, ic.caller().toString()],
      };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

// Function that allows users to dislike a tweet
$update;
export function removeLike(tweetId: string): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      if (tweet.likes > 0) {
        let liked: Vec<string> = tweet.liked;
        const likedIndex = liked.findIndex((user) => ic.caller().toString() === user.toString());
        // checks if caller hasn't liked the tweet
        if (likedIndex === -1) {
          return Result.Err<Tweet, string>(
            `You haven't liked the tweet with id ${tweetId}`
          );
        }
        // removes caller from the liked array
        liked.splice(likedIndex, 1)
        // update the liked array and decrement the likes property by 1
        const updatedTweet: Tweet = { ...tweet, likes: tweet.likes - 1 , liked: liked};
        tweetStorage.insert(tweet.id, updatedTweet);
        return Result.Ok<Tweet, string>(updatedTweet);
      } else {
        return Result.Err<Tweet, string>(
          `Tweet with id=${tweetId} has no likes to remove.`
        );
      }
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

// Function that allows users to delete their comments
$update;
export function deleteComment(
  tweetId: string,
  commentId: string
): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      const updatedComments: Vec<Comment> = tweet.comments;
      const commentIndex = updatedComments.findIndex((comment) => comment.id === commentId);
      // if comment doesn't exist, return an error
      if (commentIndex === -1) {
        return Result.Err<Tweet, string>(
          `Comment with id=${commentId} not found in the tweet.`
        );
      }
      // if caller is not the owner of the comment, return an error
      if(updatedComments[commentIndex].owner.toString() !== ic.caller().toString()){
        return Result.Err<Tweet, string>(`You are not the owner of the comment with id ${commentId}`)
      }
      // remove comment from the updatedComments array
      updatedComments.splice(commentIndex, 1);
      // update the comments array property with the updatedComments array
      const updatedTweet: Tweet = { ...tweet, comments: updatedComments };
      tweetStorage.insert(tweet.id, updatedTweet);
      return Result.Ok<Tweet, string>(updatedTweet);
    },
    None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`),
  });
}

// Function that allows users to retweet a tweet
$update;
export function retweetTweet(
  tweetId: string,
  username: string
): Result<Tweet, string> {
  return match(tweetStorage.get(tweetId), {
    Some: (tweet) => {
      const retweetContent = `RT @${tweet.username}: ${tweet.content}`;
      const retweet: Tweet = {
        id: uuidv4(),
        owner: ic.caller(),
        content: retweetContent,
        username: username,
        likes: 0,
        liked: [],
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
