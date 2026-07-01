'use strict';

const supertest = require('supertest');
const app       = require('../index');

const api = supertest(app);

function parseJwt(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  } catch {
    return {};
  }
}

async function loginAs(email, password) {
  const res = await api.post('/api/auth/login').send({ email, password });
  const token = res.body.token;
  const payload = token ? parseJwt(token) : {};
  return { token, user: { ...res.body, id: payload.id } };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createProduct(token, overrides = {}) {
  const res = await api.post('/api/admin/products')
    .set(bearer(token))
    .send({
      name: 'Producto Test', category: 'Ternera',
      price: 10.00, unit_type: 'kg', ...overrides,
    });
  return res.body;
}

async function makeOrder(token = null, overrides = {}) {
  const req = api.post('/api/orders').send({
    name: 'Cliente Test', phone: '600000000',
    address: 'Calle Test 1', zone: 'Chamartín / Salamanca',
    time_slot: 'Mañana (9:00–12:00)', payment_method: 'Efectivo',
    items: [{ id: 1, qty: 1 }],
    ...overrides,
  });
  if (token) req.set(bearer(token));
  return req;
}

module.exports = { api, loginAs, bearer, createProduct, makeOrder };
