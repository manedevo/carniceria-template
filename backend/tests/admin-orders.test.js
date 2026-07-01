'use strict';


const { api, loginAs, bearer, createProduct } = require('./helpers');

let adminToken, ventasToken, orderId;

beforeEach(async () => {
  const admin = await loginAs('admin@test.es', 'AdminPass123');
  adminToken = admin.token;

  await api.post('/api/admin/users').set(bearer(adminToken)).send({
    email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas',
  });
  const ventas = await loginAs('v@test.es', 'Ventas123');
  ventasToken = ventas.token;

  // Crear producto y pedido de prueba
  const { id: productId } = await createProduct(adminToken, { price: 10 });
  const orderRes = await api.post('/api/orders').send({
    name: 'Cliente Test', phone: '600000000',
    address: 'Calle 1', zone: 'Chamartín / Salamanca',
    time_slot: 'Mañana (9:00–12:00)', payment_method: 'Efectivo',
    items: [{ id: productId, qty: 1 }],
  });
  orderId = orderRes.body.id;
});

describe('Admin orders — cambio de estado', () => {
  it('Admin cambia estado → 200', async () => {
    const res = await api.put(`/api/admin/orders/${orderId}/status`)
      .set(bearer(adminToken)).send({ status: 'confirmado' });
    expect(res.status).toBe(200);
  });

  it('Ventas puede cambiar estado → 200', async () => {
    const res = await api.put(`/api/admin/orders/${orderId}/status`)
      .set(bearer(ventasToken)).send({ status: 'confirmado' });
    expect(res.status).toBe(200);
  });

  it('Ventas con change_order_status: false → 403', async () => {
    const users = await api.get('/api/admin/users').set(bearer(adminToken));
    const ventasUser = users.body.find(u => u.email === 'v@test.es');
    await api.put(`/api/admin/users/${ventasUser.id}`).set(bearer(adminToken))
      .send({ permissions: { change_order_status: false, change_stock: true, change_prices: false } });

    const relogged = await loginAs('v@test.es', 'Ventas123');
    const res = await api.put(`/api/admin/orders/${orderId}/status`)
      .set(bearer(relogged.token)).send({ status: 'cancelado' });
    expect(res.status).toBe(403);
  });

  it('Sin token → 401', async () => {
    const res = await api.put(`/api/admin/orders/${orderId}/status`).send({ status: 'confirmado' });
    expect(res.status).toBe(401);
  });

  it('Estado no válido → 400', async () => {
    const res = await api.put(`/api/admin/orders/${orderId}/status`)
      .set(bearer(adminToken)).send({ status: 'inventado' });
    expect(res.status).toBe(400);
  });
});
