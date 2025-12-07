import express from 'express';

const router = express.Router();

// Placeholder routes - to be implemented
router.get('/dashboard', (req, res) => {
  res.json({ message: 'Analytics dashboard - to be implemented' });
});

router.get('/performance', (req, res) => {
  res.json({ message: 'Performance metrics - to be implemented' });
});

export { router as analyticsRouter };