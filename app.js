const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// const addDays = require("date-fns/addDays");
// const format = require("date-fns/format");

// const test = () => {
//   const q = Date.now();
//   console.log(new Date(q));
// };
// test();

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializingDBandServers = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started listening...");
    });
  } catch (err) {
    console.log(`DB error ${err.message}`);
    process.exit(1);
  }
};
initializingDBandServers();

const authorizationFunction = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        req.username = payload.username;
        next();
      }
    });
  }
};

// API registration
app.post("/register/", async (req, res) => {
  const { username, password, name, gender } = req.body;
  const sqlGetUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponseUser = await db.get(sqlGetUserQuery);

  if (dbResponseUser === undefined) {
    if (password.length < 6) {
      res.status(400);
      res.send("Password is too short");
    } else {
      const encryptPassword = await bcrypt.hash(password, 10);
      const sqlQuery = `
                INSERT INTO
                    user (name, username, password, gender)
                VALUES (
                    '${name}',
                    '${username}',
                    '${encryptPassword}',
                    '${gender}'
                );
            `;
      await db.run(sqlQuery);
      res.send("User created successfully");
    }
  } else {
    res.status(400);
    res.send("User already exists");
  }
});

// API login
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const sqlGetUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbResponseUser = await db.get(sqlGetUserQuery);
  if (dbResponseUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isCorrectPassword = await bcrypt.compare(
      password,
      dbResponseUser.password
    );
    if (isCorrectPassword) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "SECRET_KEY");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

module.exports = app;

// API 3
app.get("/user/tweets/feed/", authorizationFunction, async (req, res) => {
  //   const a = "narendramodi";
  const a = "SrBachchan";
  console.log("working...");
  const sqlQuery = `
          SELECT
              username, tweet, date_time AS dateTime
          FROM (user JOIN follower ON user.user_id = follower.follower_user_id) AS T1
          JOIN tweet ON tweet.user_id = T1.following_user_id
          WHERE user.username = '${req.username}'
          ORDER BY tweet.date_time DESC
          LIMIT 4
          OFFSET 0;
      `;
  const dbResponse = await db.all(sqlQuery);
  res.send(dbResponse);
});

// API 4
app.get("/user/following/", authorizationFunction, async (req, res) => {
  //   const a = "narendramodi";
  const sqlQueryUser = `
                SELECT user_id
                FROM user
                WHERE username = '${req.username}';
            `;
  const dbResponseUser = await db.get(sqlQueryUser);
  //   res.send(dbResponseUser);

  const sqlQuery = `
          SELECT name
          FROM (follower JOIN user ON user.user_id = follower.following_user_id)
          where follower.follower_user_id = '${dbResponseUser.user_id}';
      `;

  const dbres = await db.all(sqlQuery);
  res.send(dbres);
});

// API 5
app.get("/user/followers/", authorizationFunction, async (req, res) => {
  //   const a = "narendramodi";
  const sqlQueryUser = `
                SELECT user_id
                FROM user
                WHERE username = '${req.username}';
            `;
  const dbResponseUser = await db.get(sqlQueryUser);
  //   res.send(dbResponseUser);

  const sqlQuery = `
          SELECT name
          FROM (follower JOIN user ON user.user_id = follower.follower_user_id)
          where follower.following_user_id = '${dbResponseUser.user_id}';
      `;

  const dbres = await db.all(sqlQuery);
  res.send(dbres);
});

// API 6
app.get("/tweets/:tweetId/", authorizationFunction, async (req, res) => {
  const a = "narendramodi";
  const { tweetId } = req.params;
  const sqlQueryTweetIdUser = `
                    SELECT user_id
                    FROM tweet
                    WHERE tweet_id = ${tweetId};
                `;
  const dbResponseUser = await db.get(sqlQueryTweetIdUser);
  //   res.send(dbResponseUser);
  const sqlQueryUserFollowing = `
          SELECT following_user_id
          FROM (follower JOIN user ON user.user_id = follower.follower_user_id)
          where user.username = '${req.username}';
      `;

  const dbres = await db.all(sqlQueryUserFollowing);
  //   res.send(dbres);
  const isFollowing = dbres.find((obj) => {
    if (obj.following_user_id === dbResponseUser.user_id) {
      return obj;
    }
  });
  let finalResult;
  if (isFollowing !== undefined) {
    console.log("working...");
    const sqlQuery = `
            SELECT
                tweet,
                COUNT(like_id) AS likes,
                COUNT(reply_id) AS replies,
                date_time AS dateTime
            FROM (tweet JOIN reply ON tweet.tweet_id = reply.tweet_id) AS T1
            JOIN like ON like.tweet_id = T1.tweet_id
            WHERE tweet.tweet_id = ${tweetId}
            GROUP BY tweet.tweet_id;
        `;
    finalResult = await db.get(sqlQuery);
    res.send(finalResult);
  } else {
    res.status(401);
    res.send("Invalid Request");
  }
});

// API 7
app.get("/tweets/:tweetId/likes/", authorizationFunction, async (req, res) => {
  //   const a = "narendramodi";
  const { tweetId } = req.params;
  //   console.log(req.params);
  const sqlQueryTweetIdUser = `
                      SELECT user_id
                      FROM tweet
                      WHERE tweet_id = ${tweetId};
                  `;
  const dbResponseUser = await db.get(sqlQueryTweetIdUser);
  //   res.send(dbResponseUser);
  const sqlQueryUserFollowing = `
            SELECT following_user_id
            FROM (follower JOIN user ON user.user_id = follower.follower_user_id)
            where user.username = '${req.username}';
        `;

  const dbres = await db.all(sqlQueryUserFollowing);
  //   //   res.send(dbres);
  const isFollowing = dbres.find((obj) => {
    if (obj.following_user_id === dbResponseUser.user_id) {
      return obj;
    }
  });
  let finalResult;
  if (isFollowing !== undefined) {
    console.log("working...");
    const sqlQuery = `
              SELECT
                  name
              FROM  (like JOIN user ON user.user_id = like.user_id)
              WHERE like.tweet_id = ${tweetId};
          `;
    finalResult = await db.all(sqlQuery);
    const result = finalResult.map((obj) => {
      return obj.name;
    });
    res.send({ likes: result });
    console.log(result);
  } else {
    res.status(401);
    res.send("Invalid Request");
  }
});

// API 8
app.get(
  "/tweets/:tweetId/replies/",
  authorizationFunction,
  async (req, res) => {
    const a = "narendramodi";
    const { tweetId } = req.params;
    //   console.log(req.params);
    const sqlQueryTweetIdUser = `
                      SELECT user_id
                      FROM tweet
                      WHERE tweet_id = ${tweetId};
                  `;
    const dbResponseUser = await db.get(sqlQueryTweetIdUser);
    //   res.send(dbResponseUser);
    const sqlQueryUserFollowing = `
            SELECT following_user_id
            FROM (follower JOIN user ON user.user_id = follower.follower_user_id)
            where user.username = '${req.username}';
        `;

    const dbres = await db.all(sqlQueryUserFollowing);
    //   //   res.send(dbres);
    const isFollowing = dbres.find((obj) => {
      if (obj.following_user_id === dbResponseUser.user_id) {
        return obj;
      }
    });
    console.log(isFollowing);
    let finalResult;
    if (isFollowing !== undefined) {
      console.log("working...");
      const sqlQuery = `
              SELECT
                  name, reply
              FROM  (reply JOIN user ON user.user_id = reply.user_id)
              WHERE reply.tweet_id = ${tweetId};
          `;
      finalResult = await db.all(sqlQuery);
      res.send({ reply: finalResult });
      // console.log(result);
    } else {
      res.status(401);
      res.send("Invalid Request");
    }
  }
);

// API 9
app.get("/user/tweets/", authorizationFunction, async (req, res) => {
  //   const a = "narendramodi";
  const sqlQueryUser = `
                SELECT user_id
                FROM user
                WHERE username = '${req.username}';
            `;
  const dbResponseUser = await db.get(sqlQueryUser);
  const sqlQueryUserTweets = `
              SELECT
                tweet,
                COUNT(like_id) as likes,
                COUNT(reply_id) as replies,
                date_time as dateTime
              FROM (tweet join reply on tweet.tweet_id = reply.tweet_id) as T1
              join like on like.tweet_id = T1.tweet_id
              where  tweet.user_id = '${dbResponseUser.user_id}'
              GROUP BY tweet.tweet_id;
          `;
  const r = await db.all(sqlQueryUserTweets);
  console.log(r);
  res.send(r);
});

// API 10
app.post("/user/tweets/", authorizationFunction, async (req, res) => {
  const sqlQueryUser = `
                SELECT user_id
                FROM user
                WHERE username = '${req.username}';
            `;
  const dbResponseUser = await db.get(sqlQueryUser);
  const { tweet } = req.body;
  const sqlQuery = `
        INSERT INTO
            tweet (tweet, user_id, date_time)
        VALUES (
            '${tweet}',
            ${(userId = dbResponseUser.user_id)},
            '${new Date()}'
        );
    `;
  db.run(sqlQuery);
  res.send("Created a Tweet");
});

// API 11
app.delete("/tweets/:tweetId/", authorizationFunction, async (req, res) => {
  //   const a = "narendramodi";
  const { tweetId } = req.params;
  const sqlQueryUser = `
                SELECT tweet_id
                FROM tweet join user on user.user_id = tweet.user_id
                WHERE username = '${req.username}';
            `;
  const dbResponseUser = await db.all(sqlQueryUser);
  console.log(dbResponseUser);
  const isHisTweet = dbResponseUser.find((obj) => {
    console.log(obj.tweet_id, tweetId);
    console.log(typeof obj.tweet_id, typeof tweetId);
    if (obj.tweet_id === parseInt(tweetId)) {
      return obj;
    }
  });
  console.log(isHisTweet);
  if (isHisTweet) {
    const sqlQuery = `
              DELETE
              FROM tweet
              WHERE tweet_id = ${isHisTweet.tweet_id};
        `;
    await db.run(sqlQuery);
    res.send("Tweet Removed");
  } else {
    res.status(401);
    res.send("Invalid Request");
  }
});
