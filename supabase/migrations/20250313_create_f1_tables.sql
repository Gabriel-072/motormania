create table if not exists predictions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  pole1 TEXT,
  pole2 TEXT,
  pole3 TEXT,
  gp1 TEXT,
  gp2 TEXT,
  gp3 TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

create table if not exists transactions leaderboard (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);