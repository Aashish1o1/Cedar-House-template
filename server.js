require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const app = express();

const PORT = process.env.PORT || 3000;

const BOOKINGS_FILE = path.join(
  __dirname,
  "data",
  "bookings.json"
);

const rooms = {
  cedar: {
    name: "Cedar Room",
    price: 6500
  },

  pine: {
    name: "Pine Suite",
    price: 8500
  },

  summit: {
    name: "Summit Villa",
    price: 12500
  }
};

const razorpay =
  process.env.RAZORPAY_KEY_ID &&
  process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
    : null;

app.use(express.json());

app.use(express.static(
  path.join(__dirname, "public")
));

function calculateNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  const difference =
    end.getTime() - start.getTime();

  return Math.ceil(
    difference / (1000 * 60 * 60 * 24)
  );
}

function calculateBooking(roomId, checkIn, checkOut) {
  const room = rooms[roomId];

  if (!room) {
    throw new Error("Invalid room");
  }

  const nights = calculateNights(
    checkIn,
    checkOut
  );

  if (nights < 1) {
    throw new Error(
      "Check-out must be after check-in"
    );
  }

  const subtotal = room.price * nights;

  const taxes = Math.round(
    subtotal * 0.12
  );

  const total = subtotal + taxes;

  return {
    room,
    nights,
    subtotal,
    taxes,
    total
  };
}

function readBookings() {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) {
      return [];
    }

    const data = fs.readFileSync(
      BOOKINGS_FILE,
      "utf8"
    );

    return JSON.parse(data);
  } catch (error) {
    console.error(
      "Could not read bookings:",
      error
    );

    return [];
  }
}

function saveBooking(booking) {
  const bookings = readBookings();

  bookings.push(booking);

  fs.writeFileSync(
    BOOKINGS_FILE,
    JSON.stringify(
      bookings,
      null,
      2
    )
  );
}

/*
  Frontend configuration
*/

app.get("/api/config", (req, res) => {
  res.json({
    razorpayKeyId:
      process.env.RAZORPAY_KEY_ID || null
  });
});

/*
  Create Razorpay order
*/

app.post(
  "/api/create-order",
  async (req, res) => {
    try {
      const {
        roomId,
        checkIn,
        checkOut,
        guests,
        guestName,
        guestEmail,
        guestPhone
      } = req.body;

      if (
        !roomId ||
        !checkIn ||
        !checkOut ||
        !guestName ||
        !guestEmail ||
        !guestPhone
      ) {
        return res.status(400).json({
          message:
            "Please complete all required fields."
        });
      }

      const calculation =
        calculateBooking(
          roomId,
          checkIn,
          checkOut
        );

      if (!razorpay) {
        return res.status(500).json({
          message:
            "Razorpay is not configured. Add your test credentials to .env."
        });
      }

      const order =
        await razorpay.orders.create({
          amount:
            calculation.total * 100,

          currency: "INR",

          receipt:
            `cedar_${Date.now()}`,

          notes: {
            room:
              calculation.room.name,

            checkIn,

            checkOut,

            guests:
              String(guests || 1),

            guestName,

            guestEmail,

            guestPhone
          }
        });

      res.json({
        orderId: order.id,

        amount:
          calculation.total,

        currency: "INR",

        room:
          calculation.room.name,

        nights:
          calculation.nights,

        subtotal:
          calculation.subtotal,

        taxes:
          calculation.taxes
      });

    } catch (error) {
      console.error(
        "Create order error:",
        error
      );

      res.status(500).json({
        message:
          error.message ||
          "Could not create payment order."
      });
    }
  }
);

/*
  Verify Razorpay payment
*/

app.post(
  "/api/verify-payment",
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,

        roomId,
        checkIn,
        checkOut,
        guests,

        guestName,
        guestEmail,
        guestPhone
      } = req.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          message:
            "Missing payment information."
        });
      }

      const generatedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET
          )
          .update(
            `${razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest("hex");

      if (
        generatedSignature !==
        razorpay_signature
      ) {
        return res.status(400).json({
          message:
            "Payment verification failed."
        });
      }

      const calculation =
        calculateBooking(
          roomId,
          checkIn,
          checkOut
        );

      const booking = {
        id:
          `CH-${Date.now()}`,

        createdAt:
          new Date().toISOString(),

        guest: {
          name: guestName,
          email: guestEmail,
          phone: guestPhone
        },

        room: {
          id: roomId,
          name:
            calculation.room.name
        },

        stay: {
          checkIn,
          checkOut,
          nights:
            calculation.nights,
          guests:
            guests || 1
        },

        payment: {
          orderId:
            razorpay_order_id,

          paymentId:
            razorpay_payment_id,

          amount:
            calculation.total,

          currency: "INR",

          status: "paid"
        }
      };

      saveBooking(booking);

      res.json({
        success: true,

        bookingId:
          booking.id
      });

    } catch (error) {
      console.error(
        "Payment verification error:",
        error
      );

      res.status(500).json({
        message:
          "Could not verify payment."
      });
    }
  }
);

/*
  Start server
*/

app.listen(
  PORT,
  () => {
    console.log(
      `Cedar House running at http://localhost:${PORT}`
    );
  }
);