import { refreshSignInStatus, signOut } from "./signin.js";
import {
  callMyServer,
  currencyAmount,
  capitalizeEveryWord,
  prettyDate,
  snakeToEnglish,
} from "./utils.js";

/**
 * Create a new transfer for the user.
 */
const createNewTransfer = async () => {
  await callMyServer("/server/transfers/create", true);
  await transfersRefresh();
};

/**
 * Grab the list of transfers from the server and display them on the page
 */
export const transfersRefresh = async () => {
  const transfersJSON = await callMyServer("/server/transfers/list");
  // Let's add this to our table!
  const accountTable = document.querySelector("#reportTable");
  if (transfersJSON == null || transfersJSON.length === 0) {
    accountTable.innerHTML = `<tr><td colspan="4">No transfers yet! Click the button below to create one!</td></tr>`;
    return;
  }

  accountTable.innerHTML = transfersJSON
    .map((transfer) => {
      const transferActionLink = `<a href="transfer-details.html?transferId=${transfer.id}">${transfer.status === "unpaid" ? "Pay" : "View"
        }</a>`;
      return `<tr><td>${transfer.description}</td><td>${prettyDate(
        transfer.created_date
      )}</td><td class="text-end">${currencyAmount(
        (transfer.original_amount_cents -
          transfer.paid_total_cents -
          transfer.pending_total_cents) /
        100,
        "USD"
      )}</td><td>${snakeToEnglish(
        transfer.status
      )}</td><td>${transferActionLink}</td></tr>`;
    })
    .join("\n");
};

/**
 * If we're signed out, redirect to the home page
 */
const signedOutCallBack = () => {
  window.location.href = "/index.html";
};

/**
 * If we're signed in, update the welcome message and refresh the table of transfers
 */
const signedInCallBack = (userInfo) => {
  console.log(userInfo);
  document.querySelector(
    "#welcomeMessage"
  ).textContent = `Hi there, ${userInfo.firstName} ${userInfo.lastName}! Feel free to view or pay any of your transfers!`;
  transfersRefresh();
};

/**
 * Create a new transfer
 */
const createTransfer = async function () {
  const amount = document.querySelector("#transferAmount").value;

  if (!amount || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount");
    return;
  }

  try {

    const result = await callMyServer("/server/transfers/create", true, {
      amount: amount,
      description: "Transfer to Co2Trust"
    });

    console.log("Transfer created:", result);

    // Clear the input
    document.querySelector("#transferAmount").value = "";

    // Refresh the transfers list using existing function
    await transfersRefresh();
  } catch (error) {
    console.error("Failed to create transfer:", error);
    alert("Failed to create transfer. Please try again.");
  }
};

/**
 * Connects the buttons on the page to the functions above.
 */
const selectorsAndFunctions = {
  "#signOut": () => signOut(signedOutCallBack),
  "#newTransfer": createNewTransfer,
  "#createTransfer": createTransfer
};

Object.entries(selectorsAndFunctions).forEach(([sel, fun]) => {
  if (document.querySelector(sel) == null) {
    console.warn(`Hmm... couldn't find ${sel}`);
  } else {
    document.querySelector(sel)?.addEventListener("click", fun);
  }
});



await refreshSignInStatus(signedInCallBack, signedOutCallBack);
