const express = require("express");
const { createPaymentLink, generateSessionId, handleCheckout, getPyament, getSession, getPaymentLinkSessions, getPaymensByUserId } = require("../controller/paymentController");


const router =  express.Router();

router.route("/create-link").post(createPaymentLink)
router.route("/create-session/:linkId").post(generateSessionId)
router.route("/check-out/:sessionId").post(handleCheckout)
router.route("/link/:linkId").get(getPyament)
router.route("/session/:sessionId").get(getSession)
router.route("/link-details/:linkId").get(getPaymentLinkSessions)
router.route("/payments/:userId").get(getPaymensByUserId)




module.exports = router
