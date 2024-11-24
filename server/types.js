
// Just a couple of enum-like objects that we use to represent the status of
// payments and transfers. 
const PAYMENT_STATUS = {
  NEW: "new",
  INTENT_PENDING: "intent_pending",
  DENIED: "denied",
  PENDING: "pending",
  POSTED: "posted",
  SETTLED: "settled",
  FAILED: "failed",
  CANCELLED: "cancelled",
  RETURNED: "returned",
};

const TRANSFER_STATUS = {
  UNPAID: "unpaid",
  PAID: "paid",
  PAID_PENDING: "paid_pending",
  PARTIALLY_PAID: "partially_paid",
};

module.exports = { PAYMENT_STATUS, TRANSFER_STATUS };
