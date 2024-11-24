const express = require("express");
const { getUserObject } = require("../utils");
const db = require("../db");
const authenticate = require("../middleware/authenticate");

const router = express.Router();
router.use(authenticate);


/**
 * Create a new transfer record
 */
router.post("/create", async (req, res, next) => {
  try {
    const userId = req.userId;
    const { amount } = req.body;

    // Validate amount
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Generate a transfer ID
    const transferId = `TR${Date.now().toString().slice(-6)}`;
    const description = `Transfer to Co2Trust - ${transferId}`;

    const result = await db.createNewBill(userId, amount, description);

    res.json({
      id: result.lastID,
      transferId,
      amount,
      description,
      status: 'Unpaid',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List all the transfers for the current signed-in user.
 */
router.get("/list", async (req, res, next) => {
  try {
    const userId = req.userId;
    const result = await db.getBillsForUser(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get the details of a specific bill for the current signed-in user.
 */
router.post("/get", async (req, res, next) => {
  try {
    const userId = req.userId;
    const { billId } = req.body;
    const result = await db.getBillDetailsForUser(userId, billId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});


module.exports = router;
