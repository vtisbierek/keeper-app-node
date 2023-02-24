const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({extended: true}));

mongoose.set('strictQuery', false); 
mongoose.connect("mongodb://127.0.0.1:27017/keeperDB", {useNewUrlParser: true}, () => {
    console.log("Connected to KeeperDB");
});

const noteSchema = new mongoose.Schema(
    {
        title: String,
        content: String
    }
)

const Note = new mongoose.model("Note", noteSchema);


app.route("/")
    .get((req, res) => {
        Note.find({}, (err, foundNotes) => {
            if(!err){
                res.json(foundNotes);
            }    
        })

        //res.json({ title: "Hello Jung-Hyun!", content: "I love you!" });
    })
    .post((req, res) => {
        Note.deleteMany({}, err => {
            if(!err){
                Note.insertMany(req.body);
                console.log(req.body);
                console.log("yo");
            } else {
                console.log(err);
            }
        });
    });

app.listen(8000, function(){
    console.log("Server running on port 8000.");
});