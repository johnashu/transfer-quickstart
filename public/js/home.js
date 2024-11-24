import { refreshSignInStatus } from "./signin.js";
import { callMyServer } from "./utils.js";

// The user ID you want to auto-login with
const AUTO_LOGIN_USER_ID = "YOUR_USER_ID_HERE"; // Replace this with the actual user ID

/**
 * Auto-login the specified user
 */
const autoLogin = async () => {
  try {
    await callMyServer("/server/users/sign_in", true, { userId: "6976e07c-cf5e-4769-9c0c-1cf4b1e6e367" });
    await refreshSignInStatus(signedInCallback, signedOutCallback);
  } catch (error) {
    console.error("Auto-login failed:", error);
    document.querySelector("#welcomeMessage").textContent = "Auto-login failed. Please check the user ID.";
  }
};

/**
 * If we're signed out, attempt auto-login
 */
const signedOutCallback = () => {
  autoLogin();
};

/**
 * If we're signed in, redirect to the bills page
 */
const signedInCallback = (userInfo) => {
  document.querySelector(
    "#welcomeMessage"
  ).textContent = `Hi there! So great to see you again! You are signed in as ${userInfo.username}!`;
  window.location.href = "/transfer.html";
};

// Check initial sign-in status
await refreshSignInStatus(signedInCallback, signedOutCallback);