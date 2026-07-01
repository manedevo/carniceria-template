'use strict';


const { api, loginAs, bearer, createProduct } = require('./helpers');

let adminToken, ventasToken, clienteToken;

beforeEach(async () => {
  const admin = await loginAs('admin@test.es', 'AdminPass123');
  adminToken = admin.token;

  await api.post('/api/admin/users').set(bearer(adminToken)).send({
    email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas',
  });
  const ventas = await loginAs('v@test.es', 'Ventas123');
  ventasToken = ventas.token;

  const cli = await api.post('/api/auth/register').send({ email: 'c@test.es', password: 'Cliente1', name: 'C' });
  clienteToken = cli.body.token;
});

describe('Dashboard — accesos por rol', () => {
  it('Admin: GET /api/admin/products → 200', async () => {
    const res = await api.get('/api/admin/products').set(bearer(adminToken));
    expect(res.status).toBe(200);
  });

  it('Ventas: GET /api/admin/products → 200', async () => {
    const res = await api.get('/api/admin/products').set(bearer(ventasToken));
    expect(res.status).toBe(200);
  });

  it('Ventas: POST /api/admin/products → 403', async () => {
    const res = await api.post('/api/admin/products').set(bearer(ventasToken))
      .send({ name: 'X', category: 'Ternera', price: 5 });
    expect(res.status).toBe(403);
  });

  it('Ventas: PATCH /api/admin/products/:id/stock → 200', async () => {
    const { id } = await createProduct(adminToken);
    const res = await api.patch(`/api/admin/products/${id}/stock`).set(bearer(ventasToken))
      .send({ stock_qty: 5, stock_enabled: true });
    expect(res.status).toBe(200);
  });

  it('Ventas: PUT /api/admin/products/:id sin cambiar price → 200', async () => {
    const { id } = await createProduct(adminToken, { price: 10 });
    const res = await api.put(`/api/admin/products/${id}`).set(bearer(ventasToken))
      .send({ name: 'Test', category: 'Ternera', price: 10, unit_type: 'kg', stock_enabled: false, active: true });
    expect(res.status).toBe(200);
  });

  it('Ventas: PUT /api/admin/products/:id con price distinto → 403', async () => {
    const { id } = await createProduct(adminToken, { price: 10 });
    const res = await api.put(`/api/admin/products/${id}`).set(bearer(ventasToken))
      .send({ name: 'Test', category: 'Ternera', price: 99, unit_type: 'kg', stock_enabled: false, active: true });
    expect(res.status).toBe(403);
  });

  it('Admin: GET /api/admin/users → 200', async () => {
    const res = await api.get('/api/admin/users').set(bearer(adminToken));
    expect(res.status).toBe(200);
  });

  it('Ventas: GET /api/admin/users → 403', async () => {
    const res = await api.get('/api/admin/users').set(bearer(ventasToken));
    expect(res.status).toBe(403);
  });

  it('Cliente: GET /api/admin/products → 403', async () => {
    const res = await api.get('/api/admin/products').set(bearer(clienteToken));
    expect(res.status).toBe(403);
  });

  it('Cliente: GET /api/admin/orders → 403', async () => {
    const res = await api.get('/api/admin/orders').set(bearer(clienteToken));
    expect(res.status).toBe(403);
  });
});
