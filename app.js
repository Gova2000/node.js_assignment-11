const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
const path = require("path");
const jwt = require("jsonwebtoken");
let db = null;
const pathFix = path.join(__dirname, "twitterClone.db");
const initialize = async () => {
  try {
    db = await open({
      filename: pathFix,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB ERROR ${e.message}`);
    process.exit(-1);
  }
};

initialize();

const authenticateJwtToken = async (request, response, next) => {
  let jwtToken;
  let ahead = request.headers["authorization"];
  if (ahead !== undefined) {
    jwtToken = ahead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        response.username = payload.username;
        next();
      }
    });
  }
};

//API-1 user exits or not if not create new user
app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  const hashPassword = await bcrypt.hash(password, 10);
  const check = `
    select*from
    user
    where
    username='${username}';`;
  const user = await db.get(check);
  if (user === undefined) {
    const create = `
        INSERT INTO 
        user ( username, password,name, gender)
        values
        (
            '${username}',
            '${hashPassword}',
            '${name}',
            '${gender}'
        );`;
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const newUser = await db.run(create);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API-2 login check
app.post("/login/", authenticateJwtToken, async (request, response) => {
  const { username, password } = request.body;
  const check = `
    select*from
    user
    where
    username='${username}';`;
  const user = await db.get(check);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const Matched = await bcrypt.compare(password, user.password);
    if (Matched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-3 latest tweets
app.get("/user/tweets/feed/", async (request, response) => {
  const getTweets = `
    SELECT username,tweet,date_time as dateTime
    FROM 
    user INNER JOIN tweet ON user.user_id=tweet.user_id
    ORDER BY
    tweet_id DESC
    LIMIT 4 
    OFFSET 1;`;
  const latest = await db.all(getTweets);
  response.send(latest);
});

//API-4 return all names user follows
app.get("/user/following/", async (request, response) => {
  const check = `
    select name from
    user
    ;`;
  const getUser = await db.all(check);
  response.send(getUser);
});

//API-5 get names people who follows user
app.get("/user/followers/", async (request, response) => {
  const check = `
    select name from
    user
    ;`;
  const getUser = await db.all(check);
  response.send(getUser);
});

//API-6 request user for tweet scenarios
app.get("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const getTweetDetails = `
    select tweet,sum(like_id)as likes,sum(reply_id)as replies,date_time as dateTime
    from (like natural join reply ) as T natural  join tweet
    where 
    tweet_id=${tweetId}
    group by
    user_id,tweet;`;
  const getTwe = await db.get(getTweetDetails);
  if (getTwe === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send(getTwe);
  }
});

//API-7 get liked names
app.get("/tweets/:tweetId/likes/", async (request, response) => {
  const { tweetId } = request.params;
  const getTweetDetails = `
    select user.name
    from like natural join user 
    where 
    tweet_id=${tweetId}
    group by
    like_id,tweet_id;`;
  const getTwe = await db.all(getTweetDetails);
  if (getTwe === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send({ likes: getTwe });
  }
});

//API-8
app.get("/tweets/:tweetId/replies/", async (request, response) => {
  const { tweetId } = request.params;
  const getTweetDetails = `
    select user.name,reply
    from reply natural join user 
    where 
    tweet_id=${tweetId}
    group by
    user_id,tweet_id;`;
  const getTwe = await db.all(getTweetDetails);
  if (getTwe === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send({ replies: getTwe });
  }
});

//API-9 get all list of tweets

app.get("/user/tweets/", async (request, response) => {
  const getTweetDetails = `
    select tweet,sum(like_id)as likes,sum(reply_id)as replies,date_time as dateTime
    from (like natural join reply ) as T natural  join tweet
    
    group by
    user_id,tweet;`;
  const getTwe = await db.all(getTweetDetails);
  if (getTwe === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send(getTwe);
  }
});

//API-10 create new tweet
app.post("/user/tweets/", async (request, response) => {
  const { tweet } = request.body;
  const getTweetDetails = `
    INSERT INTO tweet (tweet)
    values 
        ('${tweet}')
    
    ;`;
  const getTwe = await db.run(getTweetDetails);

  response.status(200);
  response.send("Created a Tweet");
});

//API-11 Delete a tweet
app.delete("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const dltTweet = `
    DELETE from
    tweet
    where 
    tweet_id=${tweetId};`;
  const DLT = await db.run(dltTweet);
  if (DLT === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.status(200);
    response.send("Tweet Removed");
  }
});

module.exports = app;