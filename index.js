const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
app.use(cors());

app.use(express.json());
require("dotenv").config();

const admin = require("firebase-admin");
// const serviceAccount = require("./private-key.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

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

app.listen(port, () => {});

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
      try {
        const userData = req.body;

        const existingUser = await Collection1.findOne({
          email: userData.email,
        });

        if (existingUser) {
          return res.send({ message: "User already exists" });
        } else {
          const result = await Collection1.insertOne(newUser);
          res.send({
            message: "User created successfully",
            result,
          });
        }
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/users", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;

      if (role != "admin") {
        return res.status(403).json({ message: "forbidden" });
      } else {
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

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;

      if (role != "admin") {
        return res.status(403).json({ message: "forbidden" });
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

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;

      if (role != "clubManager") {
        return res.status(403).json({ message: "forbidden" });
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
        res.status(500).json({ message: "Server error" });
      }
    });

    app.patch("/clubs/:id", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        }

        const clubId = req.params.id;
        const updateData = req.body;

        const result = await Collection3.updateOne(
          { _id: new ObjectId(clubId) },
          { $set: updateData }
        );

        res.json({ message: "Club updated successfully", result });
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    });

    app.post("/events", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;

      if (role != "clubManager") {
        return res.status(403).json({ message: "forbidden" });
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
        res.status(500).send({ message: "Something went wrong" });
      }
    });

    app.patch("/events/:id", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        }

        const eventId = req.params.id;
        const updateData = req.body;

        const result = await Collection4.updateOne(
          { _id: new ObjectId(eventId) },
          { $set: updateData }
        );

        res.json({ message: "event updated successfully", result });
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    });

    app.delete("/events/:id", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        }

        const eventId = req.params.id;

        const result = await Collection4.deleteOne({
          _id: new ObjectId(eventId),
        });

        res.json({ message: "event deleted successfully", result });
      } catch (error) {
        res.status(500).json({ message: "Server error" });
      }
    });

    app.get("/clubsAdminList", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;

      if (role != "admin") {
        return res.status(403).json({ message: "forbidden" });
      }

      const cursor = await Collection3.find({});
      const values = await cursor.toArray();
      res.send(values);
    });

    app.get("/get-all-payments", privatePath, async (req, res) => {
      const { email } = req.userInfoSet;

      const result1 = await Collection1.findOne({ email: email });
      const role = result1.role;

      if (role != "admin") {
        return res.status(403).json({ message: "forbidden" });
      }

      const cursor = await Collection5.find({});
      const values = await cursor.toArray();
      res.send(values);
    });

    app.get(
      "/get-my-payments/:email",
      privatePathSpecificUser,
      async (req, res) => {
        const email = req.params.email;
        const query = { userEmail: email };
        const values = await Collection5.find(query).toArray();
        res.send(values);
      }
    );

    app.get("/clubs/:id", privatePath, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const value = await Collection3.findOne(query);

      res.send(value);
    });

    app.patch("/clubApprove/:id", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "admin") {
          return res.status(403).json({ message: "forbidden" });
        }

        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedData = { $set: { status: "approved" } };

        const value = await Collection3.updateOne(query, updatedData);
        res.send(value);
      } catch (error) {
        res.status(500).send({ message: "Failed to approve club" });
      }
    });

    app.patch("/clubReject/:id", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "admin") {
          return res.status(403).json({ message: "forbidden" });
        }

        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const updatedData = { $set: { status: "rejected" } };

        const value = await Collection3.updateOne(query, updatedData);
        res.send(value);
      } catch (error) {
        res.status(500).send({ message: "Failed to approve club" });
      }
    });

    app.get("/event/:id", privatePath, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const value = await Collection4.findOne(query);

      res.send(value);
    });

    app.get("/getClubs/:email", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        }

        const email1 = req.params.email;
        const query = { managerEmail: email1 };

        const cursor = await Collection3.find(query);
        const values = await cursor.toArray();
        res.send(values);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch clubs" });
      }
    });

    app.get("/getClubsApproved/:email", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        }

        const email1 = req.params.email;
        const query = { managerEmail: email1, status: "approved" };

        const cursor = await Collection3.find(query);
        const values = await cursor.toArray();
        res.send(values);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch clubs" });
      }
    });

    app.get("/getEvents/:email", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "clubManager") {
          return res.status(403).json({ message: "forbidden" });
        }

        const email1 = req.params.email;
        const query = { managerEmail: email1 };

        const cursor = await Collection4.find(query);
        const values = await cursor.toArray();
        res.send(values);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch events" });
      }
    });

    app.get("/recentClubs", async (req, res) => {
      const cursor = await Collection3.find({ status: "approved" })
        .sort({ createdAt: -1 })
        .limit(6);
      const values = await cursor.toArray();
      res.send(values);
    });

    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: parseInt(paymentInfo.cost) * 100,
              product_data: {
                name: paymentInfo.name,
              },
            },
            quantity: 1,
          },
        ],

        mode: "payment",
        customer_email: paymentInfo.email,
        metadata: {
          userEmail: paymentInfo.email,
          type: paymentInfo.type,
          clubId: paymentInfo.clubId,
          cost: paymentInfo.cost,
        },

        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    app.post("/save-membership", async (req, res) => {
      try {
        const sessionId = req.body.session_id;

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const paymentId = session.payment_intent;
        const userEmail = session.metadata.userEmail;
        const clubId = session.metadata.clubId;

        const existing = await Collection5.findOne({
          userEmail,
          clubId,
          type: "club",
        });

        if (existing) {
          return res.send({ message: "User already a member of this club" });
        } else {
          const membership = {
            cost: parseInt(session.metadata.cost),
            userEmail,
            type: session.metadata.type,
            clubId,
            paymentId,
            joinedAt: new Date(),
          };

          const result = await Collection5.insertOne(membership);

          const clubQuery = { _id: new ObjectId(clubId) };
          const club = await Collection3.findOne(clubQuery);

          const updatedData = {
            memberCount: (club.memberCount || 0) + 1,
          };

          await Collection3.updateOne(clubQuery, { $set: updatedData });

          res.send({ success: true, inserted: result });
        }
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.post("/save-free-membership", async (req, res) => {
      try {
        const payment_Data = req.body;

        const { userEmail, clubId } = payment_Data;

        const existing = await Collection5.findOne({ userEmail, clubId });

        if (existing) {
          return res.send({
            success: false,
            message: "User already a member of this club",
          });
        }

        const membership = {
          userEmail,
          clubId,
          type: "club",
          cost: 0,
          paymentId: null,
          joinedAt: new Date(),
        };

        const result = await Collection5.insertOne(membership);

        const clubQuery = { _id: new ObjectId(clubId) };
        const club = await Collection3.findOne(clubQuery);

        const updatedData = {
          memberCount: (club?.memberCount || 0) + 1,
        };

        await Collection3.updateOne(clubQuery, { $set: updatedData });

        res.send({ success: true, inserted: result });
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.get(
      "/get-membership/:email",
      privatePathSpecificUser,
      async (req, res) => {
        try {
          const email = req.params.email;

          const cursor = Collection5.find({ userEmail: email, type: "club" });
          const result = (await cursor.toArray()).map((data) => data.clubId);

          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to fetch club memberships" });
        }
      }
    );

    app.post("/create-checkout-session-event", async (req, res) => {
      const paymentInfo = req.body;

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              unit_amount: parseInt(paymentInfo.cost) * 100,
              product_data: {
                name: paymentInfo.name,
              },
            },
            quantity: 1,
          },
        ],

        mode: "payment",
        customer_email: paymentInfo.email,
        metadata: {
          userEmail: paymentInfo.email,
          type: paymentInfo.type,
          eventId: paymentInfo.eventId,
          cost: paymentInfo.cost,
          clubId: paymentInfo.clubId,
        },

        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success-event?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      res.send({ url: session.url });
    });

    app.get(
      "/get-membership-event/:email",
      privatePathSpecificUser,
      async (req, res) => {
        try {
          const email = req.params.email;

          const cursor = Collection5.find({ userEmail: email, type: "event" });
          const result = (await cursor.toArray()).map((data) => data.eventId);

          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Failed to fetch event memberships" });
        }
      }
    );

    app.post("/save-membership-event", async (req, res) => {
      try {
        const sessionId = req.body.session_id;

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const paymentId = session.payment_intent;
        const userEmail = session.metadata.userEmail;
        const eventId = session.metadata.eventId;

        const existing = await Collection5.findOne({ userEmail, eventId });

        if (existing) {
          return res.send({ message: "User already joined this event" });
        } else {
          const membership = {
            cost: parseInt(session.metadata.cost),
            userEmail,
            type: session.metadata.type,
            clubId: session.metadata.clubId,
            eventId,
            paymentId,
            joinedAt: new Date(),
          };

          const result = await Collection5.insertOne(membership);

          const eventQuery = { _id: new ObjectId(eventId) };
          const event = await Collection4.findOne(eventQuery);

          const updatedData = {
            memberCount: (event.memberCount || 0) + 1,
          };

          await Collection4.updateOne(eventQuery, { $set: updatedData });

          res.send({ success: true, inserted: result });
        }
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.post("/save-free-membership-event", async (req, res) => {
      try {
        const payment_Data = req.body;

        const { userEmail, eventId, clubId } = payment_Data;

        const existing = await Collection5.findOne({ userEmail, eventId });

        if (existing) {
          return res.send({
            success: false,
            message: "User already a member of this event",
          });
        }

        const membership = {
          userEmail,
          eventId,
          clubId,
          type: "event",
          cost: 0,
          paymentId: null,
          joinedAt: new Date(),
        };

        const result = await Collection5.insertOne(membership);

        const eventQuery = { _id: new ObjectId(eventId) };
        const event = await Collection4.findOne(eventQuery);

        const updatedData = {
          memberCount: (event?.memberCount || 0) + 1,
        };

        await Collection4.updateOne(eventQuery, { $set: updatedData });

        res.send({ success: true, inserted: result });
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.post("/check-event-register", async (req, res) => {
      try {
        const userEmail = req.body.email;
        const eventId = req.body.id;

        const query = {
          userEmail,
          eventId,
        };

        const result = await Collection5.findOne(query);

        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.post("/check-club-register", async (req, res) => {
      try {
        const userEmail = req.body.email;
        const clubId = req.body.id;

        const query = {
          userEmail,
          clubId,
          type: "club",
        };

        const result = await Collection5.findOne(query);

        res.send(result);
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.get("/admin-dashboard-stats", privatePath, async (req, res) => {
      try {
        const { email } = req.userInfoSet;

        const result1 = await Collection1.findOne({ email: email });
        const role = result1.role;

        if (role != "admin") {
          return res.status(403).json({ message: "forbidden" });
        }

        const totalUsers = await Collection1.countDocuments();

        const totalClubs = await Collection3.countDocuments();

        const totalEvents = await Collection4.countDocuments();

        const totalMemberships = await Collection5.countDocuments();

        const pendingClubs = await Collection3.countDocuments({
          status: "pending",
        });

        const approvedClubs = await Collection3.countDocuments({
          status: "approved",
        });

        const rejectedClubs = await Collection3.countDocuments({
          status: "rejected",
        });

        const paymentArray = await Collection5.aggregate([
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$cost" },
            },
          },
        ]).toArray();

        const totalPaymentsAmount =
          paymentArray.length > 0 ? paymentArray[0].totalAmount : 0;

        res.send({
          totalUsers,
          totalClubs,
          totalEvents,
          totalMemberships,
          pendingClubs,
          approvedClubs,
          rejectedClubs,
          totalPaymentsAmount,
        });
      } catch (error) {}
    });

    app.get(
      "/memberDashboard/:email",
      privatePathSpecificUser,
      async (req, res) => {
        const userEmail = req.params.email;

        const clubJoined = await Collection5.countDocuments({
          userEmail: userEmail,
          type: "club",
        });

        const eventJoined = await Collection5.countDocuments({
          userEmail: userEmail,
          type: "event",
        });

        res.send({ clubJoined, eventJoined });
      }
    );

    app.get(
      "/clubManager-dashboard-stats/:email",
      privatePath,
      async (req, res) => {
        try {
          const { email } = req.userInfoSet;

          const result1 = await Collection1.findOne({ email: email });
          const role = result1.role;

          if (role != "clubManager") {
            return res.status(403).json({ message: "forbidden" });
          }

          const managerEmail = req.params.email;

          const totalClubs = await Collection3.countDocuments({
            managerEmail: managerEmail,
          });

          const totalEvents = await Collection4.countDocuments({
            managerEmail: managerEmail,
          });

          const pendingClubs = await Collection3.countDocuments({
            status: "pending",
            managerEmail: managerEmail,
          });

          const approvedClubs = await Collection3.countDocuments({
            status: "approved",
            managerEmail: managerEmail,
          });

          const rejectedClubs = await Collection3.countDocuments({
            status: "rejected",
            managerEmail: managerEmail,
          });

          const AllClubs = await Collection3.find({ managerEmail }).toArray();

          const clubIds = AllClubs.map((club) => club._id.toString());

          const memberships = await Collection5.find({}).toArray();

          let totalMembers = 0;
          let totalPaymentsAmount = 0;

          memberships.forEach((membership) => {
            const isManagersClub = clubIds.includes(membership.clubId);

            if (isManagersClub) {
              totalMembers++;
              totalPaymentsAmount += membership.cost;
            }
          });

          res.send({
            totalClubs,
            totalEvents,
            pendingClubs,
            approvedClubs,
            rejectedClubs,
            totalMembers,
            totalPaymentsAmount,
          });
        } catch (error) {
          res.status(500).send({ error: "Internal Server Error" });
        }
      }
    );

    app.get(
      "/clubManager-dashboard-ClubMember/:email",
      privatePath,
      async (req, res) => {
        try {
          const { email } = req.userInfoSet;

          const result1 = await Collection1.findOne({ email });
          const role = result1.role;

          if (role !== "clubManager") {
            return res.status(403).json({ message: "forbidden" });
          }

          const managerEmail = req.params.email;

          const clubs = await Collection3.find({
            managerEmail,
            status: "approved",
          }).toArray();

          const memberships = await Collection5.find({
            type: "club",
          }).toArray();

          const result = clubs.map((club) => {
            const clubMembers = memberships.filter(
              (membership) => membership.clubId == club._id
            );

            return {
              clubName: club.clubName,
              members: clubMembers,
            };
          });

          res.json(result);
        } catch (error) {
          res.status(500).json({ message: "error" });
        }
      }
    );

    app.get(
      "/clubManager-dashboard-EventMember/:email",
      privatePath,
      async (req, res) => {
        try {
          const { email } = req.userInfoSet;

          const result1 = await Collection1.findOne({ email: email });
          const role = result1.role;

          if (role != "clubManager") {
            return res.status(403).json({ message: "forbidden" });
          }

          const managerEmail = req.params.email;

          const events = await Collection4.find({
            managerEmail,
          }).toArray();

          const memberships = await Collection5.find({
            type: "event",
          }).toArray();

          const result = events.map((event) => {
            const eventMembers = memberships.filter(
              (membership) => membership.eventId == event._id
            );

            return {
              title: event.title,
              members: eventMembers,
            };
          });

          res.json(result);
        } catch (error) {
          res.status(500).json({ message: "error" });
        }
      }
    );

    // await client.db("admin").command({ ping: 1 });
  } finally {
  }
}
run().catch(console.dir);
