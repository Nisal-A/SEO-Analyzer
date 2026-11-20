import { getDbStatus } from '../config/db.js';

export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      db: getDbStatus(),
      timestamp: new Date().toISOString(),
    },
  });
};

