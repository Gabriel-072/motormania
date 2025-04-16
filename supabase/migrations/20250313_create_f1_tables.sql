CREATE TABLE predictions (
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

CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);