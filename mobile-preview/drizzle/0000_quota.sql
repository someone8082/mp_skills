CREATE TABLE quota_counts (
  account_id TEXT NOT NULL,
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  PRIMARY KEY (account_id, day, kind)
);
--> statement-breakpoint
CREATE TABLE quota_unlocked (
  account_id TEXT PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE quota_settings (
  name TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
