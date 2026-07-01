'use strict';


const { api, loginAs, bearer, createProduct } = require('./helpers');

let adminToken, productId;

beforeEach(async () => {
  const admin = await loginAs('admin@test.es', 'AdminPass123');
  adminToken = admin.token;
  const p = await createProduct(adminToken, { price: 10 });
  productId = p.id;
});

const orderPayload = (items) => ({
  name: 'Cliente Test', phone: '600000000',
  address: 'Calle Test 1', zone: 'Chamartín / Salamanca',
  time_slot: 'Mañana (9:00–12:00)', payment_method: 'Efectivo',
  items,
});

describe('Orders — flujo de compra', () => {
  it('Pedido anónimo → 201', async () => {
    const res = await api.post('/api/orders').send(orderPayload([{ id: productId, qty: 1 }]));
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  it('Pedido anónimo → user_id es NULL', async () => {
    await api.post('/api/orders').send(orderPayload([{ id: productId, qty: 1 }]));
    const orders = await api.get('/api/admin/orders').set(bearer(adminToken));
    const last = orders.body[0];
    expect(last.user_id).toBeNull();
  });

  it('Pedido autenticado → user_id no es NULL', async () => {
    const cliente = await api.post('/api/auth/register').send({ email: 'c@test.es', password: 'Cliente1', name: 'C' });
    await api.post('/api/orders').set(bearer(cliente.body.token))
      .send(orderPayload([{ id: productId, qty: 1 }]));
    const orders = await api.get('/api/admin/orders').set(bearer(adminToken));
    const last = orders.body[0];
    expect(last.user_id).not.toBeNull();
  });

  it('Pedido con artículos vacíos → 400', async () => {
    const res = await api.post('/api/orders').send(orderPayload([]));
    expect(res.status).toBe(400);
  });

  it('Pedido sin campo obligatorio → 400', async () => {
    const res = await api.post('/api/orders').send({ name: 'X', items: [{ id: productId, qty: 1 }] });
    expect(res.status).toBe(400);
  });

  it('El precio viene del servidor, no del cliente', async () => {
    await api.post('/api/orders').send({
      ...orderPayload([{ id: productId, qty: 1, price: 9999 }]),
    });
    const orders = await api.get('/api/admin/orders').set(bearer(adminToken));
    const last = orders.body[0];
    expect(parseFloat(last.total)).toBe(10); // precio real, no el manipulado
  });

  it('GET /api/admin/orders devuelve los pedidos', async () => {
    await api.post('/api/orders').send(orderPayload([{ id: productId, qty: 2 }]));
    const res = await api.get('/api/admin/orders').set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
