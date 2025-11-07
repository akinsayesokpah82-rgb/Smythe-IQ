// Middleware to protect routes
async function authMiddleware(req,res,next){
  const auth = req.headers.authorization;
  if(!auth) return res.status(401).json({error:'no token'});
  const token = auth.replace('Bearer ','');
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  }catch(e){ return res.status(401).json({error:'invalid token'}); }
}

// AI assistant proxy (AkinBot)
app.post('/api/ai/query', async (req, res) => {
  try {
    const { q } = req.body;
    if (!q) return res.status(400).json({error: 'missing query'});
    const resp = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: q }],
      max_tokens: 500
    });
    const reply = resp.data.choices?.[0]?.message?.content || 'Sorry, no reply';
    res.json({reply});
  } catch (err) {
    console.error('AI error', err?.message || err);
    res.status(500).json({error: 'AI provider error'});
  }
});

// Stripe: create checkout session for donations or product purchase
app.post('/api/payments/create-checkout-session', async (req, res) => {
  try {
    const { amount_cents, currency='usd', success_url, cancel_url, metadata } = req.body;
    if(!amount_cents) return res.status(400).json({error:'amount required'});
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: {
        currency,
        product_data: { name: 'SmytheIQ Payment' },
        unit_amount: amount_cents
      }, quantity: 1 }],
      mode: 'payment',
      success_url: success_url || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancel`,
      metadata: metadata || {}
    });
    res.json({url: session.url});
  } catch (err) {
    console.error('Stripe error', err);
    res.status(500).json({error: 'payment error'});
  }
});

// Stripe webhook endpoint (record transactions)
app.post('/api/payments/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try{
      await pool.query('INSERT INTO transactions (user_id, amount_cents, kind, provider, status, metadata) VALUES ($1,$2,$3,$4,$5,$6)',
        [null, session.amount_total, 'payment', 'stripe', 'completed', {session_id: session.id}]);
    }catch(e){ console.error('DB save error', e); }
  }
  res.json({received: true});
});

// Donations endpoint (record intent & commission; payments handled externally)
app.post('/api/donations', async (req, res) => {
  const { method, amount_cents, phone } = req.body;
  if(!amount_cents) return res.status(400).json({error:'amount required'});
  const commissionPercent = Number(process.env.COMMISSION_PERCENT || 0);
  const commission = Math.round((amount_cents * commissionPercent) / 100);
  try{
    await pool.query('INSERT INTO transactions (user_id, amount_cents, kind, provider, status, metadata) VALUES ($1,$2,$3,$4,$5,$6)',
      [null, amount_cents, 'donation', method || 'bank', 'recorded', {phone}]);
  }catch(e){ console.error('tx record', e); }
  res.json({message:'donation recorded', commission, net_cents: amount_cents - commission});
});

// Courses
app.get('/api/courses', async (req,res)=>{
  const r = await pool.query('SELECT * FROM courses ORDER BY created_at DESC');
  res.json(r.rows);
});
app.post('/api/courses', authMiddleware, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const {title,description,level} = req.body;
  const r = await pool.query('INSERT INTO courses (title,description,level) VALUES ($1,$2,$3) RETURNING *',[title,description,level]);
  res.json(r.rows[0]);
});
app.post('/api/courses/:id/enroll', authMiddleware, async (req,res)=>{
  const courseId = req.params.id;
  try{
    await pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ($1,$2)', [req.user.id, courseId]);
    res.json({message:'enrolled'});
  }catch(e){ console.error(e); res.status(500).json({error:'signup failed'}); }
});

// Surveys
app.get('/api/surveys', async (req,res)=>{
  const r = await pool.query('SELECT * FROM surveys ORDER BY created_at DESC');
  res.json(r.rows);
});
app.post('/api/surveys/:id/submit', authMiddleware, async (req,res)=>{
  const surveyId = req.params.id;
  const response = req.body.response || {};
  try{
    await pool.query('INSERT INTO survey_responses (survey_id, user_id, response) VALUES ($1,$2,$3)', [surveyId, req.user.id, response]);
    const s = await pool.query('SELECT reward_cents FROM surveys WHERE id=$1', [surveyId]);
    const reward = s.rows[0]?.reward_cents || 0;
    await pool.query('UPDATE users SET credits_cents = credits_cents + $1 WHERE id=$2', [reward, req.user.id]);
    res.json({message:'response recorded', reward_cents: reward});
  }catch(e){ console.error(e); res.status(500).json({error:'submit failed'}); }
});

// Payout request (bank/manual processing)
app.post('/api/payouts/request', authMiddleware, async (req,res)=>{
  const {amount_cents, provider, destination} = req.body;
  if(!amount_cents || amount_cents <=0) return res.status(400).json({error:'invalid amount'});
  try{
    const u = await pool.query('SELECT credits_cents FROM users WHERE id=$1', [req.user.id]);
    const balance = u.rows[0]?.credits_cents || 0;
    if(amount_cents > balance) return res.status(400).json({error:'insufficient balance'});
    await pool.query('INSERT INTO payouts (user_id, amount_cents, provider, destination, status) VALUES ($1,$2,$3,$4,$5)', [req.user.id, amount_cents, provider || 'bank', destination || {}, 'pending']);
    await pool.query('UPDATE users SET credits_cents = credits_cents - $1 WHERE id=$2', [amount_cents, req.user.id]);
    res.json({message:'payout requested - admin will process via bank transfer'});
  }catch(e){ console.error(e); res.status(500).json({error:'payout failed'}); }
});

// File upload (S3)
app.post('/api/uploads', authMiddleware, upload.single('file'), async (req,res)=>{
  if(!req.file) return res.status(400).json({error:'file required'});
  const key = `uploads/${Date.now()}_${req.file.originalname}`;
  try{
    const params = { Bucket: process.env.AWS_S3_BUCKET, Key: key, Body: req.file.buffer };
    const data = await s3.upload(params).promise();
    res.json({url: data.Location});
  }catch(e){ console.error('s3 upload', e); res.status(500).json({error:'upload failed'}); }
});

// Admin routes
app.get('/api/admin/payouts', authMiddleware, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const r = await pool.query('SELECT * FROM payouts ORDER BY requested_at DESC');
  res.json(r.rows);
});
app.post('/api/admin/payouts/:id/process', authMiddleware, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({error:'forbidden'});
  const id = req.params.id;
  await pool.query('UPDATE payouts SET status=$1, processed_at=now() WHERE id=$2', ['processed', id]);
  res.json({message:'marked processed'});
});

// Marketplace placeholders
app.get('/api/products', async (req,res)=>{ const r = await pool.query('SELECT * FROM products'); res.json(r.rows); });
app.post('/api/products', authMiddleware, async (req,res)=>{ const {title,description,price_cents} = req.body; await pool.query('INSERT INTO products (seller_id,title,description,price_cents) VALUES ($1,$2,$3,$4)', [req.user.id,title,description,price_cents]); res.json({message:'product created'}); });

// Socket.IO
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);
  socket.on('join', (room) => socket.join(room));
  socket.on('message', async (data) => {
    const {room, user, text} = data;
    io.to(room).emit('message', {user, text, ts: Date.now()});
    if (text && text.toLowerCase().includes('@akinbot')) {
      const query = text.replace(/@akinbot/ig, '').trim() || 'Hello';
      try{
        const resp = await openai.createChatCompletion({
          model: 'gpt-4o-mini',
          messages: [{role:'user', content: query}],
          max_tokens: 300
        });
        const botReply = resp.data.choices?.[0]?.message?.content || 'AkinBot could not respond';
        io.to(room).emit('message', {user: 'AkinBot', text: botReply, ts: Date.now()});
      }catch(e){
        io.to(room).emit('message', {user:'AkinBot', text:'AI error', ts: Date.now()});
      }
    }
  });
});

server.listen(PORT, ()=> console.log(`Backend + Socket.IO running on port ${PORT}`));
