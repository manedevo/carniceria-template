'use strict';


const { api, loginAs, bearer } = require('./helpers');

let adminToken, adminId;

beforeEach(async () => {
  const admin = await loginAs('admin@test.es', 'AdminPass123');
  adminToken = admin.token;
  adminId    = admin.user.id;
});

describe('Admin users CRUD', () => {
  it('Admin lista usuarios → 200 con admin semilla', async () => {
    const res = await api.get('/api/admin/users').set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.some(u => u.email === 'admin@test.es')).toBe(true);
  });

  it('Admin crea usuario ventas → 201', async () => {
    const res = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  it('Admin crea usuario cliente → 201', async () => {
    const res = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'c@test.es', password: 'Cliente1', name: 'Cliente', role: 'cliente' });
    expect(res.status).toBe(201);
  });

  it('Admin crea usuario admin → 201', async () => {
    const res = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'a2@test.es', password: 'Admin12345', name: 'Admin2', role: 'admin' });
    expect(res.status).toBe(201);
  });

  it('Admin crea usuario con email duplicado → 409', async () => {
    await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'dup@test.es', password: 'Dup12345', name: 'Dup', role: 'cliente' });
    const res = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'dup@test.es', password: 'Dup12345', name: 'Dup', role: 'cliente' });
    expect(res.status).toBe(409);
  });

  it('Admin cambia rol de ventas a cliente → 200', async () => {
    const { body: { id } } = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas' });
    const res = await api.put(`/api/admin/users/${id}`).set(bearer(adminToken))
      .send({ role: 'cliente' });
    expect(res.status).toBe(200);
  });

  it('Admin intenta cambiar su propio rol → 400', async () => {
    const res = await api.put(`/api/admin/users/${adminId}`).set(bearer(adminToken))
      .send({ role: 'ventas' });
    expect(res.status).toBe(400);
  });

  it('Admin desactiva usuario → 200', async () => {
    const { body: { id } } = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas' });
    const res = await api.put(`/api/admin/users/${id}`).set(bearer(adminToken))
      .send({ active: false });
    expect(res.status).toBe(200);
  });

  it('Admin elimina usuario → 200', async () => {
    const { body: { id } } = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas' });
    const res = await api.delete(`/api/admin/users/${id}`).set(bearer(adminToken));
    expect(res.status).toBe(200);
  });

  it('Admin intenta eliminarse a sí mismo → 400', async () => {
    const res = await api.delete(`/api/admin/users/${adminId}`).set(bearer(adminToken));
    expect(res.status).toBe(400);
  });

  it('Admin actualiza permisos de ventas → 200', async () => {
    const { body: { id } } = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas' });
    const res = await api.put(`/api/admin/users/${id}`).set(bearer(adminToken))
      .send({ permissions: { change_order_status: true, change_stock: false, change_prices: false } });
    expect(res.status).toBe(200);
  });

  it('Ventas: GET /api/admin/users → 403', async () => {
    await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas' });
    const { token } = await loginAs('v@test.es', 'Ventas123');
    const res = await api.get('/api/admin/users').set(bearer(token));
    expect(res.status).toBe(403);
  });

  it('Cliente: DELETE /api/admin/users/:id → 403', async () => {
    const { body: { id } } = await api.post('/api/admin/users').set(bearer(adminToken))
      .send({ email: 'v@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas' });
    const cli = await api.post('/api/auth/register').send({ email: 'c@test.es', password: 'Cliente1', name: 'C' });
    const res = await api.delete(`/api/admin/users/${id}`).set(bearer(cli.body.token));
    expect(res.status).toBe(403);
  });
});
