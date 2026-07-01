'use strict';

const VENTAS_DEFAULTS = {
  change_order_status: true,
  change_stock:        true,
  change_prices:       false,
};

module.exports = function hasPermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.role === 'admin') return next();

    const perms = user.permissions ?? VENTAS_DEFAULTS;

    if (perms[permission]) return next();
    return res.status(403).json({ error: 'Sin permisos suficientes' });
  };
};
