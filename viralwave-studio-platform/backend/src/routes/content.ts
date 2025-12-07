import express from 'express';

const router = express.Router();

// Placeholder routes - to be implemented
router.get('/', (req, res) => {
  res.json({ message: 'Content management endpoints - to be implemented' });
});

router.post('/generate', (req, res) => {
  res.json({ message: 'Content generation endpoint - to be implemented' });
});

export { router as contentRouter };