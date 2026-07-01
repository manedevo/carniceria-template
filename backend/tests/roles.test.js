'use strict';


const { api, loginAs, bearer, createProduct } = require('./helpers');

let adminToken, ventasToken, clienteToken;

beforeEach(async () => {
  const admin = await loginAs('admin@test.es', 'AdminPass123');
  adminToken = admin.token;

  // Crear usuario ventas
  await api.post('/api/admin/users').set(bearer(adminToken)).send({
    email: 'ventas@test.es', password: 'Ventas123', name: 'Vendedor', role: 'ventas',
  });
  const ventas = await loginAs('ventas@test.es', 'Ventas123');
  ventasToken = ventas.token;

  // Crear usuario cliente
  const cli = await api.post('/api/auth/register').send({
    email: 'cliente@test.es', password: 'Cliente1', name: 'Cliente',
  });
  clienteToken = cli.body.token;
});

describe('Roles — acceso a rutas admin', () => {
  it('Admin crea usuario ventas vía POST /api/admin/users → 201', async () => {
    const res = await api.post('/api/admin/users').set(bearer(adminToken)).send({
      email: 'ventas2@test.es', password: 'Ventas1234', name: 'Vendedor2', role: 'ventas',
    });
    expect(res.status).toBe(201);
  });

  it('Admin crea usuario admin vía POST /api/admin/users → 201', async () => {
    const res = await api.post('/api/admin/users').set(bearer(adminToken)).send({
      email: 'admin2@test.es', password: 'Admin12345', name: 'Admin2', role: 'admin',
    });
    expect(res.status).toBe(201);
  });

  it('Ventas accede a GET /api/admin/products → 200', async () => {
    const res = await api.get('/api/admin/products').set(bearer(ventasToken));
    expect(res.status).toBe(200);
  });

  it('Ventas accede a POST /api/admin/products → 403', async () => {
    const res = await api.post('/api/admin/products').set(bearer(ventasToken))
      .send({ name: 'X', category: 'Ternera', price: 5 });
    expect(res.status).toBe(403);
  });

  it('Ventas accede a DELETE /api/admin/products/:id → 403', async () => {
    const p = await createProduct(adminToken);
    const res = await api.delete(`/api/admin/products/${p.id}`).set(bearer(ventasToken));
    expect(res.status).toBe(403);
  });

  it('Ventas accede a GET /api/admin/promotions → 403', async () => {
    const res = await api.get('/api/admin/promotions').set(bearer(ventasToken));
    expect(res.status).toBe(403);
  });

  it('Cliente accede a GET /api/admin/products → 403', async () => {
    const res = await api.get('/api/admin/products').set(bearer(clienteToken));
    expect(res.status).toBe(403);
  });

  it('Sin token en ruta admin → 401', async () => {
    const res = await api.get('/api/admin/products');
    expect(res.status).toBe(401);
  });
});
