
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const SSLCommerzPayment = require('sslcommerz-lts')
const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;
//  middleware 
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: Swal } = require('sweetalert2');
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
    const userCollection = client.db("cityHotel").collection("users");
    const announcementCollection = client.db("cityHotel").collection("announcements");
    const couponCollection = client.db("cityHotel").collection("coupons");
    const paymentCollection = client.db('cityHotel').collection('payments');
 //jwt related api 
 app.post('/jwt', async (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
  res.send({ token });
});
    //middleware 
    const verifyToken = (req, res, next)=>{
      console.log('inside verify token',req.headers.authorization);
      if(!req.headers.authorization){
        res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
         if(err){
          res.status(401).send({message: 'unauthorized access'})
         }
         req.decoded= decoded;
      })
      next();
    }
    // use verifyAdmin after verifyToken
    const verifyAdmin= async(req, res, next)=>{
      const email = req.decoded.email;
      console.log('Decoded email:', req.decoded.email);
      const query={email: email};
      const user= await userCollection.findOne(query);
      const isAdmin = user?.role ==='admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
      }
      next();
    }

   

    

    // Users 
      // Users collection 
      app.post('/users', async(req, res)=>{
        const user= req.body;
        // insert email if user doesn't exists 
        // you can do this many ways(1. email unique 2. upsert 3. simple checking)
        const query ={email: user.email};
        const existingUser= await userCollection.findOne(query);
        if(existingUser){
          return res.send({message: 'user already exists', insertedId: null})
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      })
     
      app.get('/memberChecker/:email', verifyToken,  async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
    
        let member = false;
        if (user) {
            member = user.role === 'member';
        }
    
        res.send({ member });
    });
      app.patch('/users/:email', verifyToken, async(req, res)=>{
        const email= req.params.email;
        
        const filter={
          email: email
        }
        const updatedDoc={
          $set: { role: 'member'}
        }
        const result= userCollection.updateOne(filter,updatedDoc);
        res.send(result);

      })

      app.patch('/members/:id', verifyToken, verifyAdmin, async(req, res)=>{
        const id= req.params.id;
        const query={
          _id: new ObjectId(id)
        }
        const updatedDoc={
          $set:{
            role: 'user'
          }
        }
        const result= await userCollection.updateOne(query, updatedDoc);
        console.log(result);
        res.send(result);
      })



      app.get('/users/admin/:email', verifyToken, async(req, res)=>{
        const email = req.params.email;
        if(email != req.decoded.email){
          return res.status(403).send({message: 'forbidden access'});
        }
        const query = {email: email};
        const user= await userCollection.findOne(query);
        let admin = false;
        if(user){
           admin = user?.role === 'admin';
        }
        res.send({admin});
     })

     app.post('/announcements', verifyToken, verifyAdmin,  async(req, res)=>{
       const announcement= req.body;
       const result = await announcementCollection.insertOne(announcement);
       res.send(result);
     })
     app.get('/announcements',  async(req, res)=>{
      const result = await announcementCollection.find().toArray();
      res.send(result);
     })

     app.get('/members', verifyToken, verifyAdmin, async(req, res)=>{
      const query= {
        role: 'member'
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
     })

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
        return res.status(409).send({message: 'You have already applied'});
      }

      const result = await agreementCollection.insertOne(agreement);
      res.send(result);
    });
    
    app.get('/agreement', async (req, res) => {
      const email = req.query?.email;
      let result = [];
    
      if (email) {
        const query = { email:  email};
        result = await agreementCollection.find(query).toArray();
      } else {
        result = await agreementCollection.find().toArray();
      }
    
      res.send(result);
    });

    app.patch('/agreement/:id', verifyToken, verifyAdmin, async(req, res)=>{
      const id = req.params.id;
      const query={
        _id : new ObjectId(id)
      }
      const updatedDoc={
        $set:{ status: 'checked'}
      }
      const result = await agreementCollection.updateOne(query, updatedDoc);
      res.send(result);
    })

    app.delete('/agreement/:id', verifyToken, verifyAdmin,   async(req, res)=>{
      const id = req.params.id;
      const query={
        _id : new ObjectId(id)
      }
     
      const result = await agreementCollection.deleteOne(query);
      res.send(result);
    })

   app.get('/coupons', async(req, res)=>{
    const result = await couponCollection.find().toArray();
    res.send(result);
   })
   app.post('/coupons', async(req, res)=>{
    const coupon= req.body;
    const result = await couponCollection.insertOne(coupon);
    res.send(result);
   })

  

    app.get('/admin-stats', verifyToken, verifyAdmin, async(req, res)=>{
      const rooms= await apartmentCollection.estimatedDocumentCount();
      const agreements = await agreementCollection.estimatedDocumentCount();
      const availableRooms = rooms -agreements;
      const users = (await userCollection.find({role: 'user'}).toArray()).length;
      const members= (await userCollection.find({role:'member'}).toArray()).length;
      res.send({rooms, agreements, availableRooms, users, members}); 
    })

    app.post('/create-payment-intent', async(req, res)=>{
       const {price}= req.body;
       const amount = parseInt(price)*100;
       const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({clientSecret: paymentIntent.client_secret});
    })

    app.post('/payments', async(req, res)=>{
      const payment = req.body;
      const paymentResult= await paymentCollection.insertOne(payment);
      console.log('payment Info', payment);
      
      const query={email: payment.email};
      const deleteResult= await agreementCollection.deleteOne(query);
      res.send({paymentResult, deleteResult});
    })
    app.get('/paymentHistory/:email',verifyToken, async(req, res)=>{
      const email= req.params.email;
      const query={ email: email};
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })
    
    // SSLCommerz Method 
    const tran_id= new ObjectId().toString();
    app.post('/order', async(req, res)=>{
     // console.log(req.body);
     const apartment= req.body;
     const data = {
      total_amount: apartment?.rent,
      currency: 'BDT',
      tran_id: tran_id, // use unique tran_id for each api call
      success_url: `https://a12-ph-server.vercel.app/payment/success/${tran_id}`,
      fail_url: 'https://a12-ph-server.vercel.app/payment/fail',
      cancel_url: 'http://localhost:3030/cancel',
      ipn_url: 'http://localhost:3030/ipn',
      shipping_method: 'Courier',
      product_name: 'Computer.',
      product_category: 'Electronic',
      product_profile: 'general',
      cus_name: 'Customer Name',
      cus_email: apartment?.email,
      cus_add1: 'Dhaka',
      cus_add2: 'Dhaka',
      cus_city: 'Dhaka',
      cus_state: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: '01711111111',
      cus_fax: '01711111111',
      ship_name: 'Customer Name',
      ship_add1: 'Dhaka',
      ship_add2: 'Dhaka',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postcode: 1000,
      ship_country: 'Bangladesh',
     };

     console.log(data);
     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
     sslcz.init(data).then(apiResponse => {
         // Redirect the user to payment gateway
         let GatewayPageURL = apiResponse.GatewayPageURL
       //  res.redirect(GatewayPageURL)

        // const finalOrder={
        //   apartment,paidStatus: false, transactionId: tran_id
        // }
         res.send({url: GatewayPageURL});
         console.log('Redirecting to: ', GatewayPageURL)
     });

     app.post('/payment/success/:tranId', async(req, res)=>{
       console.log(req.params.tranId);
       
       const payment={
        email: apartment?.email,
        price: apartment?.rent,
        transactionId: req.params.tranId,
        date: new Date(), // utc date convert. use moment js too 
        status: 'pending'
    }

       const paymentResult= await paymentCollection.insertOne(payment);
       console.log('payment Info', payment);
       
       const query={email: payment.email};
       console.log(query);
       const deleteResult= await agreementCollection.deleteOne(query);
       //res.send({paymentResult, deleteResult});
       if(paymentResult.insertedId){
        
       res.redirect('https://city-hotel-7c0c3.web.app/dashboard/payment-history')
       }
       console.log(paymentResult);

     })

     app.post('/payment/fail', async(req, res)=>{
       res.redirect('https://city-hotel-7c0c3.web.app/dashboard/make-payment');
     })


    })

    //  okay...
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
