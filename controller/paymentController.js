const asyncHandler = require('express-async-handler');
const PaymentLink = require('../model/paymentSchema');
const PaymentSession  =  require("../model/paymentSessionSchema")
const { v4: uuidv4 } = require('uuid');
const User  =  require("../model/UserModel");
const { checkTxStatus } = require('../lib/CheckTxStatus');
const { sendEmail, sendMail2 } = require('../helper/sendEmail');


// @desc    Create payment link
// @route   POST /api/payment/create-link
// @access  Private
const createPaymentLink = asyncHandler(async (req, res) => {
  const {linkName,  paymentType,
     amount, collectEmail,
      collectName, collectAddress, 
       supportedTokens, userId,
      paymentTag, labelText,
       successTxt,
       redirectUser,
       redirectUrl,
       description
    } = req.body;
  //const userId = req.user._id;

  if (paymentType === 'fixed' && (!amount || amount <= 0)) {
    res.status(400);
    throw new Error('Invalid amount for fixed payment type');
  }


  //  NO  USING  CUSTOM ID  FOR LINK 

  //const  paymentLinkId = uuidv4();

  const paymentLink = new PaymentLink({
    linkName,
    userId,
    paymentType,
    amount,
    supportedTokens,
    collectEmail,
    collectAddress,
    collectName,
    labelText,
    redirectUrl,
    redirectUser,
    successTxt,
    paymentTag,
    description


  
  });

  await paymentLink.save();

  res.status(201).json({
    message: 'Payment link created',
    paymentLink: `https://yourapp.com/pay/${paymentLink._id}`,
  });
});




// @desc    Generate payment session
// @route   POST /api/payment/start-session
// @access  Public
/*const startPaymentSession = asyncHandler(async (req, res) => {
  const { linkId, payerInfo, amount } = req.body;

  const paymentLink = await PaymentLink.findOne({ linkId });

  if (!paymentLink) {
    res.status(404);
    throw new Error('Payment link not found');
  }

  if (paymentLink.paymentType === 'fixed' && amount !== paymentLink.amount) {
    res.status(400);
    throw new Error('Invalid amount for fixed payment type');
  }

  const sessionId = uuidv4();

  const paymentSession = new PaymentSession({
    linkId: paymentLink._id,
    sessionId,
    payerInfo,
    amount,
  });

  await paymentSession.save();

  res.status(201).json({
    message: 'Payment session started',
    sessionId,
  });
});*/


// @desc    Generate payment session ID
// @route   GET /api/payment/session/:linkId
// @access  Public
const generateSessionId = asyncHandler(async (req, res) => {
    const { linkId } = req.params;
    const  {amount, coin , network}  = req.body

      console.log("the amount", amount)
  
    const paymentLink = await PaymentLink.findById(linkId);
  
    if (!paymentLink) {
      res.status(404);
      throw new Error('Payment link not found');
    }

    if (paymentLink.paymentType === 'fixed' && amount !== paymentLink.amount) {
      res.status(400);
      throw new Error('Invalid amount for fixed payment type');
    }

    if (paymentLink.paymentType === 'fixed' &&  !amount) {
      res.status(400);
      throw new Error('please  add the  required  amount');
    }

    if (paymentLink.paymentType === 'open' &&  !amount) {
      res.status(400);
      throw new Error('PLease add amount fisr  before prcceding ');
    }
  
    const sessionId = uuidv4();
    const expTime  = new Date(Date.now() + 30 * 60000) // 30 minutes expiration
  
    const paymentSession = new PaymentSession({
      amount,
      coin,
      network,
      paymentLinkId: paymentLink._id,
      sessionId,
      status: 'pending',
      durationTime: expTime
    });
  
    await paymentSession.save();
  
    res.json({sessionId: sessionId, expiresAt : expTime });
  });


  // @desc    Handle checkout and payment
// @route   POST /api/payment/checkout/:sessionId
// @access  Public
const handleCheckout = asyncHandler(async (req, res) => {
  const io = req.app.get('socketio');
  const { sessionId } = req.params;
  const {
    
    transactionHash,
    payerName,
    payerEmail,
    payerAddress,
      
       
    } = req.body;


 const paymentSession = await PaymentSession.findOne({ sessionId }).populate('paymentLinkId');

  if (!paymentSession) {
    res.status(404);
    throw new Error('Payment session not found');
  }

  if(paymentSession.paymentLinkId.collectEmail   &&  ! payerEmail) {
    throw  new Error("Email is required please  add your  email address")
  }

  if(paymentSession.paymentLinkId.collectName   &&  ! payerName) {
    throw  new Error("Name is required please  add your  name")
  }

  if(paymentSession.paymentLinkId.collectAddress   &&  ! payerAddress) {
    throw  new Error("Address is required please  add your address")
  }

  if(! transactionHash){
    io.emit('paymentStatus', {
      status : "FAILED",
      sessionId : sessionId
    });
    res.status(400).json({message :  "Please provide transaction hash"})
    throw  new Error("no transaction hash provided  please check blockchain status")
   
  }

   // const  reciever  =  await User.findById(paymentSession.paymentLinkId.userId)

    const user = await User.findById(paymentSession.paymentLinkId.userId);

    



       // UPDATE_USER_DETAILS_AND_TX_STATUS

         // Find and update the PaymentSession document
         const updatedPaymentSession = await PaymentSession.findOneAndUpdate(
          { sessionId },
          { payerEmail, payerName, payerAddress,   paymentStatus : "paid", txHash : transactionHash },
          { new: true } // Return the updated document
      );


       // console.log("updated payment  info and status", updatedPaymentSession)

 

  // Monitor transaction status
  const interval = setInterval(async () => {
    //const status = await checkTransactionStatus(transactionHash);

     // Step 1: Replace @ with -
     let formattedTxId = transactionHash.replace('@', '-');

     // Step 2: Replace only the dots after the first two segments with hyphens
     formattedTxId = formattedTxId.replace(/^([^.]+\.[^.]+)\.(.*)$/, function(_, p1, p2) {
       return `${p1}.${p2.replace(/\./g, '-')}`;
     });
     
       const  txResult  =  await  checkTxStatus(formattedTxId)
      console.log("the result status",  txResult)

    if (txResult === 'SUCCESS') {
     

      

      // Notify user via email

      const  OTP_TEMPLATE_UUID  = "7e201329-33cf-49cd-b879-69255081bd6f"

      const recipients = [
       {
         email: user.email,
       }
     ];
   
     await sendMail2(recipients, OTP_TEMPLATE_UUID, {
      "amount": paymentSession.amount,
      "currency": "HBAR",
      "transaction_id": paymentSession.sessionId,
      "payment_link": paymentSession.paymentLinkId,
      "receiver_wallet": user.wallet,
     });

       // UPDATE_USER_DETAILS_AND_TX_STATUS

         // Find and update the PaymentSession document
         const updatedPaymentSession = await PaymentSession.findOneAndUpdate(
          { sessionId },
          { payerEmail, payerName, payerAddress,   paymentStatus : "completed" },
          { new: true } // Return the updated document
      );



        //console.log("updated payment  info and status", updatedPaymentSession)
        clearInterval(interval);

      io.emit('paymentStatus', {
        status :  "COMPLETED",
        sessionId : sessionId
      });

      // Notify user via UI (e.g., via WebSocket or an update endpoint)
      // ... your notification logic here ...
    } else if (txResult === 'FAILED') { 
    

      

      // Notify user via email
     /* await sendEmail(
        user.email,
        'Payment Failed',
        `Your payment of ${paymentSession.amount} has failed. Please try again.`
      );*/


            // UPDATE_USER_DETAILS_AND_TX_STATUS

         // Find and update the PaymentSession document
         const updatedPaymentSession = await PaymentSession.findOneAndUpdate(
          { sessionId },
          { payerEmail, payerName, payerAddress,   paymentStatus : "failed" },
          { new: true } // Return the updated document
      );

      clearInterval(interval);
      // Notify user via UI (e.g., via WebSocket or an update endpoint)
      // ... your notification logic here ...
      io.emit('paymentStatus', {
        status : "FAILED",
        sessionId : sessionId
      });
    }else if(new Date()   > paymentSession.durationTime  && paymentSession.paymentStatus === "pending" ){

         // UPDATE_USER_DETAILS_AND_TX_STATUS

         // Find and update the PaymentSession document
         const updatedPaymentSession = await PaymentSession.findOneAndUpdate(
          { sessionId },
          { payerEmail, payerName, payerAddress,   paymentStatus : "expired" },
          { new: true } // Return the updated document
      );
      clearInterval(interval);
      // Notify user via UI (e.g., via WebSocket or an update endpoint)
      // ... your notification logic here ...
      io.emit('paymentStatus', {
        status : "EXPIRED",
        sessionId : sessionId
      });

    }
  }, 30000); // Check every 30 seconds  */


  //  console.log("payment session", paymentSession)


  res.status(200).json({ message: 'Payment processing initiated' });
});


 const  getPyament  =  asyncHandler (  async (req, res)  =>  {

    const {linkId}  = req.params

     // Find the PaymentLink document by ID
     const paymentLink = await PaymentLink.findById(linkId);

         // If the link is not found, return a 404 response
         if (!paymentLink) {
          return res.status(404).json({ message: 'Payment link not found' });
          }

        // Return the payment link details
        res.status(200).json({
          paymentLink
        });

   
 })


 const  getPaymentLinkSessions  =  asyncHandler (  async (req, res)  =>  {

  const {linkId}  = req.params

   // Find the PaymentLink document by ID
   const paymentLink = await PaymentLink.findById(linkId);

       // If the link is not found, return a 404 response
       if (!paymentLink) {
        return res.status(404).json({ message: 'Payment link not found' });
        }

         // Find all PaymentSessions associated with this PaymentLink
const paymentSessions = await PaymentSession.find({ paymentLinkId: linkId });

      // Return the payment link details
      res.status(200).json({
        paymentLink,
        paymentSessions
      });

 
})


 const  getSession  =  asyncHandler (  async (req, res)  =>  {

  const {sessionId}  = req.params

   // Find the Payment session document by ID
   const paymentSession = await PaymentSession.findOne({sessionId});

        // If the link is not found, return a 404 response
        if (!paymentSession) {
          return res.status(404).json({ message: 'Payment  session not found' });
         
  
      }
   // FIND_PAYMENT RECIEVER

   const reciever =  await  PaymentLink.findById(paymentSession.paymentLinkId).populate("userId")

      //console.log("the printed info", reciever)

  

      // Return the payment link details
      res.status(200).json(
        {
          session : paymentSession,
           reciever : reciever
        }
      );

 
})

const getPaymensByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    // Step 1: Find all PaymentLinks created by this user
    const paymentLinks = await PaymentLink.find({ userId });

    // If no payment links are found, return an empty array
    if (paymentLinks.length === 0) {
      return res.status(200).json({ message: 'No payment links found for this user.', paymentSessions: [] });
    }

    // Extract all link IDs
    const linkIds = paymentLinks.map(link => link._id);

    // Step 2: Find all PaymentSessions associated with the found PaymentLinks
    const payments = await PaymentSession.find({ paymentLinkId: { $in: linkIds } }).populate("paymentLinkId");

    // Return the payment sessions
    res.status(200).json({ payments });

  } catch (error) {
    // Handle any errors
    res.status(500).json({ message: error.message });
  }
});

 

// Controller function to get payment links by user ID
const getPaymentLinksByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch all payment links created by the specified user
    const paymentLinks = await PaymentLink.find({ userId });

    // If no payment links are found, return an empty array
    if (! paymentLinks) {
      return res.status(404).json({ message: 'No payment links found for this user.' });
    }
        // Fetch associated payment sessions for each payment link
        const paymentLinksWithSessions = await Promise.all(
          paymentLinks.map(async (link) => {
            const sessions = await PaymentSession.find({ paymentLinkId: link._id });
            return {
              ...link._doc, // Spread the payment link document
              sessions,    // Add the associated payment sessions
            };
          })
        );

    // Return the payment links
    res.status(200).json({ paymentLinks : paymentLinksWithSessions });
  } catch (error) {
    // Handle any errors that may occur
    res.status(500).json({ message: error.message });
  }
});






module.exports = { createPaymentLink,  generateSessionId,
   handleCheckout, 
  getPyament, getSession,
   getPaymentLinkSessions,
   getPaymensByUserId,
   getPaymentLinksByUserId
  }; 
