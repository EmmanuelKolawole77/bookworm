# Ìwé Books

A bookstore web app: shop, search, cart, sign up / log in, Paystack checkout, orders and reviews. Plain HTML, CSS and JavaScript (no build step), with Firebase for auth and the database.

## Run it

Firebase modules load as ES modules, so open the site through a local server, not by double-clicking the file:

```
cd iwe-books
python3 -m http.server 8000
```

Then visit http://localhost:8000.

It works straight away in **demo mode**: books come from `js/books-seed.js`, and accounts, cart and orders are kept in your browser only. Connect Firebase below to make it real.

## Connect Firebase

1. Create a project at https://console.firebase.google.com.
2. Add a **Web app** and copy the config into `js/firebase-config.js`.
3. **Authentication > Sign-in method**: enable Email/Password and Google.
4. **Firestore Database**: create it, open the **Rules** tab and paste in `firestore.rules`.
5. Reload the site. The footer demo notice disappears.

### Load the books into Firestore

1. Sign up on your site with your own account.
2. In the Firebase console, open Firestore > `users` > your document and change `role` from `customer` to `admin`.
3. Reload the site, open the browser console and run `seedBooks()`.

After that, edit books straight in the Firestore console (`books` collection). Fields: `title`, `author`, `price` (naira), `category`, `cover` (image URL), `rating`, `stock`, `featured`, `description`, `pages`, `year`.

### Firestore collections

| Collection | What it holds |
| --- | --- |
| `books` | The catalogue. Public read, admin write. |
| `users/{uid}` | Name, email, role and saved cart. Only the owner can read it. |
| `orders` | One document per paid order. Owners read their own. |
| `reviews` | Reader reviews. Public read, signed-in users post. |

## Admin dashboard

Open `admin.html` (or use **Admin dashboard** in the account menu once you are an admin).

- **Overview:** revenue, average order, orders to fulfil, 7-day revenue chart, top sellers, low-stock alerts.
- **Books:** add, edit, delete, search. Covers come from the ISBN or a URL you paste.
- **Orders:** change status (paid, processing, shipped, delivered, cancelled) and export to CSV.
- **Reviews:** delete anything inappropriate.
- **Customers:** who signed up, how many orders, how much they spent.

Only accounts whose `users/{uid}.role` is `admin` can get in, and Firestore rules enforce it on the server, so hiding the link is not the only protection. In demo mode, any logged-in user counts as admin so you can try it.

Not done yet: stock does not drop automatically when an order is placed, because customers must not be allowed to write to `books`. Adjust stock in the Books tab, or add a Cloud Function that does it.

## Paystack

Put your **public test key** (`pk_test_...`) in `js/firebase-config.js`. Without a key, checkout simulates a payment so you can test the flow. For real payments, verify each transaction on a server before marking an order paid; the browser alone cannot be trusted with that.

## Files

```
index.html
admin.html
css/style.css
css/admin.css
js/admin.js            admin dashboard
js/app.js              page behaviour (render, cart, auth UI, checkout)
js/store.js            data layer (Firebase, or demo mode)
js/books-seed.js       starter catalogue and reviews
js/firebase-config.js  your keys and delivery settings
firestore.rules        security rules
```
