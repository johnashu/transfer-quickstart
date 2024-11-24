# Transfer to Co2Trust Sample App

The Transfer to Co2Trust sample app is a demonstration of how a company (in this case, a
fictional utility company) can use Plaid Transfer to allow their customers to
utilize pay by bank to transfer to Co2Trust.

This demo app shows two different ways to use Plaid Transfer -- one method using
Transfer UI (which handles several intermediate steps and collects appropriate
proof of authorization), and another method where you have to perform those
steps yourself.

This app uses NodeJS on the backend (with Express as the server), SQLite as the
database, and plain ol' vanilla JavaScript on the frontend. It designed to be
simple enough that a Python engineer without a lot of deep JavaScript experience
could still understand what's going on and follow along in a video tutorial, so
we avoid too much idiomatic JavaScript. That said, you should be familiar with
[destructuring](https://www.geeksforgeeks.org/shorthand-syntax-for-object-property-value-in-es6/)
and
[object property shorthand](https://www.geeksforgeeks.org/shorthand-syntax-for-object-property-value-in-es6/).

# Installation

We recommend having node version 18.x.x or later before attempting to run this
application.

## 1. Make sure you have access to Transfer

First, if you haven't already done so,
[sign up for your free Plaid API keys](https://dashboard.plaid.com/signup).

If you have a relatively new Plaid developer account, you should already have
access to Transfer in Sandbox. If you don't, please contact support and you can
get access to Transfer in the Sandbox environment without needing to apply for
the full product.

If you don't have access to Transfer, you can still follow along with this
Quickstart by watching the Video Walkthrough (URL to be added later)

## 2. Clone the repository

Using https:

```
git clone https://github.com/plaid/transfer-quickstart
cd transfer-quickstart
```

Alternatively, if you use ssh:

```
git clone git@github.com:plaid/transfer-quickstart.git
cd transfer-quickstart
```

## 3. Install the required packages

Run `npm install` inside your directory to install the Node packages required
for this application to run.

## 4. Set up your environment variables

Copy `.env.template` to a new file called `.env`. Then open up `.env` in your
favorite code editor and fill out the values specified there.

```
cp .env.template .env
```

You can get your `PLAID_CLIENT_ID` and `PLAID_SECRET` values from the Keys
section of the [Plaid dashboard](https://dashboard.plaid.com/developers/keys)

Keep `sandbox` as your environment.

You can probably keep `START_SYNC_NUM` as 0, unless your client is part of a
team that has already been using Plaid Transfer extensively.

**NOTE:** .env files are a convenient local development tool. Never run a
production application using an environment file with secrets in it. Use some
kind of Secrets Manager (provided by most commercial cloud providers) instead.

## 5. (Optional) Set up your webhook receiver

Transfer makes use of webhooks to let applications know that the status of a
payment has changed. If you want to see this part of the application in action,
you will need to tell Plaid what webhook receiver it should send these messages
to.

### Step 1: Create a public endpoint for your webhook receiver

This webhook receiver will need to be available to the public in order for Plaid
to communicate with it. If you don't wish to publish your sample application to
a public server, one common option is to use a tool like
[ngrok](https://ngrok.com/) to open up a tunnel from the outside world to a
specific port running on `localhost`.

The sample application uses a separate server to receive webhooks running on
port 8001, so if you have ngrok installed, you can run

```
ngrok http 8001
```

to open up a tunnel from the outside world to this server. The final URL will be
the domain that ngrok has created, plus the path `/server/receive_webhook`. It
will probably look something like:

`https://abde-123-4-567-8.ngrok.io/server/receive_webhook`

### Step 2: Add this URL to the .env file

Normally, you would use the Webhooks section of the Plaid dashboard to tell
Plaid what endpoint to call when a Transfer event happens.

However, when you are running Transfer in the Sandbox environment, Transfer
won't regularly send any webhooks. You'll need to tell Plaid, through its
/sandbox/transfer/fire_webhook endpoint, to fire a webhook and to what URL. Our
sample application grabs the URL to use from the SANDBOX_WEBHOOK_URL value in
the .env file.

## 7. Run the application!

You can run your application by typing

```
npm run watch
```

on the command line. If there are no issues, you should see a message telling
you that you can open up http://localhost:8000/ to view your running app!

# Running the application

Transfer to Co2Trust is a fictional website that utilizes Plaid Transfer so
that customers can use pay-by-bank to transfer to Co2Trust.

This sample application simulates two different ways that a user could use Plaid
Transfer to pay by bank. Obviously, in a real app, you wouldn't use both
options; this is just for demonstration purposes.

Create a fictional customer account or sign in with a existing account to start
the process.

To create a transfer, simply enter an amount and click the **Create Transfer** button.

## 1. Transferring to Co2Trust with Transfer UI

Transfer UI is a feature built into Link, the UI widget provided by Plaid. It
takes care of connecting your user to a checking or savings account if
necessary, and then properly collecting proof of authorization data to ensure
you stay compliant with Nacha guidelines.

Using Transfer UI doesn't require installing any additional libraries on the
client -- it's already part of Link.

To transfer to Co2Trust using Transfer UI, click the "Transfer" link next to any individual
transfer. This will take you to a Transfer Details page where you can see details about
your transfer, including the original amount.

From the Transfer Details page, enter an amount to transfer and click the **Transfer to Co2Trust**
button.

If this is your first time using this application and you have not connected
Plaid to any checking or savings accounts with this user, Plaid will prompt you
to connect to a new bank.

Go through the standard process for connecting to a new bank in Sandbox -- pick
any institution you'd like, enter `user_good` and `pass_good` as the user name
and password, and enter `1234` for an MFA code if prompted.

Once you're done connecting to a bank, Plaid will then ask you to authorize a
payment from the account you've just connected to. Click Accept, and your
payment is submitted.

To make subsequent transfers with the same account, select the account you've
previously connected, enter an amount, and click "Transfer". Plaid will once again
display the authorization form, and then submit your transfer.

### How it works

You should view the code for the complete details, but here's the brief summary
of how Plaid Transfer works making use of Link's Transfer UI.

#### Already connected an account?

If your customer has made a payment in the past and has, therefore, already
connected their bank to your application through Plaid, this is the overall
process for making a transfer:

1. When a user chooses to make a transfer, the client calls the
   `/server/payments/initiate` endpoint on the locally-running server, passing
   along the account ID to use.

2. On the server, the application creates a Transfer Intent by making a call to
   Plaid's `/transfer/intent/create` endpoint. It includes data about the
      transfer such as the user's legal name, the account they're using, the amount
   of the transfer, and so on. It receives back an `intent_id`.

3. The server saves this transfer information in its local database, storing the
   `intent_id` alongside the rest of the transfer information.

4. The server then creates a link token through Plaid's `/link/token/create`
   call, sending the `intent_id` that it received in the previous step, along
   with a few new pieces of information (like the `products` array, the user's
   language and so on). It receives back a `link_token`, which can be used on
   the client to display a properly configured Link session.

5. This `link_token` is then returned to the client and the client uses the
   Plaid JavaScript SDK to open Link.

6. Inside of Link, the user is presented with a Nacha-compliant authorization
      form, so they can authorize the transfer. Plaid stores this proof of
   authorization on its servers.

7. Once the user completes the Link process successfully, the payment is in
   Plaid's system and is ready to be sent off to the ACH network. We just need
      to make sure our application knows about the transfer that was created.

8. In Link's `onSuccess()` callback, the client sends down the original intent
   ID to the server's `/payments/transfer_ui_complete` endpoint. The server then
   calls `/transfer/intent/get` with this `intent_id` to get updated information
   about the transfer.

   Two important pieces of information received in the response are a) The
   `authorization_decision` and `authorization_decision_rationale`, which
   indicates if Plaid decided to approve or reject the transfer, and b) the
   `transfer_id` which is the ID of the transfer that was created by Plaid. This
   is different than the earlier `intent_id`, and will be used to identify this
   payment in Plaid's system from now on.

9. All of this information is saved in the database and is used to populate the
   "Transfers to Co2Trust" table.

#### Need to connect an account?

If your user has not yet connected their account with your application using
Plaid (or they wish to connect a new account), the process works similar to
before, but with these differences:

1. When the server calls `/transfer/intent/create`, the `account_id` field will
   be null because we don't have the `account_id` that will be used. This is a
   signal to Plaid that, when the user goes through the Link flow, Link needs to
   prompt them to connect to a financial institution.

2. Inside of Link, the user is first asked to connect to a checking our savings
   account before they are presented with the transfer authorization form.

3. When Link is complete, Plaid takes the `public_token` that it receives in the
   `onSuccess()` callback, and sends it down to its server to exchange for an
   access token, like you might do with any other Plaid product. This is bundled
   into the `/payments/transfer_ui_complete` call, rather than making two
   separate calls.

4. Because our application still wants to know what account was eventually used
   with the transfer, our server also makes a separate call to `/transfer/get`,
   to find out value of the `account_id` that was used in the transfer.


## 2. Updating transfer statuses

When you submit a payment, it will be marked as "Pending" in Plaid's system,
meaning it's bundled up on Plaid's servers and ready to submit to the ACH
network. In an actual application, it would be sent to the ACH network a couple
of hours later, (where its status would change to "Posted") and then the payment
will appear on the user's bank statement in a day or so (where its status would
change to "Settled.")

In the Sandbox environment, this doesn't happen automatically. You will need to
change the status of the transfer manually. You can either do this by making
calls to the `/sandbox/transfer/simulate` endpoint, or by using the UI within
the Plaid Dashboard.

This sample application uses the Plaid Dashboard. Next to every payment is a
dashboard icon. Clicking this icon will take you to the Payment's appropriate
entry in the Plaid dashboard. From there, you can click on "Next Event" to
simulate the next event that normally takes place in the payment process. You
can also click "Failed" to simulate when a transfer might fail (for instance, if
you have an incorrect account or routing number) or "Return" to simulate when a
transfer is returned (typically for insufficient funds, or if the user disputes
a payment).

## 3. Receiving status updates

When the user's payment's status has changed, our application will need to know
about that. While the Plaid API contains several endpoints to fetch the status
of individual payments, the recommended way of staying on top of all changes is
to call `/transfer/event/sync` (with an `after_id` value). This will fetch a
sequential list of transfer events since the `after_id` event.

These events contain all of the information needed to stay on top of payment
statuses. Most commonly, this will reflect the fact that a payment's status has
changed. When a transfer's status has changed, we record that information our
database and update the total amount due associated with a transfer. Transfers that
are marked as `settled`, for instance, can generally be considered to be
completed and can be deducted from the total "amount due. However, the user can
still dispute unauthorized charges for up to 60 days after the payment. We also
display a "amount pending" value, which is the sum of the payments that are
currently marked as "pending" or "posted".

Our code contains some logic to ignore payments that follow "impossible" state
logic (for example, if a payment were to go from `settled` to `pending`) This
won't happen in Plaid's event sync logic, but it can happen during development.
For instance, if you were to replay a batch of events you had already processed.
Our code also ignores payments that it cant find in its database. That might
happen if, say, multiple developers were running separate sample applications
with the same Plaid client_id.

In our application, our server calls `/transfer/event/sync` in response to
clicking the "Perform Server Sync" logic on the client. In a real application,
you may wish to make this call in response to receiving the
`TRANSFER_EVENTS_UPDATE` webhook, which you will receive whenever the status of
any event changes. Alternatively, you can simply call this endpoint on a
regularly scheduled basis.

#### Receiving webhooks

In a normal Production environment, Plaid will automatically fire a
`TRANSFER_EVENTS_UPDATE` webhook whenever the status of any transfer changes;
the webhook contains no other information, only that the status of a transfer
has changed. You may wish to have your application run `/transfer/event/sync` in
response to receiving this webhook as a way of automatically staying up to date
with any changes to your users' payments.

In the Sandbox environment, however, Plaid does not automatically fire any
webhooks. Your application will need to make a call to
`/sandbox/transfer/fire_webhook`, which tells Plaid to sent a
`TRANSFER_EVENTS_UPDATE` webhook to a URL that you pass in.

In our application, clicking the "Fire a webhook" button will send a call to the
`/server/debug/fire_webhook` endpoint on the server, which in turn will call
Plaid's `/sandbox/transfer/fire_webhook` endpoint. This sends a webhook to the
URL that you have specified in your .env file.

If you have a working tunnel between this URL and your webhook receiver, this
webhook should be picked up by the webhook server in `webhookServer.js`. If the
server sees that this is a `TRANSFER_EVENTS_UPDATE` webhook, then it will call
the internal `syncPaymentData()` function that calls `/transfer/events/sync` and
processes the data. (This is the same function that is called by the "Perform
Server Sync" button.)

# What files do what?

Here are a list of files in the application along with a brief description of
what they do. Files in **bold** contain the code most relevant to implementing
Plaid Transfer.

### Files on the server

- `db.js` -- All the work for interacting with the database is performed here
- `plaid.js` -- Initializes the Plaid client library
- **`recalculateTransfers.js`** -- Calculates the status of a transfer based on the
  status of all the associated payments in our database. Your application's
  logic may differ.
- `server.js` -- Starts up the server and reads in all the routes listed below
- **`syncPaymentData.js`** -- Calls `/transfer/event/sync` and updates the
  payment's status based on the events it receives
- `types.js` -- A helper file that contains a couple of enum-like objects
- `utils.js` -- Other utilities -- currently just used to get information about
  the signed in user
- `webhookServer.js` -- A second server running on port 8001 to respond to
  webhooks
- `/routes/banks.js` -- List banks and accounts that the user is connected to
- `/routes/transfers.js` -- List, generate and fetch details about transfers
- `/routes/debug.js` -- A place to put arbitrary rest calls
- **`/routes/payments_no_transferUI.js`** -- Authorize a transfer, and create
  one _without_ using Link's Transfer UI.
- **`/routes/payments.js`** -- List payments, create a Transfer Intent, and
  create a payment using Link's Transfer UI.
- **`/routes/token.js`** -- Create a link token, exchange a public token for an
  access token, also does all the work around fetching and saving bank names
- `/routes/user.js` -- Sign in, sign out, create user, etc.

### Files On the client

- **`js/transfer-details.js`** -- Does much more than get transfer details! This
  performs the client logic necessary to transfer to Co2Trust, both with and without
  Transfer UI. We should probably rename or split up this file.
- `js/client-transfers.js` -- Fetches and displays info about the user's transfers
- `js/home.hs` -- Handle creating in and signing in users
- `js/link.js` -- Initialize and run Link, send the public token down to the
  server
- `js/signin.js` -- Gets users, signs in users, signs out users, and calls a
  "signedInUserCallback" or "signedOutUserCallback" depending on the user's
  status
- `js/utils.js` -- Utilities, including the `callMyServer` method (which
  communicates with our server) and functions to display dates and currency in a
  user-friendly way.
