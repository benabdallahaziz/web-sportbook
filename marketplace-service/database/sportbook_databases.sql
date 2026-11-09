-- ============================================================
--  SportBook – Marketplace Database
--  Import via phpMyAdmin ou : mysql -u root sportbook_marketplace < sportbook_databases.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS sportbook_marketplace
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE sportbook_marketplace;

-- -----------------------------------------------------------
-- Table : categories
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- Table : products
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    price       DECIMAL(10,3) NOT NULL,
    stock       INT          NOT NULL DEFAULT 0,
    category_id INT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- Table : carts
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    total      DECIMAL(10,3) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- Table : cart_items  (relation Cart <-> Product)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    cart_id    INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,3) NOT NULL,
    CONSTRAINT fk_cartitem_cart    FOREIGN KEY (cart_id)    REFERENCES carts(id)    ON DELETE CASCADE,
    CONSTRAINT fk_cartitem_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- Table : orders
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    status     ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
    total      DECIMAL(10,3) NOT NULL DEFAULT 0,
    date       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- Table : order_items
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL,
    unit_price DECIMAL(10,3) NOT NULL,
    CONSTRAINT fk_orderitem_order   FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
    CONSTRAINT fk_orderitem_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- Données de démonstration
-- -----------------------------------------------------------
INSERT IGNORE INTO categories (name, description) VALUES
    ('Chaussures',  'Chaussures de sport toutes disciplines'),
    ('Équipements', 'Équipements et accessoires sportifs'),
    ('Vêtements',   'Tenues et vêtements de sport');

INSERT IGNORE INTO products (name, description, price, stock, category_id) VALUES
    ('Ballon de Football',  'Ballon officiel taille 5',          45.000, 50, 2),
    ('Raquette de Tennis',  'Raquette légère en graphite',       120.000, 20, 2),
    ('Chaussures Running',  'Chaussures légères et respirantes',  89.900, 30, 1),
    ('Maillot Sport',       'Maillot technique anti-transpiration',35.000, 100, 3),
    ('Protège-tibias',      'Protection renforcée pour football', 15.500, 75, 2);
