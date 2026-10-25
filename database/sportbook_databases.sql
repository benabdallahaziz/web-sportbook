-- =====================================================================
-- SportBook : une base de données indépendante par microservice
-- Pour XAMPP : http://localhost/phpmyadmin -> onglet "Importer" -> ce fichier
-- (MySQL/MariaDB, utf8mb4). Les références entre microservices sont de
-- simples colonnes ID (pas de clé étrangère), comme exigé en microservices.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Identity & User
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS sportbook_identity CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportbook_identity;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS profile (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80),
  last_name VARCHAR(80),
  phone VARCHAR(30),
  address VARCHAR(255),
  user_id BIGINT NOT NULL UNIQUE,
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS user_role (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE
);

INSERT IGNORE INTO role (name, description) VALUES
  ('SPORTIF', 'Joueur qui réserve des terrains'),
  ('GERANT', 'Gérant de complexe sportif'),
  ('ADMIN', 'Administrateur de la plateforme');

-- ---------------------------------------------------------------------
-- 2. Venue Management
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS sportbook_venue CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportbook_venue;

CREATE TABLE IF NOT EXISTS venue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(30),
  owner_id BIGINT NULL  -- id du gérant (microservice Identity)
);

CREATE TABLE IF NOT EXISTS field (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  sport VARCHAR(50) NOT NULL,       -- Football, Tennis, Padel, Basketball
  price DOUBLE NOT NULL,            -- prix par heure (DT)
  venue_id BIGINT NOT NULL,
  CONSTRAINT fk_field_venue FOREIGN KEY (venue_id) REFERENCES venue(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS opening_hours (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  day VARCHAR(15) NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  venue_id BIGINT NOT NULL,
  CONSTRAINT fk_oh_venue FOREIGN KEY (venue_id) REFERENCES venue(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 3. Booking & Availability
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS sportbook_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportbook_booking;

CREATE TABLE IF NOT EXISTS time_slot (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  field_id BIGINT NOT NULL,         -- id du terrain (microservice Venue)
  UNIQUE KEY uq_slot (field_id, date, start_time)   -- évite les doublons de créneau
);

CREATE TABLE IF NOT EXISTS availability (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  time_slot_id BIGINT NOT NULL UNIQUE,
  CONSTRAINT fk_av_slot FOREIGN KEY (time_slot_id) REFERENCES time_slot(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS booking (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',  -- PENDING, CONFIRMED, CANCELLED
  total_price DOUBLE NOT NULL,
  user_id BIGINT NOT NULL,          -- microservice Identity
  field_id BIGINT NOT NULL,         -- microservice Venue
  time_slot_id BIGINT NOT NULL UNIQUE,  -- un créneau = une seule réservation (pas de double réservation)
  CONSTRAINT fk_booking_slot FOREIGN KEY (time_slot_id) REFERENCES time_slot(id)
);

-- ---------------------------------------------------------------------
-- 4. Marketplace
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS sportbook_marketplace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportbook_marketplace;

CREATE TABLE IF NOT EXISTS category (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS product (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price DOUBLE NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  category_id BIGINT,
  CONSTRAINT fk_product_cat FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cart (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  created_at DATE NOT NULL,
  total DOUBLE NOT NULL DEFAULT 0,
  user_id BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  total DOUBLE NOT NULL DEFAULT 0,
  user_id BIGINT NOT NULL,
  cart_id BIGINT NULL,
  CONSTRAINT fk_order_cart FOREIGN KEY (cart_id) REFERENCES cart(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  quantity INT NOT NULL,
  unit_price DOUBLE NOT NULL,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES product(id)
);

-- ---------------------------------------------------------------------
-- 5. Tournament & Events
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS sportbook_tournament CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportbook_tournament;

CREATE TABLE IF NOT EXISTS tournament (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'PLANNED'
);

CREATE TABLE IF NOT EXISTS team (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  members INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS registration (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  registration_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  tournament_id BIGINT NOT NULL,
  team_id BIGINT NOT NULL,
  UNIQUE KEY uq_reg (tournament_id, team_id),
  CONSTRAINT fk_reg_tournament FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE,
  CONSTRAINT fk_reg_team FOREIGN KEY (team_id) REFERENCES team(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS round (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  round_order INT NOT NULL,
  tournament_id BIGINT NOT NULL,
  CONSTRAINT fk_round_tournament FOREIGN KEY (tournament_id) REFERENCES tournament(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE,
  score VARCHAR(20),
  status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
  round_id BIGINT NOT NULL,
  team1_id BIGINT NOT NULL,
  team2_id BIGINT NOT NULL,
  CONSTRAINT fk_match_round FOREIGN KEY (round_id) REFERENCES round(id) ON DELETE CASCADE,
  CONSTRAINT fk_match_t1 FOREIGN KEY (team1_id) REFERENCES team(id),
  CONSTRAINT fk_match_t2 FOREIGN KEY (team2_id) REFERENCES team(id)
);

-- ---------------------------------------------------------------------
-- 6. Coach & Training
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS sportbook_coach CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportbook_coach;

CREATE TABLE IF NOT EXISTS coach (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  speciality VARCHAR(100),
  rating DOUBLE DEFAULT 0,
  user_id BIGINT NULL               -- microservice Identity
);

CREATE TABLE IF NOT EXISTS coach_availability (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  day VARCHAR(15) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  coach_id BIGINT NOT NULL,
  CONSTRAINT fk_ca_coach FOREIGN KEY (coach_id) REFERENCES coach(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS certification (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  issue_date DATE,
  expiry_date DATE,
  coach_id BIGINT NOT NULL,
  CONSTRAINT fk_cert_coach FOREIGN KEY (coach_id) REFERENCES coach(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS training_program (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  duration INT,                     -- en semaines
  coach_id BIGINT NOT NULL,
  CONSTRAINT fk_tp_coach FOREIGN KEY (coach_id) REFERENCES coach(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS training_session (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
  program_id BIGINT NOT NULL,
  user_id BIGINT NULL,              -- sportif inscrit (microservice Identity)
  CONSTRAINT fk_ts_program FOREIGN KEY (program_id) REFERENCES training_program(id) ON DELETE CASCADE
);
