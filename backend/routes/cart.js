import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/responseHandler.js';

const router = express.Router();

// Placeholder route for cart
router.get('/', (req, res) => {
  return sendSuccess(res, {
    message: 'Cart route working!'
  });
});

export default router;