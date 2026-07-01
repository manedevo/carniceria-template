'use strict';


const { api, loginAs, bearer } = require('./helpers');

describe('Auth', () => {
  it('POST /api/auth/register — crea usuario cliente', async () => {
    const res = await api.post('/api/auth/register').send({
      email: 'nuevo@test.es', password: 'Nuevo1234', name: 'Nuevo',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
  });

  it('POST /api/auth/register — email duplicado → 409', async () => {
    await api.post('/api/auth/register').send({ email: 'dup@test.es', password: 'Dup12345', name: 'Dup' });
    const res = await api.post('/api/auth/register').send({ email: 'dup@test.es', password: 'Dup12345', name: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/register — contraseña corta → 400', async () => {
    const res = await api.post('/api/auth/register').send({ email: 'x@test.es', password: '123', name: 'X' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login — credenciales correctas', async () => {
    const { token } = await loginAs('admin@test.es', 'AdminPass123');
    expect(token).toBeTruthy();
  });

  it('POST /api/auth/login — contraseña incorrecta → 401', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'admin@test.es', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me — token válido → datos del usuario', async () => {
    const { token } = await loginAs('admin@test.es', 'AdminPass123');
    const res = await api.get('/api/auth/me').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.es');
  });

  it('GET /api/auth/me — sin token → 401', async () => {
    const res = await api.get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me — token inválido → 401', async () => {
    const res = await api.get('/api/auth/me').set({ Authorization: 'Bearer token-falso' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/register con role: admin en body → crea como cliente', async () => {
    const res = await api.post('/api/auth/register').send({
      email: 'hacker@test.es', password: 'Hacker123', name: 'Hacker', role: 'admin',
    });
    expect(res.status).toBe(201);
    const me = await api.get('/api/auth/me').set(bearer(res.body.token));
    expect(me.body.role).toBe('cliente');
  });
});
