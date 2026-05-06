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
('Carne picada de ternera',     'Ternera',   7.90, 'Ideal para albóndigas, boloñesa y rellenos',           'v2_watermarked-111bd476-17af-41ec-9226-99bedc67a38a.jpg'),
('Carne para guisar',           'Ternera',   9.50, 'Troceada al punto, perfecta para estofados',           'TH3Bz.jpg'),
('Filete de ternera',           'Ternera',  14.50, 'Corte limpio, listo para la plancha',                  'v2_watermarked-e19737a2-d3b2-4741-953d-345f6d125dfe.jpg'),
('Solomillo de ternera',        'Ternera',  22.90, 'El corte más tierno. Vuelta y vuelta o al horno',      'v2_watermarked-746b6f19-80f8-44ef-9b45-ed6a505eb424.jpg'),
('Entrecot de ternera',         'Ternera',  18.50, 'Veteado natural, sabor intenso a la brasa',            'dD9cI.jpg'),
('Costilla de ternera',         'Ternera',   8.20, 'Perfecta a fuego lento o en el horno',                 '4CrMX.jpg'),
('Morcillo de ternera',         'Ternera',   9.90, 'Meloso y gelatinoso, perfecto para caldos y guisos',   'v2_watermarked-95c90697-4429-4f27-8dee-effda130cec9.jpg'),
('Selección magra de ternera',  'Ternera',  12.50, 'Cortes bajos en grasa, ideales para dietas',           'v2_watermarked-746b6f19_1.jpg'),

-- Cerdo
('Chuleta ahumada de cerdo',    'Cerdo',    11.90, 'Curada en casa, lista para la sartén',                 'v2_watermarked-6e7d5988-8b43-44ae-8c5b-1d1a23bbc7d4.jpg'),
('Costillas de cerdo',          'Cerdo',     9.20, 'Marinadas con nuestra receta tradicional',             'TH3Bz_1.jpg'),
('Lomo de cerdo',               'Cerdo',    10.50, 'Jugoso y versátil: a la plancha, asado o en salsa',    'uIsRh.jpg'),
('Chuletas frescas de cerdo',   'Cerdo',     8.50, 'Corte clásico, sin ahumar',                            '2dCcs.jpg'),
('Secreto ibérico',             'Cerdo',    14.90, 'Pieza selecta entre la paleta y el lomo',              'v2_watermarked-95c90697-4429-4f27-8dee-effda130cec9.jpg'),

-- Pollo
('Alitas de pollo',             'Pollo',     4.50, 'Para el horno, la freidora o la barbacoa',             'v2_watermarked-eb3299e4-d65c-4abf-bcaf-0e5081a3b57e.jpg'),
('Muslos de pollo',             'Pollo',     4.20, 'Con hueso, jugosos y económicos',                      'BUwNE.jpg'),
('Contramuslo deshuesado',      'Pollo',     8.50, 'Sin hueso ni grasa excesiva, rápido de cocinar',       'v2_watermarked-95c90697-4429-4f27-8dee-effda130cec9.jpg'),
('Filete de pechuga',           'Pollo',     9.20, 'Finamente laminado, ideal para empanados y salteados', 'v2_watermarked-e19737a2-d3b2-4741-953d-345f6d125dfe.jpg'),
('Tiras para fajita',           'Pollo',     9.20, 'Precortadas, sazonadas con especias suaves',           'v2_watermarked-746b6f19-80f8-44ef-9b45-ed6a505eb424.jpg'),
('Pollo entero',                'Pollo',     4.10, 'Pollo fresco de corral, limpio y listo para asar',     'uIsRh.jpg'),
('Pollo de campo',              'Pollo',     5.30, 'Criado en libertad, sabor más pronunciado',            'dD9cI.jpg'),
('Pechuga picada de pollo',     'Pollo',     8.20, 'Base perfecta para hamburguesas ligeras y albóndigas', 'v2_watermarked-eb3299e4-d65c-4abf-bcaf-0e5081a3b57e.jpg'),
('Churrasco de pollo',          'Pollo',     8.50, 'Abierto en mariposa, listo para la brasa',             'v2_watermarked-6e7d5988-8b43-44ae-8c5b-1d1a23bbc7d4.jpg'),
('Hígado de pollo',             'Pollo',     3.20, 'Rico en hierro, para paté casero o salteado',          'v2_watermarked-01fb78f3-568e-4611-b976-2bc7431a38d9.jpg'),
('Mollejas de pollo',           'Pollo',     4.00, 'Para arroces, salteados y pinchos',                    'v2_watermarked-01fb78f3-568e-4611-b976-2bc7431a38d9.jpg'),

-- Cordero
('Chuletas de lechal',          'Cordero',  14.90, 'Pequeñas y tiernas, a la brasa en minutos',            'v2_watermarked-074faed2-a5c1-4a93-81e6-dee21912d692.jpg'),
('Cordero para guisar',         'Cordero',  12.50, 'Troceado con hueso, ideal para calderetas',            '2dCcs_1.jpg'),
('Pierna de cordero',           'Cordero',  11.50, 'Entera o troceada, perfecta para el horno',            'v2_watermarked-4f8d4331-8057-486f-ade6-c7788ccb9074.jpg'),
('Paletilla de cordero',        'Cordero',  10.90, 'Más pequeña que la pierna, muy sabrosa asada',         'BUwNE.jpg'),

-- Embutidos
('Chorizo artesanal de cerdo',  'Embutidos',12.50, 'Elaborado con pimentón de la Vera y especias propias', 'v2_watermarked-be56e688-6f20-40a8-9af1-cbc653790c56.jpg'),
('Chorizo de pollo con hierbas','Embutidos',11.20, 'Más ligero, con tomillo y orégano frescos',            'v2_watermarked-be56e688-6f20-40a8-9af1-cbc653790c56.jpg'),
('Chorizo de cordero',          'Embutidos',13.50, 'Sabor intenso, toque de comino y pimentón suave',      'v2_watermarked-be56e688-6f20-40a8-9af1-cbc653790c56.jpg');
