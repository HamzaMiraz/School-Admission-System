# User interface

The web app has two panels:

- **User panel** — http://localhost:3000 — for parents: sign in with the student's birth
  registration number, browse classes, apply, pay the fee or cancel, and follow applications.
- **Admin panel** — http://localhost:3000/admin — for the school: seat overview, every
  application with its payment status, and creating classes with an application deadline.

> The screenshots were taken from the running app (`docker compose up`) with demo data.

---

## User panel

### Sign in

The student's 17-digit birth registration number is the identity (no password, as in the brief).
It is remembered in the browser until **Sign out**. Bangla digits are accepted.

![Sign in](screenshots/01-sign-in.png)

### Classes — all classes

One card per class and shift, ordered Class 1 → Class 10, Morning before Day. Each card shows the
**application deadline** ("Apply by …"), **Total**, **On hold**, **Confirmed** and **Free seats**,
a seat bar (purple = confirmed, orange = on hold, green = free), and **Available**, **Full** or
**Applications closed**. Counts refresh every few seconds without reloading the page. **Apply**
works only when the class is open and has free seats. The banner shows how many classes are open
and how many seats are free.

![Classes](screenshots/02-class-list.png)

### Search by class and shift — and a closed class

Filter by class and shift, or show only the classes you can apply to. Here *Class 10* is
selected: the Morning shift is open until its deadline; the Day shift's deadline has passed, so it
shows **Closed on …** and nobody can apply any more.

![Search by class and shift](screenshots/03-class-list-search.png)

### Application

After applying, the seat is held. The page shows the **status**, a live **time left to pay**
countdown, and the **Pay admission fee** and **Cancel application** buttons. Pressing
"Pay admission fee" counts as a successful payment (no real payment gateway). When the countdown
ends, the page switches to EXPIRED and paying is disabled — without a reload.

![Application](screenshots/04-application.png)

### My applications

Every application of the signed-in student and its status. A student can apply for only one
class at a time; after cancelling (as here) they can apply to another class.

![My applications](screenshots/05-my-applications.png)

### On a phone

The layout adapts to small screens.

<img src="screenshots/06-mobile-class-list.png" alt="Classes on a phone" width="300">

---

## Admin panel

The admin panel has its own **dark theme** and a sidebar with **Overview**, **Applications** and
**Create class**, so it is easy to tell apart from the bright user panel.

### Overview

Totals across the school and every class and shift: seats, and the application deadline with
**Open** / **Closed**, updating live.

![Admin overview](screenshots/07-admin-overview.png)

### Applications

Every application: the student's birth registration number, class, shift, when they applied,
the status, and whether the admission fee is paid (or how much time is left to pay). Filter by
status, class & shift, or search by birth registration number.

![Admin applications](screenshots/08-admin-applications.png)

### Create class

Choose the class (1–10) and the shift (Morning / Day), enter the number of seats and the
**application deadline**. The name is built automatically, e.g. *Class 8 - Day Shift*. After the
deadline the class closes: parents still see it, but nobody can apply. Duplicate classes are
rejected.

![Create class](screenshots/09-admin-create-class.png)
