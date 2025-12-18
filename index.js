const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
app.use(cors());

app.use(express.json());
require("dotenv").config();

// middleware

const admin = require("firebase-admin");
const serviceAccount = require("./private-key.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const privatePath = async (req, res, next) => {
  const token = req.headers.accesstoken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized access" });
  }

  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.userInfoSet = userInfo;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const privatePathSpecificUser = async (req, res, next) => {
  const token = req.headers.accesstoken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized access" });
  }

  try {
    const userInfo = await admin.auth().verifyIdToken(token);

    if (req.params.email !== userInfo.email) {
      return res.status(403).json({ message: "Forbidden" });
    } else {
      req.user = userInfo;
      console.log("user matched, door is open3401");
      console.log("welcome you are", userInfo.name);
      next();
    }
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_KEY);

const uri = process.env.MONGODB_URI;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const userDB = client.db("ClubSphere");
    const Collection1 = userDB.collection("user");
    const Collection2 = userDB.collection("admin");
    const Collection3 = userDB.collection("clubs");
    const Collection4 = userDB.collection("events");
    const Collection5 = userDB.collection("membership");

    app.post("/user", async (req, res) => {
      const ourData = req.body;
      const result = await Collection1.insertOne(ourData);
      res.send(result);
    });

    app.get("/users", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;
      console.log(email);

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;
      console.log(role);

      if (role != "admin") {
        return res.status(403).json({ message: "forbidden" });
      } else {
        console.log("admin detected1");
      }

      const cursor = await Collection1.find({});
      const values = await cursor.toArray();
      res.send(values);
    });

    app.get("/user/:email", privatePathSpecificUser, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      const value = await Collection1.findOne(query);
      res.send(value);
    });

    app.patch("/users/:id", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;
      console.log(email);

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;
      console.log(role);

      if (role != "admin") {
        return res.status(403).json({ message: "forbidden" });
      } else {
        console.log("admin detected2");
      }

      const id = req.params.id;

      const ourUser = req.body;

      const query = { _id: new ObjectId(id) };

      const updatedData1 = {
        $set: {
          role: ourUser.role,
        },
      };

      const options = {};

      const result = await Collection1.updateOne(query, updatedData1, options);
      res.send(result);
    });

    app.post("/clubs", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;
      console.log(email);

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;
      console.log(role);

      if (role != "clubManager") {
        return res.status(403).json({ message: "forbidden" });
      } else {
        console.log("club Manager detected3");
      }

      const ourData = req.body;
      const result = await Collection3.insertOne(ourData);
      res.send(result);
    });

    app.get("/clubCategories", async (req, res) => {
      try {
        const clubs = await Collection3.find({ status: "approved" }).toArray();

        const categories = clubs.map((club) => club.category);

        const uniqueCategories = [...new Set(categories)];

        res.json(uniqueCategories);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.patch("/clubs/:id", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;
        console.log(email);

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;
        console.log(role);

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        } else {
          console.log("club Manager detected10");
        }

        const clubId = req.params.id;
        const updateData = req.body;

        const result = await Collection3.updateOne(
          { _id: new ObjectId(clubId) },
          { $set: updateData }
        );

        res.json({ message: "Club updated successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.post("/events", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;
      console.log(email);

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;
      console.log(role);

      if (role != "clubManager") {
        return res.status(403).json({ message: "forbidden" });
      } else {
        console.log("club Manager detected8");
      }

      const ourData = req.body;
      const clubId = ourData.clubId;

      const clubQuery = { _id: new ObjectId(clubId) };
      const club = await Collection3.findOne(clubQuery);

      const updatedData = {
        eventCount: (club.eventCount || 0) + 1,
      };

      await Collection3.updateOne(clubQuery, { $set: updatedData });

      const result = await Collection4.insertOne(ourData);
      res.send(result);
    });

    app.get("/events", async (req, res) => {
      const { search, sortBy } = req.query;

      let filter = {};

      if (search) {
        filter.title = { $regex: search, $options: "i" };
      }

      let cursor = Collection4.find(filter);

      if (sortBy === "new") cursor = cursor.sort({ eventDate: -1 });
      if (sortBy === "old") cursor = cursor.sort({ eventDate: 1 });
      if (sortBy === "high") cursor = cursor.sort({ eventFee: -1 });
      if (sortBy === "low") cursor = cursor.sort({ eventFee: 1 });

      const values = await cursor.toArray();
      res.send(values);
    });

    app.get("/clubs", async (req, res) => {
      try {
        const { search, category, sortBy } = req.query;

        let filter = { status: "approved" };

        if (search) {
          filter.clubName = { $regex: search, $options: "i" };
        }

        if (category) {
          filter.category = category;
        }

        let cursor = Collection3.find(filter);

        if (sortBy) {
          if (sortBy === "new") cursor = cursor.sort({ createdAt: -1 });
          if (sortBy === "old") cursor = cursor.sort({ createdAt: 1 });
          if (sortBy === "high") cursor = cursor.sort({ membershipFee: -1 });
          if (sortBy === "low") cursor = cursor.sort({ membershipFee: 1 });
        }

        const values = await cursor.toArray();
        res.send(values);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Something went wrong" });
      }
    });

    app.patch("/events/:id", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;
        console.log(email);

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;
        console.log(role);

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        } else {
          console.log("club Manager detected10");
        }

        const eventId = req.params.id;
        const updateData = req.body;

        const result = await Collection4.updateOne(
          { _id: new ObjectId(eventId) },
          { $set: updateData }
        );

        res.json({ message: "event updated successfully", result });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
