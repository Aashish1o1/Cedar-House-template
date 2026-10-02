const bookingDrawer =
  document.getElementById(
    "bookingDrawer"
  );

const bookingOverlay =
  document.getElementById(
    "bookingOverlay"
  );

const openBooking =
  document.getElementById(
    "openBooking"
  );

const heroBook =
  document.getElementById(
    "heroBook"
  );

const closeBooking =
  document.getElementById(
    "closeBooking"
  );

const menuToggle =
  document.getElementById(
    "menuToggle"
  );

const navLinks =
  document.querySelector(
    ".nav-links"
  );

const bookingForm =
  document.getElementById(
    "bookingForm"
  );

const roomSelect =
  document.getElementById(
    "room"
  );

const checkIn =
  document.getElementById(
    "checkIn"
  );

const checkOut =
  document.getElementById(
    "checkOut"
  );

const guests =
  document.getElementById(
    "guests"
  );

const guestName =
  document.getElementById(
    "guestName"
  );

const guestEmail =
  document.getElementById(
    "guestEmail"
  );

const guestPhone =
  document.getElementById(
    "guestPhone"
  );


/*
  Room prices
*/

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


/*
  Open booking drawer
*/

function openBookingDrawer(
  selectedRoom = "cedar"
) {

  roomSelect.value =
    selectedRoom;

  bookingDrawer.classList.add(
    "active"
  );

  bookingOverlay.classList.add(
    "active"
  );

  document.body.style.overflow =
    "hidden";

  updateSummary();
}


/*
  Close booking drawer
*/

function closeBookingDrawer() {

  bookingDrawer.classList.remove(
    "active"
  );

  bookingOverlay.classList.remove(
    "active"
  );

  document.body.style.overflow =
    "";
}


/*
  Buttons
*/

openBooking.addEventListener(
  "click",
  () => openBookingDrawer()
);

heroBook.addEventListener(
  "click",
  () => openBookingDrawer()
);

closeBooking.addEventListener(
  "click",
  closeBookingDrawer
);

bookingOverlay.addEventListener(
  "click",
  closeBookingDrawer
);


/*
  Mobile menu
*/

menuToggle.addEventListener(
  "click",
  () => {

    navLinks.classList.toggle(
      "active"
    );

  }
);


/*
  Close mobile menu
*/

document
  .querySelectorAll(
    ".nav-links a"
  )
  .forEach(
    link => {

      link.addEventListener(
        "click",
        () => {

          navLinks.classList.remove(
            "active"
          );

        }
      );

    }
  );


/*
  Room buttons
*/

document
  .querySelectorAll(
    ".room-book"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const roomId =
            button.dataset.room;

          openBookingDrawer(
            roomId
          );

        }
      );

    }
  );


/*
  Date helpers
*/

function getNights() {

  if (
    !checkIn.value ||
    !checkOut.value
  ) {
    return 0;
  }

  const start =
    new Date(
      checkIn.value
    );

  const end =
    new Date(
      checkOut.value
    );

  const difference =
    end.getTime() -
    start.getTime();

  return Math.ceil(
    difference /
    (1000 * 60 * 60 * 24)
  );
}


/*
  Update booking price
*/

function updateSummary() {

  const room =
    rooms[
      roomSelect.value
    ];

  const nights =
    getNights();

  const subtotal =
    room.price * nights;

  const taxes =
    Math.round(
      subtotal * 0.12
    );

  const total =
    subtotal + taxes;


  document.getElementById(
    "summaryRoom"
  ).textContent =
    room.name;


  document.getElementById(
    "summaryNights"
  ).textContent =
    nights;


  document.getElementById(
    "summaryTaxes"
  ).textContent =
    `₹${taxes.toLocaleString(
      "en-IN"
    )}`;


  document.getElementById(
    "summaryTotal"
  ).textContent =
    `₹${total.toLocaleString(
      "en-IN"
    )}`;
}


/*
  Update summary whenever
  booking information changes
*/

[
  roomSelect,
  checkIn,
  checkOut,
  guests
].forEach(
  element => {

    element.addEventListener(
      "change",
      updateSummary
    );

  }
);


/*
  Prevent selecting past dates
*/

const today =
  new Date()
    .toISOString()
    .split("T")[0];

checkIn.min = today;
checkOut.min = today;


/*
  Keep checkout after check-in
*/

checkIn.addEventListener(
  "change",
  () => {

    checkOut.min =
      checkIn.value;

    if (
      checkOut.value &&
      checkOut.value <=
        checkIn.value
    ) {

      checkOut.value = "";

    }

    updateSummary();

  }
);


/*
  Razorpay configuration
*/

async function getConfig() {

  const response =
    await fetch(
      "/api/config"
    );

  if (!response.ok) {
    throw new Error(
      "Could not load configuration."
    );
  }

  return response.json();
}


/*
  Booking form submission
*/

bookingForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const nights =
      getNights();

    if (nights < 1) {

      alert(
        "Please select valid check-in and check-out dates."
      );

      return;

    }


    const submitButton =
      bookingForm.querySelector(
        "button[type='submit']"
      );

    submitButton.disabled =
      true;

    submitButton.textContent =
      "Creating booking...";


    try {

      /*
        Create order on server
      */

      const orderResponse =
        await fetch(
          "/api/create-order",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              roomId:
                roomSelect.value,

              checkIn:
                checkIn.value,

              checkOut:
                checkOut.value,

              guests:
                Number(
                  guests.value
                ),

              guestName:
                guestName.value,

              guestEmail:
                guestEmail.value,

              guestPhone:
                guestPhone.value

            })

          }
        );


      const order =
        await orderResponse.json();


      if (
        !orderResponse.ok
      ) {

        throw new Error(
          order.message ||
          "Could not create order."
        );

      }


      /*
        Get Razorpay public key
      */

      const config =
        await getConfig();


      if (
        !config.razorpayKeyId
      ) {

        throw new Error(
          "Razorpay is not configured."
        );

      }


      /*
        Open Razorpay checkout
      */

      const options = {

        key:
          config.razorpayKeyId,

        amount:
          order.amount * 100,

        currency:
          order.currency,

        name:
          "The Cedar House",

        description:
          `${order.room} · ${order.nights} nights`,

        order_id:
          order.orderId,

        prefill: {

          name:
            guestName.value,

          email:
            guestEmail.value,

          contact:
            guestPhone.value

        },

        theme: {
          color:
            "#b96f42"
        },


        handler:
          async function (
            response
          ) {

            await verifyPayment(
              response,
              order
            );

          },


        modal: {

          ondismiss:
            function () {

              submitButton.disabled =
                false;

              submitButton.textContent =
                "Continue to Payment";

            }

        }

      };


      const razorpay =
        new Razorpay(
          options
        );


      razorpay.on(
        "payment.failed",
        function () {

          alert(
            "Payment failed. Please try again."
          );

          submitButton.disabled =
            false;

          submitButton.textContent =
            "Continue to Payment";

        }
      );


      razorpay.open();

    } catch (error) {

      console.error(error);

      alert(
        error.message ||
        "Something went wrong."
      );

      submitButton.disabled =
        false;

      submitButton.textContent =
        "Continue to Payment";

    }

  }
);


/*
  Verify payment with backend
*/

async function verifyPayment(
  payment,
  order
) {

  const response =
    await fetch(
      "/api/verify-payment",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          razorpay_order_id:
            payment.razorpay_order_id,

          razorpay_payment_id:
            payment.razorpay_payment_id,

          razorpay_signature:
            payment.razorpay_signature,

          roomId:
            roomSelect.value,

          checkIn:
            checkIn.value,

          checkOut:
            checkOut.value,

          guests:
            Number(
              guests.value
            ),

          guestName:
            guestName.value,

          guestEmail:
            guestEmail.value,

          guestPhone:
            guestPhone.value

        })

      }
    );


  const result =
    await response.json();


  if (!response.ok) {

    throw new Error(
      result.message ||
      "Payment verification failed."
    );

  }


  /*
    Close booking drawer
  */

  closeBookingDrawer();


  /*
    Show success modal
  */

  document
    .getElementById(
      "bookingId"
    )
    .textContent =
    `Booking ID: ${result.bookingId}`;


  document
    .getElementById(
      "successModal"
    )
    .classList.add(
      "active"
    );


  bookingForm.reset();

  updateSummary();

}


/*
  Success modal
*/

document
  .getElementById(
    "closeSuccess"
  )
  .addEventListener(
    "click",
    () => {

      document
        .getElementById(
          "successModal"
        )
        .classList.remove(
          "active"
        );

    }
  );