import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt } from 'azle';
import { v4 as uuidv4 } from 'uuid';


let tweetCache = new Map<string, Tweet>();
type Tweet = Record<{
    id: string;
    content: string;
    username: string;
    likes: number;
    comments: Vec<Comment>;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
}>

function validateTweetPayload(payload: TweetPayload): boolean {
  if (payload.content.length > 280) return false;
  return true;
}

type Comment = Record<{
    id: string;
    content: string;
    username: string;
    createdAt: nat64;
}>

type CommentPayload = Record<{
    content: string;
    username: string;
}>

type TweetPayload = Record<{
    content: string;
    username: string;
}>

const tweetStorage = new StableBTreeMap<string, Tweet>(0, 44, 1024);

$query;
export function getTweet(id: string): Result<Tweet, string> {
    if (tweetCache.has(id)) {
      return Result.Ok(tweetCache.get(id));
    }
    const tweet = tweetStorage.get(id);
    if (tweet.isSome()) {
      tweetCache.set(id, tweet.unwrap());
      return Result.Ok(tweet.unwrap());
    }
    return match(tweetStorage.get(id), {
        Some: (tweet) => Result.Ok<Tweet, string>(tweet),
        None: () => Result.Err<Tweet, string>(`Tweet with id=${id} not found`)
    });
}

$query;
export function getAllTweets(): Result<Vec<Tweet>, string> {
    return Result.Ok(tweetStorage.values());
}

$update;
export function postTweet(payload: TweetPayload): Result<Tweet, string> {
    if (!validateTweetPayload(payload)) {
      return Result.Err<Tweet, string>("Invalid tweet payload");
    }
      
    const tweet: Tweet = {
        id: uuidv4(),
        content: payload.content,
        username: payload.username,
        likes: 0,
        comments: [],
        createdAt: ic.time(),
        updatedAt: Opt.None
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
        None: () => Result.Err<Tweet, string>(`Tweet with id=${id} not found`)
    });
}

$update;
export function deleteTweet(id: string): Result<Tweet, string> {
    return match(tweetStorage.remove(id),{
        Some: (delete_tweet) => Result.Ok<Tweet, string>(delete_tweet),
        None: () => Result.Err<Tweet, string>(`Cannot Delete this Tweet id=${id}.`)
    })
}

$update;
export function addComment(tweetId: string, payload: CommentPayload): Result<Tweet, string> {
    return match(tweetStorage.get(tweetId), {
        Some: (tweet) => {
            const comment: Comment = {
                id: uuidv4(),
                content: payload.content,
                username: payload.username,
                createdAt: ic.time()
            };
            const updatedTweet: Tweet = { ...tweet, comments: [...tweet.comments, comment] };
            tweetStorage.insert(tweet.id, updatedTweet);
            return Result.Ok<Tweet, string>(updatedTweet);
        },
        None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`)
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
        None: () => Result.Err<Tweet, string>(`Tweet with id=${tweetId} not found`)
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
    }
};
