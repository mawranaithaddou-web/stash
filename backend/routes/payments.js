const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');

// @POST /api/payments/create-intent — Create Stripe PaymentIntent for an order
router.post('/create-intent', protect, asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  const order = await Order.findOne({ _id: orderId, buyer: req.user._id });
  if (!order) { res.status(404); throw new Error('Order not found'); }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.totalAmount * 100), // cents
    currency: 'usd',
    metadata: { orderId: order._id.toString(), buyerId: req.user._id.toString() },
  });

  order.stripePaymentIntentId = paymentIntent.id;
  await order.save();

  res.json({ success: true, clientSecret: paymentIntent.client_secret });
}));

// @POST /api/payments/webhook — Stripe webhook
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const order = await Order.findOne({ stripePaymentIntentId: intent.id });
    if (order) {
      order.paymentStatus = 'paid';
      order.status = 'confirmed';
      order.vendorOrders.forEach(vo => { vo.status = 'confirmed'; });
      await order.save();

      // Schedule vendor payouts via Stripe Connect (if accounts are connected)
      const commissionRate = Number(process.env.PLATFORM_COMMISSION || 10) / 100;
      for (const vo of order.vendorOrders) {
        const vendor = await Vendor.findById(vo.vendor);
        if (vendor?.stripeAccountId && vendor.stripeOnboardingComplete) {
          try {
            const transfer = await stripe.transfers.create({
              amount: Math.round(vo.vendorEarnings * 100),
              currency: 'usd',
              destination: vendor.stripeAccountId,
              transfer_group: order._id.toString(),
            });
            vo.payoutStatus = 'paid';
            vo.stripeTransferId = transfer.id;
          } catch (e) {
            console.error('Transfer failed for vendor', vendor._id, e.message);
          }
        }
      }
      await order.save();
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    const order = await Order.findOne({ stripePaymentIntentId: intent.id });
    if (order) {
      order.paymentStatus = 'failed';
      await order.save();
    }
  }

  res.json({ received: true });
});

// @POST /api/payments/vendor/onboard — Start Stripe Connect onboarding for vendor
router.post('/vendor/onboard', protect, authorize('vendor'), asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) { res.status(404); throw new Error('Vendor profile not found'); }

  let accountId = vendor.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: vendor.contactEmail,
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    vendor.stripeAccountId = accountId;
    await vendor.save();
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.FRONTEND_URL}/vendor/dashboard?stripe=refresh`,
    return_url: `${process.env.FRONTEND_URL}/vendor/dashboard?stripe=success`,
    type: 'account_onboarding',
  });

  res.json({ success: true, url: accountLink.url });
}));

// @GET /api/payments/vendor/status — Check Stripe Connect status
router.get('/vendor/status', protect, authorize('vendor'), asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor?.stripeAccountId) {
    return res.json({ success: true, connected: false });
  }
  const account = await stripe.accounts.retrieve(vendor.stripeAccountId);
  const complete = account.details_submitted && account.charges_enabled;
  if (complete && !vendor.stripeOnboardingComplete) {
    vendor.stripeOnboardingComplete = true;
    await vendor.save();
  }
  res.json({ success: true, connected: complete, account });
}));

module.exports = router;
