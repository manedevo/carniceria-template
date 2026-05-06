-- Carnicería Artesanal — database schema
-- MariaDB 11 / MySQL 8

CREATE DATABASE IF NOT EXISTS carniceria_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE carniceria_db;

-- ─── Products ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id         INT          UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  category   ENUM('Ternera','Cerdo','Pollo','Cordero','Embutidos') NOT NULL,
  price      DECIMAL(8,2) NOT NULL COMMENT 'EUR per kg',
  note       VARCHAR(255) DEFAULT NULL,
  image_url  VARCHAR(255) DEFAULT NULL COMMENT 'filename inside public/assets/img/',
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Orders ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id              INT           UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_name   VARCHAR(120)  NOT NULL,
  phone           VARCHAR(30)   NOT NULL,
  address         TEXT          NOT NULL,
  zone            VARCHAR(80)   NOT NULL,
  time_slot       VARCHAR(60)   NOT NULL,
  payment_method  VARCHAR(40)   NOT NULL DEFAULT 'Efectivo',
  items           JSON          NOT NULL,
  total           DECIMAL(10,2) NOT NULL,
  status          ENUM('pendiente','confirmado','en camino','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Seed data — 30 products ─────────────────────────────────────────────────

INSERT INTO products (name, category, price, note, image_url) VALUES

-- Ternera
('Carne picada de ternera',     'Ternera',   7.90, 'Ideal para albóndigas, boloñesa y rellenos',           'carne_picada.jpg'),
('Carne para guisar',           'Ternera',   9.50, 'Troceada al punto, perfecta para estofados',           'guisar.jpg'),
('Filete de ternera',           'Ternera',  14.50, 'Corte limpio, listo para la plancha',                  'filete_ternera.jpg'),
('Solomillo de ternera',        'Ternera',  22.90, 'El corte más tierno. Vuelta y vuelta o al horno',      'solomillo.jpg'),
('Entrecot de ternera',         'Ternera',  18.50, 'Veteado natural, sabor intenso a la brasa',            'entrecot.jpg'),
('Costilla de ternera',         'Ternera',   8.20, 'Perfecta a fuego lento o en el horno',                 'costilla_ternera.jpg'),
('Morcillo de ternera',         'Ternera',   9.90, 'Meloso y gelatinoso, perfecto para caldos y guisos',   NULL),
('Selección magra de ternera',  'Ternera',  12.50, 'Cortes bajos en grasa, ideales para dietas',           NULL),

-- Cerdo
('Chuleta ahumada de cerdo',    'Cerdo',    11.90, 'Curada en casa, lista para la sartén',                 'chuleta_ahumada.jpg'),
('Costillas de cerdo',          'Cerdo',     9.20, 'Marinadas con nuestra receta tradicional',             'costillas_cerdo.jpg'),
('Lomo de cerdo',               'Cerdo',    10.50, 'Jugoso y versátil: a la plancha, asado o en salsa',    'lomo_cerdo.jpg'),
('Chuletas frescas de cerdo',   'Cerdo',     8.50, 'Corte clásico, sin ahumar',                            'chuletas_cerdo.jpg'),
('Secreto ibérico',             'Cerdo',    14.90, 'Pieza selecta entre la paleta y el lomo',              'secreto_iberico.jpg'),

-- Pollo
('Alitas de pollo',             'Pollo',     4.50, 'Para el horno, la freidora o la barbacoa',             'alitas.jpg'),
('Muslos de pollo',             'Pollo',     4.20, 'Con hueso, jugosos y económicos',                      'muslos.jpg'),
('Contramuslo deshuesado',      'Pollo',     8.50, 'Sin hueso ni grasa excesiva, rápido de cocinar',       'contramuslo.jpg'),
('Filete de pechuga',           'Pollo',     9.20, 'Finamente laminado, ideal para empanados y salteados', 'filete_pechuga.jpg'),
('Tiras para fajita',           'Pollo',     9.20, 'Precortadas, sazonadas con especias suaves',           'tiras_fajita.jpg'),
('Pollo entero',                'Pollo',     4.10, 'Pollo fresco de corral, limpio y listo para asar',     'pollo_entero.jpg'),
('Pollo de campo',              'Pollo',     5.30, 'Criado en libertad, sabor más pronunciado',            'pollo_campo.jpg'),
('Pechuga picada de pollo',     'Pollo',     8.20, 'Base perfecta para hamburguesas ligeras y albóndigas', NULL),
('Churrasco de pollo',          'Pollo',     8.50, 'Abierto en mariposa, listo para la brasa',             'churrasco_pollo.jpg'),
('Hígado de pollo',             'Pollo',     3.20, 'Rico en hierro, para paté casero o salteado',          NULL),
('Mollejas de pollo',           'Pollo',     4.00, 'Para arroces, salteados y pinchos',                    NULL),

-- Cordero
('Chuletas de lechal',          'Cordero',  14.90, 'Pequeñas y tiernas, a la brasa en minutos',            'chuletas_lechal.jpg'),
('Cordero para guisar',         'Cordero',  12.50, 'Troceado con hueso, ideal para calderetas',            'cordero_guisar.jpg'),
('Pierna de cordero',           'Cordero',  11.50, 'Entera o troceada, perfecta para el horno',            NULL),
('Paletilla de cordero',        'Cordero',  10.90, 'Más pequeña que la pierna, muy sabrosa asada',         NULL),

-- Embutidos
('Chorizo artesanal de cerdo',  'Embutidos',12.50, 'Elaborado con pimentón de la Vera y especias propias', 'chorizo_cerdo.jpg'),
('Chorizo de pollo con hierbas','Embutidos',11.20, 'Más ligero, con tomillo y orégano frescos',            'chorizo_pollo.jpg'),
('Chorizo de cordero',          'Embutidos',13.50, 'Sabor intenso, toque de comino y pimentón suave',      'chorizo_cordero.jpg');
