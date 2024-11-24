const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const dbWrapper = require("sqlite");
const { v4: uuidv4 } = require("uuid");
const { PAYMENT_STATUS } = require("./types");

// You may want to have this point to different databases based on your environment
const databaseFile = "./database/appdata.db";
let db;

// Set up our database
const existingDatabase = fs.existsSync(databaseFile);

const createUsersTableSQL =
  "CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL)";
const createItemsTableSQL =
  "CREATE TABLE items (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, " +
  "access_token TEXT NOT NULL, bank_name TEXT, " +
  "is_active INTEGER NOT_NULL DEFAULT 1, " +
  "created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP, " +
  "FOREIGN KEY(user_id) REFERENCES users(id))";
const createAccountsTableSQL =
  "CREATE TABLE accounts (id TEXT PRIMARY KEY, item_id TEXT NOT NULL, " +
  "name TEXT, cached_balance FLOAT, FOREIGN KEY(item_id) REFERENCES items(id))";
const createTransfersTableSQL =
  "CREATE TABLE transfers (id TEXT PRIMARY KEY,  user_id TEXT NOT NULL, " +
  "created_date TEXT, description TEXT, original_amount_cents INT, paid_total_cents INT DEFAULT 0, " +
  "pending_total_cents INT DEFAULT 0, status TEXT, " +
  "FOREIGN KEY(user_id) REFERENCES users(id))";
const createPaymentsTableSQL = `CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  plaid_intent_id TEXT,
  plaid_id TEXT,
  plaid_auth_id TEXT,
  user_id TEXT NOT NULL,
  transfer_id TEXT NOT NULL,
  account_id TEXT,
  amount_cents INT,
  authorized_status TEXT,
  auth_reason TEXT,
  failure_reason TEXT,
  status TEXT,
  created_date TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(transfer_id) REFERENCES transfers(id),
  FOREIGN KEY(account_id) REFERENCES accounts(id)
)`;

// A simple key-value store for app data -- we only use this to store the 
// "last sync event processed" number
const createAppTableSQL = `CREATE TABLE appdata (
  key TEXT PRIMARY KEY,
  value TEXT
)`;

dbWrapper
  .open({ filename: databaseFile, driver: sqlite3.Database })
  .then(async (dBase) => {
    db = dBase;
    try {
      if (!existingDatabase) {
        // Database doesn't exist yet -- let's create it!
        await db.run(createUsersTableSQL);
        await db.run(createItemsTableSQL);
        await db.run(createAccountsTableSQL);
        await db.run(createTransfersTableSQL);
        await db.run(createPaymentsTableSQL);
        await db.run(createAppTableSQL);

        // Insert default user
        await db.run(
          `INSERT INTO users (id, username, first_name, last_name, email) 
   VALUES (?, ?, ?, ?, ?)`,
          [
            "6976e07c-cf5e-4769-9c0c-1cf4b1e6e367",
            "john",
            "John",
            "Ashurst",
            "john@co2trust.earth"
          ]
        );

      } else {
        // Works around the rare instance where a database gets created, but the tables don't
        const tableNames = await db.all(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );
        const tableNamesToCreationSQL = {
          users: createUsersTableSQL,
          items: createItemsTableSQL,
          accounts: createAccountsTableSQL,
          transfers: createTransfersTableSQL,
          payments: createPaymentsTableSQL,
          appdata: createAppTableSQL,
        };
        for (const [tableName, creationSQL] of Object.entries(
          tableNamesToCreationSQL
        )) {
          if (!tableNames.some((table) => table.name === tableName)) {
            console.log(`Creating ${tableName} table`);
            await db.run(creationSQL);
          }
        }
        console.log("Database is up and running!");
        sqlite3.verbose();
      }
    } catch (dbError) {
      console.error(dbError);
    }
  });

// Helper function that exposes the db if you wan to run SQL on it
// directly. Only recommended for debugging.
const debugExposeDb = function () {
  return db;
};

/***********************************************
 * Functions related to fetching or adding items
 * and accounts for a user
 * **********************************************/

const getItemsAndAccountsForUser = async function (userId) {
  try {
    const items = await db.all(
      `SELECT items.bank_name, accounts.id as account_id, accounts.name as account_name, accounts.cached_balance as balance
        FROM items JOIN accounts ON items.id = accounts.item_id
        WHERE items.user_id=? AND items.is_active = 1`,
      userId
    );
    return items;
  } catch (error) {
    console.error(`Error getting items and accounts for user ${error}`);
    throw error;
  }
};

const getItemInfoForAccountAndUser = async function (accountId, userId) {
  try {
    const item = await db.get(
      `SELECT items.id, items.access_token, items.bank_name, items.created_time
        FROM items JOIN accounts ON items.id = accounts.item_id
        WHERE accounts.id = ? AND items.user_id = ?`,
      accountId,
      userId
    );
    return item;
  } catch (error) {
    console.error(`Error getting item for account ${error}`);
    throw error;
  }
};

const getAccessTokenForUserAndAccount = async function (userId, accountId) {
  try {
    const item = await db.get(
      `SELECT items.access_token
        FROM items JOIN accounts ON items.id = accounts.item_id
        WHERE accounts.id = ? and items.user_id = ?`,
      accountId,
      userId
    );

    return item.access_token;
  } catch (error) {
    console.error(`Error getting access token for user and account ${error}`);
    throw error;
  }
};

const getAccessTokenForUserAndItem = async function (userId, itemId) {
  try {
    const item = await db.get(
      `SELECT id, access_token FROM items WHERE id = ? and user_id = ?`,
      itemId,
      userId
    );

    return item.access_token;
  } catch (error) {
    console.error(`Error getting access token for user and item ${error}`);
    throw error;
  }
};

const addItem = async function (itemId, userId, accessToken) {
  try {
    const result = await db.run(
      `INSERT INTO items(id, user_id, access_token) VALUES(?, ?, ?)`,
      itemId,
      userId,
      accessToken
    );
    return result;
  } catch (error) {
    console.error(`Error adding item ${error}`);
    throw error;
  }
};

const addBankNameForItem = async function (itemId, institutionName) {
  try {
    const result = await db.run(
      `UPDATE items SET bank_name=? WHERE id =?`,
      institutionName,
      itemId
    );
    return result;
  } catch (error) {
    console.error(`Error adding bank name for item ${error}`);
    throw error;
  }
};

const addAccount = async function (accountId, itemId, acctName, balance) {
  try {
    await db.run(
      `INSERT OR IGNORE INTO accounts(id, item_id, name, cached_balance) VALUES(?, ?, ?, ?)`,
      accountId,
      itemId,
      acctName,
      balance
    );
  } catch (error) {
    console.error(`Error adding account ${error}`);
    throw error;
  }
};

/***********************************************
 * Functions related to Users
 * **********************************************/

const addUser = async function (userId, username, firstName, lastName, email) {
  try {
    const result = await db.run(
      `INSERT INTO users(id, username, first_name, last_name, email) VALUES(?, ?, ?, ?, ?)`,
      userId,
      username,
      firstName,
      lastName,
      email
    );
    return result;
  } catch (error) {
    console.error(`Error adding user ${error}`);
    throw error;
  }
};

const getUserList = async function () {
  try {
    const result = await db.all(`SELECT id, username FROM users`);
    return result;
  } catch (error) {
    console.error(`Error getting user list ${error}`);
    throw error;
  }
};

const getUserRecord = async function (userId) {
  try {
    const result = await db.get(`SELECT * FROM users WHERE id=?`, userId);
    return result;
  } catch (error) {
    console.error(`Error getting user record ${error}`);
    throw error;
  }
};

const getBankNamesForUser = async function (userId) {
  try {
    const result = await db.all(
      `SELECT id, bank_name
        FROM items WHERE user_id=? AND is_active = 1`,
      userId
    );
    return result;
  } catch (error) {
    console.error(`Error getting bank names for user ${error}`);
    throw error;
  }
};

// Helper function to generate transfer ID
function generateTransferId() {
  // You can customize this format as needed
  return `TR${Date.now().toString().slice(-6)}`;
}

/***********************************************
 * Functions related to Transfers
 **********************************************/
const createNewTransfer = async function (userId, amount, description) {
  try {
    const transferId = generateTransferId();

    // Convert amount to cents as per original schema
    const amountInCents = Math.round(amount * 100);

    const result = await db.run(
      `INSERT INTO transfers(id, user_id, created_date, description, original_amount_cents, paid_total_cents, pending_total_cents, status) 
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      transferId,
      userId,
      new Date().toISOString(),
      description,
      amountInCents,
      0,
      0,
      'Unpaid'
    );

    console.log(`Transfer created with ID: ${transferId}`);
    console.log(`Result: ${JSON.stringify(result)}`);

    return {
      id: transferId,
      amount: amount,
      description,
      status: 'Unpaid'
    };
  } catch (error) {
    console.error(`Error creating transfer ${error}`);
    throw error;
  }
};



const getTransfersForUser = async function (userId) {
  try {
    const result = await db.all(
      `SELECT * from transfers WHERE user_id = ?`,
      userId
    );
    return result;
  } catch (error) {
    console.error(`Error getting transfers for user ${error}`);
    throw error;
  }
};

const getTransferDetailsForUser = async function (userId, transferId) {
  try {
    const result = await db.get(
      `SELECT * from transfers WHERE user_id = ? AND id = ?`,
      userId,
      transferId
    );
    return result;
  } catch (error) {
    console.error(`Error getting transfer details for user ${error}`);
    throw error;
  }
};

/***********************************************
 * Functions related to Payments
 * **********************************************/

const createPaymentForUser = async function (
  userId,
  transferId,
  plaidIntentId,
  accountId,
  amount_cents
) {
  try {
    // Our user is kicking off a payment, so let's record those details in the database.
    // We won't store the account ID yet, becuase we might not know it.
    const paymentId = uuidv4();
    const _ = await db.run(
      `INSERT INTO payments(id, user_id, transfer_id, plaid_intent_id, account_id, amount_cents, status, created_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      paymentId,
      userId,
      transferId,
      plaidIntentId,
      accountId,
      amount_cents,
      "waiting_for_auth",
      new Date().toISOString()
    );
    return paymentId;
  } catch (error) {
    console.error(`Error creating payment ${error}`);
    throw error;
  }
};

const updatePaymentWithTransferIntent = async function (
  userId,
  transferIntentId,
  transferId,
  accountId,
  authorizationDecision,
  authorizationRationale,
  intentStatus
) {
  // From the user's perspective, has this payment attempt been successful? This involves both
  // whether the transfer intent succeeded, and if the authorization succeeded

  try {
    let paymentStatus = "";
    if (intentStatus === "SUCCEEDED") {
      if (authorizationDecision === "APPROVED") {
        paymentStatus = PAYMENT_STATUS.NEW;
        // Approved decisions that come with a rationale still might require a
        // second look. Usually this is for banks where Plaid can't verify their
        // account balance.
        if (authorizationRationale != null) {
          console.warn(
            "You might want to handle this:",
            authorizationRationale
          );
        }
      } else if (authorizationDecision === "DENIED") {
        paymentStatus = PAYMENT_STATUS.DENIED;
      }
    } else if (intentStatus === "FAILED") {
      paymentStatus = PAYMENT_STATUS.FAILED;
    } else if (intentStatus === "PENDING") {
      paymentStatus = PAYMENT_STATUS.INTENT_PENDING;
    }
    const _ = await db.run(
      `UPDATE payments SET plaid_id=?, account_id = ?, authorized_status=?, auth_reason=?, status=? WHERE user_id=? AND plaid_intent_id=?`,
      transferId,
      accountId,
      authorizationDecision,
      authorizationRationale,
      paymentStatus,
      userId,
      transferIntentId
    );
  } catch (error) {
    console.error(`Error updating payment ${error}`);
    throw error;
  }
};

const addPaymentAuthorization = async function (
  paymentId,
  authId,
  authStatus,
  decisionRationale
) {
  try {
    const _ = await db.run(
      `UPDATE payments SET plaid_auth_id=?, authorized_status=?, auth_reason=? WHERE id=?`,
      authId,
      authStatus,
      decisionRationale,
      paymentId
    );
  } catch (error) {
    console.error(`Error adding payment authorization ${error}`);
    throw error;
  }
};

const updatePaymentWithTransferInfo = async function (
  paymentId,
  transferId,
  status,
  failureReason
) {
  try {
    const _ = await db.run(
      `UPDATE payments SET plaid_id=?, status=?, failure_reason=? WHERE id=?`,
      transferId,
      status,
      failureReason,
      paymentId
    );
  } catch (error) {
    console.error(`Error updating payment creation ${error}`);
    throw error;
  }
};

const updatePaymentWithAccountId = async function (
  userId,
  plaidTransferId,
  newAccountId
) {
  try {
    const _ = await db.run(
      `UPDATE payments SET account_id=? WHERE user_id=? AND plaid_id=?`,
      newAccountId,
      userId,
      plaidTransferId
    );
  } catch (error) {
    console.error(`Error updating payment with account ID ${error}`);
    throw error;
  }
};

const getPaymentByPlaidId = async function (plaidId) {
  try {
    const payment = await db.get(
      `SELECT * FROM payments WHERE plaid_id = ?`,
      plaidId
    );
    return payment;
  } catch (error) {
    console.error(`Error getting payment by plaid ID ${error}`);
    throw error;
  }
};

const getPaymentsForUserTransfer = async function (userId, transferId) {
  try {
    const payments = await db.all(
      `SELECT * FROM payments WHERE user_id = ? AND transfer_id = ?`,
      userId,
      transferId
    );
    return payments;
  } catch (error) {
    console.error(`Error getting payments for user and transfer ${error}`);
    throw error;
  }
};

const updatePaymentStatus = async (
  paymentId,
  status,
  transferId,
  optionalError
) => {
  try {
    const { recalculateTransfer } = require("./recalculateTransfers");
    await db.run("BEGIN TRANSACTION");
    const updatePaymentResult = await db.run(
      `UPDATE payments SET status=? WHERE id=?`,
      status,
      paymentId
    );
    if (updatePaymentResult.changes < 1) {
      throw new Error(`Couldn't find payment with id ${paymentId}`);
    }
    if (optionalError) {
      await db.run(
        `UPDATE payments SET failure_reason=? WHERE id=?`,
        optionalError,
        paymentId
      );
    }

    await recalculateTransfer(transferId);
    // TODO: Recalculate the transfer's status based on the payments
    await db.run("COMMIT");
  } catch (error) {
    await db.run("ROLLBACK");
    console.log("Transaction rolled back due to error:", error);
    throw error;
  }
};

const storeProofOfAuthorization = async function (importantDataToStore) {
  // We're not going to implement this function in this example, but you
  // should store this data for at least two years.
  console.log("Storing proof of authorization data:");
  console.log(JSON.stringify(importantDataToStore));
};

/**********************
 * App Data -- Fetch (and store) the last event we synced
 **********************/
const getLastSyncNum = async function () {
  try {
    const maybeRow = await db.get(
      `SELECT key, value from appdata WHERE key = 'last_sync'`
    );
    if (maybeRow == null) {
      return null;
    }
    return Number(maybeRow.value);
  } catch (error) {
    console.error(`Error getting last sync number ${error}`);
    throw error;
  }
};

const setLastSyncNum = async function (syncNum) {
  try {
    await db.run(
      `INSERT INTO appdata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      ["last_sync", syncNum.toString()]
    );
  } catch (error) {
    console.error(`Error setting last sync number: ${error}`);
    throw error;
  }
};

/********************************
 * I'm calling these "admin" functions, in that we don't check the userID
 * Meaning they shouldn't be called in response to a user action
 *******************************/

const adminGetTransferDetails = async function (transferId) {
  try {
    const transferDetails = await db.get(
      `SELECT * FROM transfers where id = ?`,
      transferId
    );
    return transferDetails;
  } catch (error) {
    console.error(`Error getting last sync number ${error}`);
    throw error;
  }
};

const adminGetPaymentsForTransfer = async function (transferId) {
  try {
    const payments = await db.all(
      `SELECT * FROM payments WHERE transfer_id = ?`,
      transferId
    );
    return payments;
  } catch (error) {
    console.error(`Error getting payments for transfer ${error}`);
    throw error;
  }
};

const adminUpdateTransferStatus = async function (
  transferId,
  newTransferStatus,
  settledTotal,
  pendingTotal
) {
  try {
    const updateResult = await db.run(
      `UPDATE transfers SET status=?, paid_total_cents=?, pending_total_cents=? WHERE id = ?`,
      newTransferStatus,
      settledTotal,
      pendingTotal,
      transferId
    );
    return updateResult;
  } catch (error) {
    console.error(`Error updating transfer status ${error}`);
    throw error;
  }
};

module.exports = {
  debugExposeDb,
  getAccessTokenForUserAndAccount,
  getAccessTokenForUserAndItem,
  getItemsAndAccountsForUser,
  getItemInfoForAccountAndUser,
  addUser,
  getUserList,
  getUserRecord,
  getBankNamesForUser,
  addItem,
  addBankNameForItem,
  addAccount,
  createNewTransfer,
  getTransfersForUser,
  getTransferDetailsForUser,
  createPaymentForUser,
  addPaymentAuthorization,
  updatePaymentWithTransferIntent,
  updatePaymentWithAccountId,
  updatePaymentWithTransferInfo,
  storeProofOfAuthorization,
  getPaymentByPlaidId,
  getPaymentsForUserTransfer,
  updatePaymentStatus,
  getLastSyncNum,
  setLastSyncNum,
  adminGetTransferDetails,
  adminGetPaymentsForTransfer,
  adminUpdateTransferStatus,
};
