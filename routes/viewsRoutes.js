const express = require('express');

const router = express.Router();

const viewsController = require('./../controllers/viewsController');
const authController = require('./../controllers/authController');
const bookingController = require('./../controllers/bookingController');

router.get(
  '/',
  bookingController.createBookingCheckout,
  authController.isLoggedIn,
  viewsController.getOverview
);
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/me', authController.protect, viewsController.getAccount);
router.get(
  '/my-bookings',
  authController.protect,
  bookingController.getMyBookings
);
router.post(
  '/update-user-data',
  authController.protect,
  viewsController.updateUserData
);

module.exports = router;
