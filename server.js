require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const { Configuration, OpenAIApi } = require('openai');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const AWS = require('aws-sdk');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(bodyParser.json());

// OpenAI client
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

// AWS S3 setup (for uploads)
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION
});
const upload = multer({ storage: multer.memoryStorage() });

// Helpers
function signToken(user){ return jwt.sign({id:user.id, role:user.role}, process.env.JWT_SECRET, {expiresIn:'30d'}); }
async function findUserByEmail(email){ const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]); return r.rows[0]; }

// Health
app.get('/api/health', (req, res) => res.json({status: 'ok', now: new Date()}));

// Auth: register/login
app.post('/api/auth/register', async (req,res)=>{
  try{
    const {name,email,phone,password,student_id} = req.body;
    if(!email || !password) return res.status(400).json({error:'email and password required'});
    const existing = await findUserByEmail(email);
    if(existing) return res.status(400).json({error:'email exists'});
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query('INSERT INTO users (name,email,phone,password_hash,student_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,phone,student_id,credits_cents', [name,email,phone,hash,student_id]);
    const user = result.rows[0];
    const token = signToken(user);
    res.json({user, token});
  }catch(e){ console.error(e); res.status(500).json({error:'server error'}); }
});
app.post('/api/auth/login', async (req,res)=>{
  try{
    const {email,password} = req.body;
    const user = await findUserByEmail(email);
    if(!user) return res.status(400).json({error:'invalid credentials'});
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if(!ok) return res.status(400).json({error:'invalid credentials'});
    const token = signToken(user);
    res.json({user:{id:user.id,name:user.name,email:user.email,phone:user.phone,student_id:user.student_id,credits_cents:user.credits_cents}, token});
  }catch(e){ console.error(e); res.status(500).json({error:'server error'}); }
});

# Note: rest of backend continues...
