import express from 'express';

const router = express.Router();

// Placeholder routes - to be implemented
router.get('/profile', (req, res) => {
  res.json({ message: 'User profile endpoint - to be implemented' });
});

router.put('/profile', (req, res) => {
  res.json({ message: 'Update profile endpoint - to be implemented' });
});

export { router as userRouter };