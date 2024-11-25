const db = require("./db");
const { PAYMENT_STATUS, TRANSFER_STATUS } = require("./types");

/**
 * Recalculate our transfer by looking at all of the payments
 * associated with this transfer, adding up what's been paid, what's still
 * pending, and then updating its status accordingly
 */
async function recalculateTransfer(transferId) {
  // 1. Get all payments related to our transfer
  const transferDetails = await db.adminGetTransferDetails(transferId);
  const payments = await db.adminGetPaymentsForTransfer(transferId);

  console.log(`payments: ${JSON.stringify(payments[0])}`);
  // 2. For any payment that's marked "settled", let's add it to our settled total
  const settledTotal = payments
    .filter(
      (payment) =>
        payment.status == PAYMENT_STATUS.SETTLED ||
        payment.status == PAYMENT_STATUS.FUNDS_AVAILABLE
    )
    .reduce((prev, payment) => prev + payment.amount_cents, 0);

  console.log(`settledTotal: ${settledTotal}`);

  // 3. For any payment that's marked "pending" or "posted", let's add it to our pending amount

  const pendingTotal = payments
    .filter(
      (payment) =>
        payment.status == PAYMENT_STATUS.PENDING ||
        payment.status == PAYMENT_STATUS.POSTED
    )
    .reduce((prev, payment) => prev + payment.amount_cents, 0);

  console.log(
    `For transfer ${transferId}, ${settledTotal} has been paid, ${pendingTotal} is pending`
  );

  // How you want to customize transfer status to the user is up to you. This is just
  // one example.
  let newTransferStatus = TRANSFER_STATUS.UNPAID;
  if (settledTotal >= transferDetails.original_amount_cents) {
    newTransferStatus = TRANSFER_STATUS.PAID;
  } else if (settledTotal + pendingTotal >= transferDetails.original_amount_cents) {
    newTransferStatus = TRANSFER_STATUS.PAID_PENDING;
  } else if (settledTotal > 0 || pendingTotal > 0) {
    newTransferStatus = TRANSFER_STATUS.PARTIALLY_PAID;
  }
  db.adminUpdateTransferStatus(transferId, newTransferStatus, settledTotal, pendingTotal);
}

module.exports = { recalculateTransfer };
