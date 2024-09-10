const express =  require("express")
const { createInvoice, getInvoicesByUserId, getInvoiceById } = require("../controller/invoice")


 const  router =  express.Router()

 router.route("/create-invoice").post(createInvoice)
 router.route("/:userId/invoices").get(getInvoicesByUserId)
 router.route("/get-invoice/:invoiceId").get(getInvoiceById)



 module.exports =   router