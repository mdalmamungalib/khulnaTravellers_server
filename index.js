const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  Admin,
} = require("mongodb");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173", // for local testing client side URL
      "https://khulna-traveller.firebaseapp.com", // for Firebase hosting URL
      "https://khulna-traveller.web.app", // for Firebase hosting URL
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Test endpoint
app.get("/test", (req, res) => {
  res.json({ message: "API is working!" });
});
// mongoDB database

const uri = `mongodb+srv://${process.env.mongoDB_name}:${process.env.mongoDB_password}@cluster0.dwm6bvm.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleWars

async function run() {
  try {
    await client.connect(); // Connect to the MongoDB database

    const bannerCollection = client
      .db("KhulnaTravelsDB")
      .collection("banner");
    const usersCollection = client
      .db("KhulnaTravelsDB")
      .collection("users");
    const latestPlanCollection = client
      .db("KhulnaTravelsDB")
      .collection("latestPlan");
    const themCollection = client
      .db("KhulnaTravelsDB")
      .collection("them");
    const galleryCollection = client
      .db("KhulnaTravelsDB")
      .collection("gallery");

    const logger = (req, res, next) => {
      console.log("log info", req.method);
      console.log("log info url", req.url);
      next();
    };

    // verifyJWTToken Middleware
    const verifyToken = (req, res, next) => {
      const token = req?.cookies?.token;
      if (!token) {
        return res
          .status(401)
          .send({ message: "unauthorize access token" });
      }
      jwt.verify(
        token,
        process.env.JWT_SECRETE_TOKEN,
        (err, decoded) => {
          if (err) {
            return res
              .status(401)
              .send({
                message: "unauthorized access token",
              });
          }
          req.decoded = decoded;
          next();
        }
      );
    };

    // Verify Admin middleware
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded?.email;
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const isAdmin = user?.role !== "admin";
        if (isAdmin) {
          return res.status(403).send({
            error: true,
            message:
              "Forbidden access. Admin permissions required.",
          });
        }
        next();
      } catch (error) {
        // Handle errors
        console.error(
          "Error in verifyAdmin middleware:",
          error
        );
        res.status(500).send({
          error: true,
          message: "Internal server error.",
        });
      }
    };

    // auth related Api JWT
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        user,
        process.env.JWT_SECRETE_TOKEN,
        {
          expiresIn: "1d",
        }
      );
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true, //http://localhost:5173/
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/logOut", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", { maxAge: 0 })
        .send({ success: true });
    });

    // users API
    app.post("/user", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(
        query
      );
      if (existingUser) {
        return res.send({
          errors: "This email already exist",
        });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // verifyToken, verifyAdmin,
    app.get("/allUsers", verifyToken, async (req, res) => {
      // console.log("req.user", req.decoded);
      // console.log("req.user.email", req.user.email)
      // console.log("req.params.emil", req.query.ema);
      // this is only for special data(email)
      // console.log("tis email",req.user.email, req.query.emil)
      if (!req.decoded.email) {
        return res
          .status(403)
          .send({ message: "forbidden access" });
      }
      const allUsers = await usersCollection
        .find({})
        .toArray();
      res.send(allUsers);
    });

    // admin user  verifyToken, verifyAdmin, /user/admin/:id
    app.patch(
      "/user/admin/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }
    );

    // user gate admin
    app.get(
      "/user/admin/:email",
      verifyToken,
      async (req, res) => {
        const email = req.params.email;
        const decodedEmail = req.decoded.email;
        // console.log("test email", email, decodedEmail);
        if (email !== decodedEmail) {
          return res.status(403).send({ admin: false });
        }
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = { admin: user?.role === "admin" };
        res.send(result);
      }
    );

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    app.get("/singleUser/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(filter);
      res.send(result);
    });

    // updateUSer
    app.put(
      "/updateProfile/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updateDoc = { $set: { ...req.body } };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      }
    );

    // delete user  verifyToken, verifyAdmin,
    app.delete(
      "/user/delete/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await usersCollection.deleteOne(
          filter
        );
        res.send(result);
      }
    );

    // Latest plan  verifyToken, verifyAdmin,
    app.post(
      "/latestPlan",
      verifyToken,
      async (req, res) => {
        const data = req.body;
        const result = await latestPlanCollection.insertOne(
          data
        );
        res.send(result);
      }
    );

    app.get("/allLatestPlan", async (req, res) => {
      const result = await latestPlanCollection
        .find({})
        .toArray();
      res.send(result);
    });

    app.get("/aLatestPlan/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await latestPlanCollection.findOne(
        query
      );
      res.send(result);
    });

    // verifyToken, verifyAdmin,
    app.put(
      "/updatePlan/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updateDoc = {
          $set: { ...req.body },
        };
        const result = await latestPlanCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      }
    );

    // verifyToken, verifyAdmin,
    app.delete(
      "/deletePlan/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await latestPlanCollection.deleteOne(
          filter
        );
        res.send(result);
      }
    );

    // our them  verifyToken, verifyAdmin,
    app.post("/them", verifyToken, async (req, res) => {
      const themData = req.body;
      const result = await themCollection.insertOne(
        themData
      );
      res.send(result);
    });

    app.get("/them", async (req, res) => {
      const result = await themCollection
        .find({})
        .toArray();
      res.send(result);
    });

    app.get("/aMember/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await themCollection.findOne(filter);
      res.send(result);
    });

    // verifyToken, verifyAdmin,
    app.put(
      "/updateThemMember/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updateDoc = { $set: { ...req.body } };
        const result = await themCollection.updateOne(
          filter,
          updateDoc,
          option
        );
        res.send(result);
      }
    );

    // verifyToken, verifyAdmin,
    app.delete(
      "/deleteAMember/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await themCollection.deleteOne(
          filter
        );
        res.send(result);
      }
    );

    // Banner Collection  verifyToken, verifyAdmin,
    app.post(
      "/addBanner",
      verifyToken,
      async (req, res) => {
        const banner = req.body;
        const result = await bannerCollection.insertOne(
          banner
        );
        res.send(result);
      }
    );

    app.get("/allBanner", async (req, res) => {
      const result = await bannerCollection
        .find()
        .toArray();
      res.send(result);
    });

    // verifyToken, verifyAdmin,
    app.delete(
      "/deleteBanner/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await bannerCollection.deleteOne(
          filter
        );
        res.send(result);
      }
    );

    //gallery collection  verifyToken, verifyAdmin,
    app.post(
      "/addGallery",
      verifyToken,
      async (req, res) => {
        const gallery = req.body;
        const result = await galleryCollection.insertOne(
          gallery
        );
        res.send(result);
      }
    );

    app.get("/allGallery", async (req, res) => {
      const result = await galleryCollection
        .find()
        .toArray();
      res.send(result);
    });

    // verifyToken, verifyAdmin,
    app.delete(
      "/deleteGallery/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const result = await galleryCollection.deleteOne(
          filter
        );
        res.send(result);
      }
    );

    //  server start
    app.get("/", (req, res) => {
      console.log("cook cook", req.cookies);
      res.send(`Server is running on port: ${port}`);
    });

    app.listen(port, () => {
      console.log(`Server is running on port: ${port}`);
    });
  } finally {
    // No need to close the connection here
    // await client.close();
  }
}

run().catch(console.dir); // Start the server
