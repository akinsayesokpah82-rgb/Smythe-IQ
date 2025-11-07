-- PostgreSQL schema for Smythe IQ (master)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'user',
  student_id TEXT,
  created_at TIMESTAMP DEFAULT now(),
  credits_cents INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  seller_id INT REFERENCES users(id),
  title TEXT,
  description TEXT,
  price_cents INT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title TEXT,
  description TEXT,
  level TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  course_id INT REFERENCES courses(id),
  enrolled_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS surveys (
  id SERIAL PRIMARY KEY,
  title TEXT,
  reward_cents INT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  survey_id INT REFERENCES surveys(id),
  user_id INT REFERENCES users(id),
  response JSONB,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  amount_cents INT,
  kind TEXT,
  provider TEXT,
  status TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  amount_cents INT,
  provider TEXT,
  destination JSONB,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT now(),
  processed_at TIMESTAMP
);
