CREATE TABLE `user` (
  id VARCHAR(36) NOT NULL,
  name TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  emailVerified BOOLEAN NOT NULL,
  image TEXT NULL,
  createdAt DATETIME(3) NOT NULL,
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY user_email_unique (email)
);

CREATE TABLE session (
  id VARCHAR(36) NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  token VARCHAR(255) NOT NULL,
  createdAt DATETIME(3) NOT NULL,
  updatedAt DATETIME(3) NOT NULL,
  ipAddress TEXT NULL,
  userAgent TEXT NULL,
  userId VARCHAR(36) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY session_token_unique (token),
  KEY session_user_id_idx (userId),
  CONSTRAINT session_user_fk FOREIGN KEY (userId) REFERENCES `user` (id) ON DELETE CASCADE
);

CREATE TABLE account (
  id VARCHAR(36) NOT NULL,
  accountId VARCHAR(255) NOT NULL,
  providerId VARCHAR(255) NOT NULL,
  userId VARCHAR(36) NOT NULL,
  accessToken TEXT NULL,
  refreshToken TEXT NULL,
  idToken TEXT NULL,
  accessTokenExpiresAt DATETIME(3) NULL,
  refreshTokenExpiresAt DATETIME(3) NULL,
  scope TEXT NULL,
  password TEXT NULL,
  createdAt DATETIME(3) NOT NULL,
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY account_user_id_idx (userId),
  KEY account_provider_idx (providerId, accountId),
  CONSTRAINT account_user_fk FOREIGN KEY (userId) REFERENCES `user` (id) ON DELETE CASCADE
);

CREATE TABLE verification (
  id VARCHAR(36) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  expiresAt DATETIME(3) NOT NULL,
  createdAt DATETIME(3) NOT NULL,
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY verification_identifier_idx (identifier)
);
