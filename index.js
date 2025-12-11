const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const cors = require("cors");
app.use(cors());

app.use(express.json());
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI;

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {


        const userDB = client.db("ClubSphere");
    const Collection1 = userDB.collection("user");
    const Collection2 = userDB.collection("admin");
    const Collection3 = userDB.collection("clubs");


      app.post("/user", async (req, res) => {
      const ourData = req.body;
      const result = await Collection1.insertOne(ourData);
      res.send(result);
    });


    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);
