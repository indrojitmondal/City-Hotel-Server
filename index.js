const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;
//  middleware 
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kk0ds.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const apartmentCollection = client.db("cityHotel").collection("apartments");
    const agreementCollection = client.db("cityHotel").collection("agreements");

    //jwt related api 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // Get apartments 
    app.get('/apartments', async (req, res) => {
      const result = await apartmentCollection.find().toArray();
      res.send(result);
    })
    // Post agreement 
    
    app.post('/agreement', async (req, res) => {
      const agreement = req.body;

      // Check if the user already made an agreement
      const existing = await agreementCollection.findOne({ email: agreement.email });

      if (existing) {
        return res.status(409).send({ message: 'You have already applied for an apartment' });
      }

      const result = await agreementCollection.insertOne(agreement);
      res.send(result);
    });
    app.get('/agreement', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await agreementCollection.find(query).toArray();
      res.send(result);
    })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");


  } finally {

  }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
  res.send('City Hotel is sitting')
})


app.listen(port, () => {
  console.log(`City hotel is sitting on port ${port}`)
})