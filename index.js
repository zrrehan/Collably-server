const express = require('express')
const app = express()
const cors = require('cors')
const port = 3000
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = `mongodb://${process.env.SECRET_DB}:${process.env.SECRET_PASS}@ac-ujmsrle-shard-00-00.vuskb8c.mongodb.net:27017,ac-ujmsrle-shard-00-01.vuskb8c.mongodb.net:27017,ac-ujmsrle-shard-00-02.vuskb8c.mongodb.net:27017/?ssl=true&replicaSet=atlas-9hl66u-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const database = client.db("Collably");
        const groups = database.collection("groups");
        const groupNMembers = database.collection("groupNMembers");
        const users = database.collection("user");


        var admin = require("firebase-admin");
        var serviceAccount = require("./collably.json");
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        async function veryfyingFirebaseToken(req, res, next) {
            const authHeader = req.headers?.authorization;

            if (!authHeader && !authHeader.startsWith("Bearer")) {
                return res.status(401).send({ message: "Unauthorized Access" })
            }

            const splittedAuthheader = authHeader.split(" ");
            const token = splittedAuthheader[1]


            try {
                const decoded = await admin.auth().verifyIdToken(token);
                req.decoded = decoded
                next()
            }
            catch (error) {
                return res.status(401).send({ message: "Unauthorized Access" });
            }
        }

        app.get('/', (req, res) => {
            res.send('Welcome to the Collably Server Side :D')
        });

        app.post("/create-group", veryfyingFirebaseToken, async (req, res) => {
            const tokenEmail = req.decoded.email;
            const email = req.query.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            const result = await groups.insertOne(req.body);
            const resultGroupNMembers = await groupNMembers.insertOne({ email: email, groupId: result.insertedId.toString(), admin: "true", creator: "true" })
            res.send(result);
        });

        app.get("/group-info", async(req, res) => {
            const groupId = req.query.id;
            const query = {_id: new ObjectId(groupId)};
            const cursor = groups.find(query);
            const result = await cursor.toArray();
            res.send(result[0]);
        });

        app.get("/my-groups", async(req, res) => {
            const query = {email: req.query.email};
            const cursor = groupNMembers.find(query);
            const result = await cursor.toArray();
            const allGroupsData = [];
            for (let idx of result) {
                const singleGroup = await groups.find({_id: new ObjectId(idx.groupId)}).toArray();
                allGroupsData.push(singleGroup[0]);
            }
            res.send(allGroupsData);
        })

        app.delete("/delete-group", veryfyingFirebaseToken, async(req, res) => {
            const tokenEmail = req.decoded.email;
            const email = req.query.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }

            const id = req.query.id;
            const result = await groups.deleteOne({ _id: new ObjectId(id) });
            const result1 = await groupNMembers.deleteMany({groupId: id});
            res.send(result);
        })

        app.post("/add-member", veryfyingFirebaseToken, async(req, res) => {
            const tokenEmail = req.decoded.email;
            const email = req.query.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            console.log(req.query.groupId, req.query.addedEmail)
            const [groupId, addedEmail] = [req.query.groupId, req.query.addedEmail];
            let user = await users.find({email: addedEmail}).toArray();
            if(user.length == 0) {
                res.send({ message: "The user doesn't exist.", icon: "error"});
                return;
            }

            user = await groupNMembers.find({ email: addedEmail, groupId: groupId }).toArray()
            if(user.length !== 0) {
                res.send({ message: "This user is already a member of the group.", icon: "error" });
                return;
            } 
            const result = await groupNMembers.insertOne({groupId, email: addedEmail, admin: "false", creator: "false"});
            res.send({ message: "Member Added Successfully.", icon: "success" });
        })

        app.get("/group-members", async(req, res) => {
            const groupId = req.query.groupId
            const result = await groupNMembers.find({ groupId: groupId }).toArray();
            for (let singleUser of result) {
                let userEmail = singleUser.email;
                const userDetails = await users.findOne({email: userEmail});
                singleUser.profilePicture = userDetails.profilePicture;
            }
            
            res.send(result);
        })

        app.delete("/delete-user-from-group",veryfyingFirebaseToken, async(req, res) => {
            const tokenEmail = req.decoded.email;
            const email = req.query.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: "Forbidden Access" });
            }
            console.log("hello")
            const [userEmail, groupId] = [req.query.deletedUser, req.query.id];
            const result = await groupNMembers.deleteOne({ groupId: groupId, email: userEmail });
            res.send(result);
        })
    } finally {

    }
}

run().catch(console.dir);



app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
