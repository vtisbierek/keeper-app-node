require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const fetch = require("node-fetch");
const { google } = require("googleapis");

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({extended: true}));

mongoose.set('strictQuery', false); 
mongoose.connect(process.env.MONGODB_URL, {useNewUrlParser: true}, () => {
    console.log("Connected to KeeperDB");
});

const noteSchema = new mongoose.Schema(
    {
        title: String,
        content: String,
        author: String
    }
)

const Note = new mongoose.model("Note", noteSchema);

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.SERVER_URL + "/handleGoogleRedirect" // server redirect url handler
);

let userAuth = false;

app.get("/handleGoogleRedirect", async (req, res) => {
    // get code from url
    const code = req.query.code;
    console.log("server 36 | code", code);
    // get access token
    oauth2Client.getToken(code, (err, tokens) => {
      if (err) {
        console.log("server 39 | error", err);
        throw new Error("Issue with Login", err.message);
      }
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;

      userAuth = true;
  
      res.redirect(
        process.env.CLIENT_URL + `?accessToken=${accessToken}&refreshToken=${refreshToken}`
      );
    });
});

app.post("/getValidToken", async (req, res) => {
    try {
      const request = await fetch("https://www.googleapis.com/oauth2/v4/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: req.body.refreshToken,
          grant_type: "refresh_token",
        }),
      });
  
      const data = await request.json();
      console.log("server 74 | data", data.access_token);
  
      res.json({
        accessToken: data.access_token,
      });
    } catch (error) {
      res.json({ error: error.message });
    }
});

app.post("/createAuthLink", cors(), (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile"
      ],
      prompt: "consent",
    });
    res.send({ url });
});

app.get("/checkAuthLink", async (req, res) => {
  res.send(userAuth);
});

app.post("/revokeAuthLink", (req, res) => {
  if(req.body.auth === "revoke"){
    userAuth = false;
  }
});

let author;

app.route("/")
    .get((req, res) => {
        author = req.query.author;
        Note.find({author: {$eq: author}}, (err, foundNotes) => {
            if(!err){
                res.json(foundNotes);
            }    
        })
    })
    .post((req, res) => {
        Note.deleteMany({author: author}, (err) => {
            if(!err){
              Note.insertMany(req.body);
            } else {
              console.log(err);
            }
        });
    });

app.listen(8000, function(){
    console.log("Server running on port 8000.");
});