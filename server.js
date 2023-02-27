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

const persistentSchema = new mongoose.Schema(
  {
    authStatus: Boolean,
    author: String,
    selector: Number
  }
)

const Persistent = new mongoose.model("Persistent", persistentSchema);

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.SERVER_URL + "/handleGoogleRedirect" // server redirect url handler
);

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

      console.log("voltou");

      Persistent.updateOne({selector: 1}, { authStatus: true }, (err, result) => {
        console.log(result, "res");
      });
  
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
  Persistent.findOne({selector: 1}, (err, foundOne) => {
    if(err){
      console.log(err);
    } else{
      console.log(foundOne.authStatus, "authStatus for checking");
      res.send(foundOne.authStatus);
    }
  });
});

app.post("/revokeAuthLink", (req, res) => {
  console.log("se foi 1");
  if(req.body.auth === "revoke"){
    console.log("se foi 2");
    Persistent.updateOne({selector: 1}, {authStatus: false}, (err, result) => {
      if(!err){
        console.log("se foi 3");
      }
    });
  }
});

app.route("/")
    .get((req, res) => {
      Persistent.updateOne({selector: 1}, { author: req.query.author }, (err, result) => {
        Note.find({author: {$eq: req.query.author}}, (err, foundNotes) => {
          if(!err){
              res.json(foundNotes);
          }    
        });
      });
    })
    .post((req, res) => {
      Persistent.findOne({selector: 1}, (err, foundOne) => {
        console.log(foundOne, "foundone");
        console.log(foundOne.author, "author");
        if(err){
          console.log(err);
        } else{
          Note.deleteMany({author: foundOne.author}, (err) => {
            if(!err){
              Note.insertMany(req.body);
            } else {
              console.log(err);
            }
          });
        }
      });
    });

app.listen(8000, function(){
    console.log("Server running on port 8000.");
});