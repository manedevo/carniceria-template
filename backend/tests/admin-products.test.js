'use strict';


const { api, loginAs, bearer, createProduct } = require('./helpers');

let adminToken, ventasToken;

beforeEach(async () => {
  const admin = await loginAs('admin@test.es', 'AdminPass123');
  adminToken = admin.token;

  await api.post('/api/admin/users').set(bearer(adminToken)).send({
    email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas',
  });
  const ventas = await loginAs('v@test.es', 'Ventas123');
  ventasToken = ventas.token;
});

describe('Admin products — permisos granulares', () => {
  it('Admin crea producto → 201', async () => {
    const res = await api.post('/api/admin/products').set(bearer(adminToken))
      .send({ name: 'Test', category: 'Ternera', price: 10 });
    expect(res.status).toBe(201);
  });

  it('Admin edita precio → 200', async () => {
    const { id } = await createProduct(adminToken);
    const res = await api.put(`/api/admin/products/${id}`).set(bearer(adminToken))
      .send({ name: 'Test', category: 'Ternera', price: 20, unit_type: 'kg', stock_enabled: false, active: true });
    expect(res.status).toBe(200);
  });

  it('Admin da de baja → 200', async () => {
    const { id } = await createProduct(adminToken);
    const res = await api.delete(`/api/admin/products/${id}`).set(bearer(adminToken));
    expect(res.status).toBe(200);
  });

  it('Ventas crea producto → 403', async () => {
    const res = await api.post('/api/admin/products').set(bearer(ventasToken))
      .send({ name: 'Test', category: 'Ternera', price: 10 });
    expect(res.status).toBe(403);
  });

  it('Ventas edita solo stock (sin cambiar precio) → 200', async () => {
    const { id } = await createProduct(adminToken, { price: 10 });
    const res = await api.put(`/api/admin/products/${id}`).set(bearer(ventasToken))
      .send({ name: 'Test', category: 'Ternera', price: 10, unit_type: 'kg', stock_qty: 5, stock_enabled: true, active: true });
    expect(res.status).toBe(200);
  });

  it('Ventas edita e intenta cambiar precio → 403', async () => {
    const { id } = await createProduct(adminToken, { price: 10 });
    const res = await api.put(`/api/admin/products/${id}`).set(bearer(ventasToken))
      .send({ name: 'Test', category: 'Ternera', price: 99, unit_type: 'kg', stock_enabled: false, active: true });
    expect(res.status).toBe(403);
  });

  it('Ventas da de baja producto → 403', async () => {
    const { id } = await createProduct(adminToken);
    const res = await api.delete(`/api/admin/products/${id}`).set(bearer(ventasToken));
    expect(res.status).toBe(403);
  });

  it('Ventas actualiza stock vía PATCH → 200', async () => {
    const { id } = await createProduct(adminToken);
    const res = await api.patch(`/api/admin/products/${id}/stock`).set(bearer(ventasToken))
      .send({ stock_qty: 10, stock_enabled: true });
    expect(res.status).toBe(200);
  });

  it('Ventas sin permiso change_stock: PATCH stock → 403', async () => {
    // Revocar permiso change_stock a este usuario ventas
    const users = await api.get('/api/admin/users').set(bearer(adminToken));
    const ventasUser = users.body.find(u => u.email === 'v@test.es');
    await api.put(`/api/admin/users/${ventasUser.id}`).set(bearer(adminToken))
      .send({ permissions: { change_order_status: true, change_stock: false, change_prices: false } });

    // Necesita re-login para que authenticate vuelva a leer permissions de BD
    const relogged = await loginAs('v@test.es', 'Ventas123');
    const { id } = await createProduct(adminToken);
    const res = await api.patch(`/api/admin/products/${id}/stock`).set(bearer(relogged.token))
      .send({ stock_qty: 5, stock_enabled: true });
    expect(res.status).toBe(403);
  });
});
