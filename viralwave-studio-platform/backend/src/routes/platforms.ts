import express from 'express';

const router = express.Router();

// Placeholder routes - to be implemented
router.get('/connected', (req, res) => {
  res.json({ message: 'Connected platforms - to be implemented' });
});

router.post('/connect', (req, res) => {
  res.json({ message: 'Platform connection endpoint - to be implemented' });
});

export { router as platformRouter };