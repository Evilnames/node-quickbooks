/**
 * @file Node.js client for QuickBooks V3 API
 * @name node-quickbooks
 * @author Michael Cohen <michael_cohen@intuit.com>
 * @license ISC
 * @copyright 2014 Michael Cohen
 */

var request = require('request'),
    uuid    = require('node-uuid'),
    debug   = require('request-debug'),
    util    = require('util'),
    moment  = require('moment'),
    _       = require('underscore'),
    version = require('./package.json').version

module.exports = QuickBooks

QuickBooks.REQUEST_TOKEN_URL          = 'https://oauth.intuit.com/oauth/v1/get_request_token'
QuickBooks.ACCESS_TOKEN_URL           = 'https://oauth.intuit.com/oauth/v1/get_access_token'
QuickBooks.APP_CENTER_BASE            = 'https://appcenter.intuit.com'
QuickBooks.APP_CENTER_URL             = QuickBooks.APP_CENTER_BASE + '/Connect/Begin?oauth_token='
QuickBooks.V3_ENDPOINT_BASE_URL       = 'https://sandbox-quickbooks.api.intuit.com/v3/company/'
QuickBooks.PAYMENTS_API_BASE_URL      = 'https://sandbox.api.intuit.com/quickbooks/v4/payments'
QuickBooks.QUERY_OPERATORS            = ['=', 'IN', '<', '>', '<=', '>=', 'LIKE']

/**
 * Node.js client encapsulating access to the QuickBooks V3 Rest API. An instance
 * of this class should be instantiated on behalf of each user accessing the api.
 *
 * @param consumerKey - application key
 * @param consumerSecret  - application password
 * @param token - the OAuth generated user-specific key
 * @param tokenSecret - the OAuth generated user-specific password
 * @param realmId - QuickBooks companyId, returned as a request parameter when the user is redirected to the provided callback URL following authentication
 * @param useSandbox - boolean - See https://developer.intuit.com/v2/blog/2014/10/24/intuit-developer-now-offers-quickbooks-sandboxes
 * @param debug - boolean flag to turn on logging of HTTP requests, including headers and body
 * @constructor
 */
function QuickBooks(consumerKey, consumerSecret, token, tokenSecret, realmId, useSandbox, debug) {
  var prefix           = _.isObject(consumerKey) ? 'consumerKey.' : ''
  this.consumerKey     = eval(prefix + 'consumerKey')
  this.consumerSecret  = eval(prefix + 'consumerSecret')
  this.token           = eval(prefix + 'token')
  this.tokenSecret     = eval(prefix + 'tokenSecret')
  this.realmId         = eval(prefix + 'realmId')
  this.useSandbox      = eval(prefix + 'useSandbox')
  this.debug           = eval(prefix + 'debug')
  this.endpoint        = this.useSandbox ? QuickBooks.V3_ENDPOINT_BASE_URL : QuickBooks.V3_ENDPOINT_BASE_URL.replace('sandbox-', '')
  this.paymentEndpoint = this.useSandbox ? QuickBooks.PAYMENTS_API_BASE_URL : QuickBooks.PAYMENTS_API_BASE_URL.replace('sandbox.', '')
}

/**
 * Batch operation to enable an application to perform multiple operations in a single request.
 * The following batch items are supported:
     create
     update
     delete
     query
 * The maximum number of batch items in a single request is 25.
 *
 * @param  {object} items - JavaScript array of batch items
 * @param  {function} callback - Callback function which is called with any error and list of BatchItemResponses
 */
QuickBooks.prototype.batch = function(items, callback) {
  module.request(this, 'post', {url: '/batch'}, {BatchItemRequest: items}, callback)
}

/**
 * The change data capture (CDC) operation returns a list of entities that have changed since a specified time.
 *
 * @param  {object} entities - Comma separated list or JavaScript array of entities to search for changes
 * @param  {object} since - JavaScript Date or string representation of the form '2012-07-20T22:25:51-07:00' to look back for changes until
 * @param  {function} callback - Callback function which is called with any error and list of changes
 */
QuickBooks.prototype.changeDataCapture = function(entities, since, callback) {
  var url = '/cdc?entities='
  url += typeof entities === 'string' ? entities : entities.join(',')
  url += '&changedSince='
  url += typeof since === 'string' ? since : moment(since).format()
  module.request(this, 'get', {url: url}, null, callback)
}


// **********************  Charge Api **********************

QuickBooks.prototype.cardToken = function(card, callback) {
  module.request(this, 'post', {
    url: '/tokens',
    headers: {
      company_id: this.realmId
    }
  }, card, callback)
}


/**
 * Process a credit card charge using card details or token.
 * Can capture funds or just authorize.
 *
 * @param {object} charge - details, amount, currency etc. of charge to be processed
 * @param callback - Callback function which is called with any error or the saved Charge
 */
QuickBooks.prototype.charge = function(charge, callback) {
  module.request(this, 'post', {
    url: '/charges',
    headers: {
      company_id: this.realmId
    }
  }, charge, callback)
}

/**
 * Get details of charge.
 *
 * @param {string} chargeId - of previously created charge
 * @param callback - Callback function which is called with any error or the Charge
 */
QuickBooks.prototype.getCharge = function(chargeId, callback) {
  module.request(this, 'get', {
    url: '/charges/' + chargeId,
    headers: {
      company_id: this.realmId
    }
  }, null, callback)
}

/**
 * Allows you to capture funds for an existing charge that was intended to be captured at a later time.
 *
 * @param {string} chargeId - of previously created charge
 * @param {object} charge - details, amount, currency to capture
 * @param callback - Callback function which is called with any error or the capture description
 */
QuickBooks.prototype.capture = function(chargeId, capture, callback) {
  module.request(this, 'post', {
    url: '/charges/' + chargeId + '/capture',
    headers: {
      company_id: this.realmId
    }
  }, capture, callback)
}

/**
 * Allows you to refund an existing charge. Full and partial refund are supported.
 *
 * @param {string} chargeId - of previously created charge
 * @param {object} refund - details, amount, currency to refund
 * @param callback - Callback function which is called with any error or the refund description
 */
QuickBooks.prototype.refund = function(chargeId, refund, callback) {
  module.request(this, 'post', {
    url: '/charges/' + chargeId + '/refunds',
    headers: {
      company_id: this.realmId
    }
  }, refund, callback)
}

/**
 * Retrieves the Refund for the given refund id
 *
 * @param {string} chargeId - id of previously created charge
 * @param {string} refundId - id of previously created Refund
 * @param callback - Callback function which is called with any error or the Refund
 */
QuickBooks.prototype.getRefund = function(chargeId, refundId, callback) {
  module.request(this, 'get', {
    url: '/charges/' + chargeId + '/refunds/' + refundId,
    headers: {
      company_id: this.realmId
    }
  }, null, callback)
}

/**
 * Creates the Account in QuickBooks
 *
 * @param  {object} account - The unsaved account, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Account
 */
QuickBooks.prototype.createAccount = function(account, callback) {
  module.create(this, 'account', account, callback)
}

/**
 * Creates the Attachable in QuickBooks
 *
 * @param  {object} attachable - The unsaved attachable, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Attachable
 */
QuickBooks.prototype.createAttachable = function(attachable, callback) {
  module.create(this, 'attachable', attachable, callback)
}

/**
 * Creates the Bill in QuickBooks
 *
 * @param  {object} bill - The unsaved bill, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Bill
 */
QuickBooks.prototype.createBill = function(bill, callback) {
  module.create(this, 'bill', bill, callback)
}

/**
 * Creates the BillPayment in QuickBooks
 *
 * @param  {object} billPayment - The unsaved billPayment, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent BillPayment
 */
QuickBooks.prototype.createBillPayment = function(billPayment, callback) {
  module.create(this, 'billPayment', billPayment, callback)
}

/**
 * Creates the Class in QuickBooks
 *
 * @param  {object} class - The unsaved class, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Class
 */
QuickBooks.prototype.createClass = function(klass, callback) {
  module.create(this, 'class', klass, callback)
}

/**
 * Creates the CreditMemo in QuickBooks
 *
 * @param  {object} creditMemo - The unsaved creditMemo, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent CreditMemo
 */
QuickBooks.prototype.createCreditMemo = function(creditMemo, callback) {
  module.create(this, 'creditMemo', creditMemo, callback)
}

/**
 * Creates the Customer in QuickBooks
 *
 * @param  {object} customer - The unsaved customer, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Customer
 */
QuickBooks.prototype.createCustomer = function(customer, callback) {
  module.create(this, 'customer', customer, callback)
}

/**
 * Creates the Department in QuickBooks
 *
 * @param  {object} department - The unsaved department, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Department
 */
QuickBooks.prototype.createDepartment = function(department, callback) {
  module.create(this, 'department', department, callback)
}

/**
 * Creates the Employee in QuickBooks
 *
 * @param  {object} employee - The unsaved employee, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Employee
 */
QuickBooks.prototype.createEmployee = function(employee, callback) {
  module.create(this, 'employee', employee, callback)
}

/**
 * Creates the Estimate in QuickBooks
 *
 * @param  {object} estimate - The unsaved estimate, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Estimate
 */
QuickBooks.prototype.createEstimate = function(estimate, callback) {
  module.create(this, 'estimate', estimate, callback)
}

/**
 * Creates the Invoice in QuickBooks
 *
 * @param  {object} invoice - The unsaved invoice, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Invoice
 */
QuickBooks.prototype.createInvoice = function(invoice, callback) {
  module.create(this, 'invoice', invoice, callback)
}

/**
 * Creates the Item in QuickBooks
 *
 * @param  {object} item - The unsaved item, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Item
 */
QuickBooks.prototype.createItem = function(item, callback) {
  module.create(this, 'item', item, callback)
}

/**
 * Creates the JournalEntry in QuickBooks
 *
 * @param  {object} journalEntry - The unsaved journalEntry, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent JournalEntry
 */
QuickBooks.prototype.createJournalEntry = function(journalEntry, callback) {
  module.create(this, 'journalEntry', journalEntry, callback)
}

/**
 * Creates the Payment in QuickBooks
 *
 * @param  {object} payment - The unsaved payment, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Payment
 */
QuickBooks.prototype.createPayment = function(payment, callback) {
  module.create(this, 'payment', payment, callback)
}

/**
 * Creates the PaymentMethod in QuickBooks
 *
 * @param  {object} paymentMethod - The unsaved paymentMethod, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent PaymentMethod
 */
QuickBooks.prototype.createPaymentMethod = function(paymentMethod, callback) {
  module.create(this, 'paymentMethod', paymentMethod, callback)
}

/**
 * Creates the Purchase in QuickBooks
 *
 * @param  {object} purchase - The unsaved purchase, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Purchase
 */
QuickBooks.prototype.createPurchase = function(purchase, callback) {
  module.create(this, 'purchase', purchase, callback)
}

/**
 * Creates the PurchaseOrder in QuickBooks
 *
 * @param  {object} purchaseOrder - The unsaved purchaseOrder, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent PurchaseOrder
 */
QuickBooks.prototype.createPurchaseOrder = function(purchaseOrder, callback) {
  module.create(this, 'purchaseOrder', purchaseOrder, callback)
}

/**
 * Creates the RefundReceipt in QuickBooks
 *
 * @param  {object} refundReceipt - The unsaved refundReceipt, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent RefundReceipt
 */
QuickBooks.prototype.createRefundReceipt = function(refundReceipt, callback) {
  module.create(this, 'refundReceipt', refundReceipt, callback)
}

/**
 * Creates the SalesReceipt in QuickBooks
 *
 * @param  {object} salesReceipt - The unsaved salesReceipt, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent SalesReceipt
 */
QuickBooks.prototype.createSalesReceipt = function(salesReceipt, callback) {
  module.create(this, 'salesReceipt', salesReceipt, callback)
}

/**
 * Creates the TaxAgency in QuickBooks
 *
 * @param  {object} taxAgency - The unsaved taxAgency, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxAgency
 */
QuickBooks.prototype.createTaxAgency = function(taxAgency, callback) {
  module.create(this, 'taxAgency', taxAgency, callback)
}

/**
 * Creates the TaxService in QuickBooks
 *
 * @param  {object} taxService - The unsaved taxService, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxService
 */
QuickBooks.prototype.createTaxService = function(taxService, callback) {
  module.create(this, 'taxService', taxService, callback)
}

/**
 * Creates the Term in QuickBooks
 *
 * @param  {object} term - The unsaved term, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Term
 */
QuickBooks.prototype.createTerm = function(term, callback) {
  module.create(this, 'term', term, callback)
}

/**
 * Creates the TimeActivity in QuickBooks
 *
 * @param  {object} timeActivity - The unsaved timeActivity, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent TimeActivity
 */
QuickBooks.prototype.createTimeActivity = function(timeActivity, callback) {
  module.create(this, 'timeActivity', timeActivity, callback)
}

/**
 * Creates the Vendor in QuickBooks
 *
 * @param  {object} vendor - The unsaved vendor, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent Vendor
 */
QuickBooks.prototype.createVendor = function(vendor, callback) {
  module.create(this, 'vendor', vendor, callback)
}

/**
 * Creates the VendorCredit in QuickBooks
 *
 * @param  {object} vendorCredit - The unsaved vendorCredit, to be persisted in QuickBooks
 * @param  {function} callback - Callback function which is called with any error and the persistent VendorCredit
 */
QuickBooks.prototype.createVendorCredit = function(vendorCredit, callback) {
  module.create(this, 'vendorCredit', vendorCredit, callback)
}



/**
 * Retrieves the Account from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Account
 * @param  {function} callback - Callback function which is called with any error and the persistent Account
 */
QuickBooks.prototype.getAccount = function(id, callback) {
  module.read(this, 'account', id, callback)
}

/**
 * Retrieves the Attachable from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Attachable
 * @param  {function} callback - Callback function which is called with any error and the persistent Attachable
 */
QuickBooks.prototype.getAttachable = function(id, callback) {
  module.read(this, 'attachable', id, callback)
}

/**
 * Retrieves the Bill from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Bill
 * @param  {function} callback - Callback function which is called with any error and the persistent Bill
 */
QuickBooks.prototype.getBill = function(id, callback) {
  module.read(this, 'bill', id, callback)
}

/**
 * Retrieves the BillPayment from QuickBooks
 *
 * @param  {string} Id - The Id of persistent BillPayment
 * @param  {function} callback - Callback function which is called with any error and the persistent BillPayment
 */
QuickBooks.prototype.getBillPayment = function(id, callback) {
  module.read(this, 'billPayment', id, callback)
}

/**
 * Retrieves the Class from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Class
 * @param  {function} callback - Callback function which is called with any error and the persistent Class
 */
QuickBooks.prototype.getClass = function(id, callback) {
  module.read(this, 'class', id, callback)
}

/**
 * Retrieves the CompanyInfo from QuickBooks
 *
 * @param  {string} Id - The Id of persistent CompanyInfo
 * @param  {function} callback - Callback function which is called with any error and the persistent CompanyInfo
 */
QuickBooks.prototype.getCompanyInfo = function(id, callback) {
  module.read(this, 'companyInfo', id, callback)
}

/**
 * Retrieves the CreditMemo from QuickBooks
 *
 * @param  {string} Id - The Id of persistent CreditMemo
 * @param  {function} callback - Callback function which is called with any error and the persistent CreditMemo
 */
QuickBooks.prototype.getCreditMemo = function(id, callback) {
  module.read(this, 'creditMemo', id, callback)
}

/**
 * Retrieves the Customer from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Customer
 * @param  {function} callback - Callback function which is called with any error and the persistent Customer
 */
QuickBooks.prototype.getCustomer = function(id, callback) {
  module.read(this, 'customer', id, callback)
}

/**
 * Retrieves the Department from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Department
 * @param  {function} callback - Callback function which is called with any error and the persistent Department
 */
QuickBooks.prototype.getDepartment = function(id, callback) {
  module.read(this, 'department', id, callback)
}

/**
 * Retrieves the Employee from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Employee
 * @param  {function} callback - Callback function which is called with any error and the persistent Employee
 */
QuickBooks.prototype.getEmployee = function(id, callback) {
  module.read(this, 'employee', id, callback)
}

/**
 * Retrieves the Estimate from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Estimate
 * @param  {function} callback - Callback function which is called with any error and the persistent Estimate
 */
QuickBooks.prototype.getEstimate = function(id, callback) {
  module.read(this, 'estimate', id, callback)
}

/**
 * Emails the Estimate PDF from QuickBooks to the address supplied in Estimate.BillEmail.EmailAddress
 * or the specified 'sendTo' address
 *
 * @param  {string} Id - The Id of persistent Estimate
 * @param  {string} sendTo - optional email address to send the PDF to. If not provided, address supplied in Estimate.BillEmail.EmailAddress will be used
 * @param  {function} callback - Callback function which is called with any error and the Estimate PDF
 */
QuickBooks.prototype.sendEstimatePdf = function(id, sendTo, callback) {
  var path = '/estimate/' + id + '/send'
  callback = _.isFunction(sendTo) ? sendTo : callback
  if (sendTo && ! _.isFunction(sendTo)) {
    path += '?sendTo=' + sendTo
  }
  module.request(this, 'post', {url: path}, null, module.unwrap(callback, 'Estimate'))
}

/**
 * Retrieves the Invoice from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Invoice
 * @param  {function} callback - Callback function which is called with any error and the persistent Invoice
 */
QuickBooks.prototype.getInvoice = function(id, callback) {
  module.read(this, 'invoice', id, callback)
}

/**
 * Retrieves the Invoice PDF from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Invoice
 * @param  {function} callback - Callback function which is called with any error and the Invoice PDF
 */
QuickBooks.prototype.getInvoicePdf = function(id, callback) {
  module.read(this, 'Invoice', id + '/pdf', callback)
}

/**
 * Emails the Invoice PDF from QuickBooks to the address supplied in Invoice.BillEmail.EmailAddress
 * or the specified 'sendTo' address
 *
 * @param  {string} Id - The Id of persistent Invoice
 * @param  {string} sendTo - optional email address to send the PDF to. If not provided, address supplied in Invoice.BillEmail.EmailAddress will be used
 * @param  {function} callback - Callback function which is called with any error and the Invoice PDF
 */
QuickBooks.prototype.sendInvoicePdf = function(id, sendTo, callback) {
  var path = '/invoice/' + id + '/send'
  callback = _.isFunction(sendTo) ? sendTo : callback
  if (sendTo && ! _.isFunction(sendTo)) {
    path += '?sendTo=' + sendTo
  }
  module.request(this, 'post', {url: path}, null, module.unwrap(callback, 'Invoice'))
}

/**
 * Retrieves the Item from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Item
 * @param  {function} callback - Callback function which is called with any error and the persistent Item
 */
QuickBooks.prototype.getItem = function(id, callback) {
  module.read(this, 'item', id, callback)
}

/**
 * Retrieves the JournalEntry from QuickBooks
 *
 * @param  {string} Id - The Id of persistent JournalEntry
 * @param  {function} callback - Callback function which is called with any error and the persistent JournalEntry
 */
QuickBooks.prototype.getJournalEntry = function(id, callback) {
  module.read(this, 'journalEntry', id, callback)
}

/**
 * Retrieves the Payment from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Payment
 * @param  {function} callback - Callback function which is called with any error and the persistent Payment
 */
QuickBooks.prototype.getPayment = function(id, callback) {
  module.read(this, 'payment', id, callback)
}

/**
 * Retrieves the PaymentMethod from QuickBooks
 *
 * @param  {string} Id - The Id of persistent PaymentMethod
 * @param  {function} callback - Callback function which is called with any error and the persistent PaymentMethod
 */
QuickBooks.prototype.getPaymentMethod = function(id, callback) {
  module.read(this, 'paymentMethod', id, callback)
}

/**
 * Retrieves the Preferences from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Preferences
 * @param  {function} callback - Callback function which is called with any error and the persistent Preferences
 */
QuickBooks.prototype.getPreferences = function(id, callback) {
  module.read(this, 'preferences', id, callback)
}

/**
 * Retrieves the Purchase from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Purchase
 * @param  {function} callback - Callback function which is called with any error and the persistent Purchase
 */
QuickBooks.prototype.getPurchase = function(id, callback) {
  module.read(this, 'purchase', id, callback)
}

/**
 * Retrieves the PurchaseOrder from QuickBooks
 *
 * @param  {string} Id - The Id of persistent PurchaseOrder
 * @param  {function} callback - Callback function which is called with any error and the persistent PurchaseOrder
 */
QuickBooks.prototype.getPurchaseOrder = function(id, callback) {
  module.read(this, 'purchaseOrder', id, callback)
}

/**
 * Retrieves the RefundReceipt from QuickBooks
 *
 * @param  {string} Id - The Id of persistent RefundReceipt
 * @param  {function} callback - Callback function which is called with any error and the persistent RefundReceipt
 */
QuickBooks.prototype.getRefundReceipt = function(id, callback) {
  module.read(this, 'refundReceipt', id, callback)
}

/**
 * Retrieves the Reports from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Reports
 * @param  {function} callback - Callback function which is called with any error and the persistent Reports
 */
QuickBooks.prototype.getReports = function(id, callback) {
  module.read(this, 'reports', id, callback)
}

/**
 * Retrieves the SalesReceipt from QuickBooks
 *
 * @param  {string} Id - The Id of persistent SalesReceipt
 * @param  {function} callback - Callback function which is called with any error and the persistent SalesReceipt
 */
QuickBooks.prototype.getSalesReceipt = function(id, callback) {
  module.read(this, 'salesReceipt', id, callback)
}

/**
 * Retrieves the SalesReceipt PDF from QuickBooks
 *
 * @param  {string} Id - The Id of persistent SalesReceipt
 * @param  {function} callback - Callback function which is called with any error and the SalesReceipt PDF
 */
QuickBooks.prototype.getSalesReceiptPdf = function(id, callback) {
  module.read(this, 'salesReceipt', id + '/pdf', callback)
}

/**
 * Emails the SalesReceipt PDF from QuickBooks to the address supplied in SalesReceipt.BillEmail.EmailAddress
 * or the specified 'sendTo' address
 *
 * @param  {string} Id - The Id of persistent SalesReceipt
 * @param  {string} sendTo - optional email address to send the PDF to. If not provided, address supplied in SalesReceipt.BillEmail.EmailAddress will be used
 * @param  {function} callback - Callback function which is called with any error and the SalesReceipt PDF
 */
QuickBooks.prototype.sendSalesReceiptPdf = function(id, sendTo, callback) {
  var path = '/salesreceipt/' + id + '/send'
  callback = _.isFunction(sendTo) ? sendTo : callback
  if (sendTo && ! _.isFunction(sendTo)) {
    path += '?sendTo=' + sendTo
  }
  module.request(this, 'post', {url: path}, null, module.unwrap(callback, 'SalesReceipt'))
}

/**
 * Retrieves the TaxAgency from QuickBooks
 *
 * @param  {string} Id - The Id of persistent TaxAgency
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxAgency
 */
QuickBooks.prototype.getTaxAgency = function(id, callback) {
  module.read(this, 'taxAgency', id, callback)
}

/**
 * Retrieves the TaxCode from QuickBooks
 *
 * @param  {string} Id - The Id of persistent TaxCode
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxCode
 */
QuickBooks.prototype.getTaxCode = function(id, callback) {
  module.read(this, 'taxCode', id, callback)
}

/**
 * Retrieves the TaxRate from QuickBooks
 *
 * @param  {string} Id - The Id of persistent TaxRate
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxRate
 */
QuickBooks.prototype.getTaxRate = function(id, callback) {
  module.read(this, 'taxRate', id, callback)
}

/**
 * Retrieves the Term from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Term
 * @param  {function} callback - Callback function which is called with any error and the persistent Term
 */
QuickBooks.prototype.getTerm = function(id, callback) {
  module.read(this, 'term', id, callback)
}

/**
 * Retrieves the TimeActivity from QuickBooks
 *
 * @param  {string} Id - The Id of persistent TimeActivity
 * @param  {function} callback - Callback function which is called with any error and the persistent TimeActivity
 */
QuickBooks.prototype.getTimeActivity = function(id, callback) {
  module.read(this, 'timeActivity', id, callback)
}

/**
 * Retrieves the Vendor from QuickBooks
 *
 * @param  {string} Id - The Id of persistent Vendor
 * @param  {function} callback - Callback function which is called with any error and the persistent Vendor
 */
QuickBooks.prototype.getVendor = function(id, callback) {
  module.read(this, 'vendor', id, callback)
}

/**
 * Retrieves the VendorCredit from QuickBooks
 *
 * @param  {string} Id - The Id of persistent VendorCredit
 * @param  {function} callback - Callback function which is called with any error and the persistent VendorCredit
 */
QuickBooks.prototype.getVendorCredit = function(id, callback) {
  module.read(this, 'vendorCredit', id, callback)
}



/**
 * Updates QuickBooks version of Account
 *
 * @param  {object} account - The persistent Account, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Account
 */
QuickBooks.prototype.updateAccount = function(account, callback) {
  module.update(this, 'account', account, callback)
}

/**
 * Updates QuickBooks version of Attachable
 *
 * @param  {object} attachable - The persistent Attachable, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Attachable
 */
QuickBooks.prototype.updateAttachable = function(attachable, callback) {
  module.update(this, 'attachable', attachable, callback)
}

/**
 * Updates QuickBooks version of Bill
 *
 * @param  {object} bill - The persistent Bill, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Bill
 */
QuickBooks.prototype.updateBill = function(bill, callback) {
  module.update(this, 'bill', bill, callback)
}

/**
 * Updates QuickBooks version of BillPayment
 *
 * @param  {object} billPayment - The persistent BillPayment, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent BillPayment
 */
QuickBooks.prototype.updateBillPayment = function(billPayment, callback) {
  module.update(this, 'billPayment', billPayment, callback)
}

/**
 * Updates QuickBooks version of Class
 *
 * @param  {object} class - The persistent Class, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Class
 */
QuickBooks.prototype.updateClass = function(klass, callback) {
  module.update(this, 'class', klass, callback)
}

/**
 * Updates QuickBooks version of CompanyInfo
 *
 * @param  {object} companyInfo - The persistent CompanyInfo, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent CompanyInfo
 */
QuickBooks.prototype.updateCompanyInfo = function(companyInfo, callback) {
  module.update(this, 'companyInfo', companyInfo, callback)
}

/**
 * Updates QuickBooks version of CreditMemo
 *
 * @param  {object} creditMemo - The persistent CreditMemo, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent CreditMemo
 */
QuickBooks.prototype.updateCreditMemo = function(creditMemo, callback) {
  module.update(this, 'creditMemo', creditMemo, callback)
}

/**
 * Updates QuickBooks version of Customer
 *
 * @param  {object} customer - The persistent Customer, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Customer
 */
QuickBooks.prototype.updateCustomer = function(customer, callback) {
  module.update(this, 'customer', customer, callback)
}

/**
 * Updates QuickBooks version of Department
 *
 * @param  {object} department - The persistent Department, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Department
 */
QuickBooks.prototype.updateDepartment = function(department, callback) {
  module.update(this, 'department', department, callback)
}

/**
 * Updates QuickBooks version of Employee
 *
 * @param  {object} employee - The persistent Employee, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Employee
 */
QuickBooks.prototype.updateEmployee = function(employee, callback) {
  module.update(this, 'employee', employee, callback)
}

/**
 * Updates QuickBooks version of Estimate
 *
 * @param  {object} estimate - The persistent Estimate, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Estimate
 */
QuickBooks.prototype.updateEstimate = function(estimate, callback) {
  module.update(this, 'estimate', estimate, callback)
}

/**
 * Updates QuickBooks version of Invoice
 *
 * @param  {object} invoice - The persistent Invoice, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Invoice
 */
QuickBooks.prototype.updateInvoice = function(invoice, callback) {
  module.update(this, 'invoice', invoice, callback)
}

/**
 * Updates QuickBooks version of Item
 *
 * @param  {object} item - The persistent Item, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Item
 */
QuickBooks.prototype.updateItem = function(item, callback) {
  module.update(this, 'item', item, callback)
}

/**
 * Updates QuickBooks version of JournalEntry
 *
 * @param  {object} journalEntry - The persistent JournalEntry, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent JournalEntry
 */
QuickBooks.prototype.updateJournalEntry = function(journalEntry, callback) {
  module.update(this, 'journalEntry', journalEntry, callback)
}

/**
 * Updates QuickBooks version of Payment
 *
 * @param  {object} payment - The persistent Payment, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Payment
 */
QuickBooks.prototype.updatePayment = function(payment, callback) {
  module.update(this, 'payment', payment, callback)
}

/**
 * Updates QuickBooks version of PaymentMethod
 *
 * @param  {object} paymentMethod - The persistent PaymentMethod, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent PaymentMethod
 */
QuickBooks.prototype.updatePaymentMethod = function(paymentMethod, callback) {
  module.update(this, 'paymentMethod', paymentMethod, callback)
}

/**
 * Updates QuickBooks version of Preferences
 *
 * @param  {object} preferences - The persistent Preferences, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Preferences
 */
QuickBooks.prototype.updatePreferences = function(preferences, callback) {
  module.update(this, 'preferences', preferences, callback)
}

/**
 * Updates QuickBooks version of Purchase
 *
 * @param  {object} purchase - The persistent Purchase, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Purchase
 */
QuickBooks.prototype.updatePurchase = function(purchase, callback) {
  module.update(this, 'purchase', purchase, callback)
}

/**
 * Updates QuickBooks version of PurchaseOrder
 *
 * @param  {object} purchaseOrder - The persistent PurchaseOrder, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent PurchaseOrder
 */
QuickBooks.prototype.updatePurchaseOrder = function(purchaseOrder, callback) {
  module.update(this, 'purchaseOrder', purchaseOrder, callback)
}

/**
 * Updates QuickBooks version of RefundReceipt
 *
 * @param  {object} refundReceipt - The persistent RefundReceipt, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent RefundReceipt
 */
QuickBooks.prototype.updateRefundReceipt = function(refundReceipt, callback) {
  module.update(this, 'refundReceipt', refundReceipt, callback)
}

/**
 * Updates QuickBooks version of SalesReceipt
 *
 * @param  {object} salesReceipt - The persistent SalesReceipt, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent SalesReceipt
 */
QuickBooks.prototype.updateSalesReceipt = function(salesReceipt, callback) {
  module.update(this, 'salesReceipt', salesReceipt, callback)
}

/**
 * Updates QuickBooks version of TaxAgency
 *
 * @param  {object} taxAgency - The persistent TaxAgency, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxAgency
 */
QuickBooks.prototype.updateTaxAgency = function(taxAgency, callback) {
  module.update(this, 'taxAgency', taxAgency, callback)
}

/**
 * Updates QuickBooks version of TaxCode
 *
 * @param  {object} taxCode - The persistent TaxCode, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxCode
 */
QuickBooks.prototype.updateTaxCode = function(taxCode, callback) {
  module.update(this, 'taxCode', taxCode, callback)
}

/**
 * Updates QuickBooks version of TaxRate
 *
 * @param  {object} taxRate - The persistent TaxRate, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxRate
 */
QuickBooks.prototype.updateTaxRate = function(taxRate, callback) {
  module.update(this, 'taxRate', taxRate, callback)
}

/**
 * Updates QuickBooks version of TaxService
 *
 * @param  {object} taxService - The persistent TaxService, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent TaxService
 */
QuickBooks.prototype.updateTaxService = function(taxService, callback) {
  module.update(this, 'taxService', taxService, callback)
}

/**
 * Updates QuickBooks version of Term
 *
 * @param  {object} term - The persistent Term, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Term
 */
QuickBooks.prototype.updateTerm = function(term, callback) {
  module.update(this, 'term', term, callback)
}

/**
 * Updates QuickBooks version of TimeActivity
 *
 * @param  {object} timeActivity - The persistent TimeActivity, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent TimeActivity
 */
QuickBooks.prototype.updateTimeActivity = function(timeActivity, callback) {
  module.update(this, 'timeActivity', timeActivity, callback)
}

/**
 * Updates QuickBooks version of Vendor
 *
 * @param  {object} vendor - The persistent Vendor, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent Vendor
 */
QuickBooks.prototype.updateVendor = function(vendor, callback) {
  module.update(this, 'vendor', vendor, callback)
}

/**
 * Updates QuickBooks version of VendorCredit
 *
 * @param  {object} vendorCredit - The persistent VendorCredit, including Id and SyncToken fields
 * @param  {function} callback - Callback function which is called with any error and the persistent VendorCredit
 */
QuickBooks.prototype.updateVendorCredit = function(vendorCredit, callback) {
  module.update(this, 'vendorCredit', vendorCredit, callback)
}



/**
 * Deletes the Attachable from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent Attachable to be deleted, or the Id of the Attachable, in which case an extra GET request will be issued to first retrieve the Attachable
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent Attachable
 */
QuickBooks.prototype.deleteAttachable = function(idOrEntity, callback) {
  module.delete(this, 'attachable', idOrEntity, callback)
}

/**
 * Deletes the Bill from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent Bill to be deleted, or the Id of the Bill, in which case an extra GET request will be issued to first retrieve the Bill
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent Bill
 */
QuickBooks.prototype.deleteBill = function(idOrEntity, callback) {
  module.delete(this, 'bill', idOrEntity, callback)
}

/**
 * Deletes the BillPayment from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent BillPayment to be deleted, or the Id of the BillPayment, in which case an extra GET request will be issued to first retrieve the BillPayment
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent BillPayment
 */
QuickBooks.prototype.deleteBillPayment = function(idOrEntity, callback) {
  module.delete(this, 'billPayment', idOrEntity, callback)
}

/**
 * Deletes the CreditMemo from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent CreditMemo to be deleted, or the Id of the CreditMemo, in which case an extra GET request will be issued to first retrieve the CreditMemo
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent CreditMemo
 */
QuickBooks.prototype.deleteCreditMemo = function(idOrEntity, callback) {
  module.delete(this, 'creditMemo', idOrEntity, callback)
}

/**
 * Deletes the Estimate from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent Estimate to be deleted, or the Id of the Estimate, in which case an extra GET request will be issued to first retrieve the Estimate
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent Estimate
 */
QuickBooks.prototype.deleteEstimate = function(idOrEntity, callback) {
  module.delete(this, 'estimate', idOrEntity, callback)
}

/**
 * Deletes the Invoice from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent Invoice to be deleted, or the Id of the Invoice, in which case an extra GET request will be issued to first retrieve the Invoice
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent Invoice
 */
QuickBooks.prototype.deleteInvoice = function(idOrEntity, callback) {
  module.delete(this, 'invoice', idOrEntity, callback)
}

/**
 * Deletes the JournalEntry from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent JournalEntry to be deleted, or the Id of the JournalEntry, in which case an extra GET request will be issued to first retrieve the JournalEntry
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent JournalEntry
 */
QuickBooks.prototype.deleteJournalEntry = function(idOrEntity, callback) {
  module.delete(this, 'journalEntry', idOrEntity, callback)
}

/**
 * Deletes the Payment from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent Payment to be deleted, or the Id of the Payment, in which case an extra GET request will be issued to first retrieve the Payment
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent Payment
 */
QuickBooks.prototype.deletePayment = function(idOrEntity, callback) {
  module.delete(this, 'payment', idOrEntity, callback)
}

/**
 * Deletes the Purchase from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent Purchase to be deleted, or the Id of the Purchase, in which case an extra GET request will be issued to first retrieve the Purchase
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent Purchase
 */
QuickBooks.prototype.deletePurchase = function(idOrEntity, callback) {
  module.delete(this, 'purchase', idOrEntity, callback)
}

/**
 * Deletes the PurchaseOrder from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent PurchaseOrder to be deleted, or the Id of the PurchaseOrder, in which case an extra GET request will be issued to first retrieve the PurchaseOrder
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent PurchaseOrder
 */
QuickBooks.prototype.deletePurchaseOrder = function(idOrEntity, callback) {
  module.delete(this, 'purchaseOrder', idOrEntity, callback)
}

/**
 * Deletes the RefundReceipt from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent RefundReceipt to be deleted, or the Id of the RefundReceipt, in which case an extra GET request will be issued to first retrieve the RefundReceipt
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent RefundReceipt
 */
QuickBooks.prototype.deleteRefundReceipt = function(idOrEntity, callback) {
  module.delete(this, 'refundReceipt', idOrEntity, callback)
}

/**
 * Deletes the SalesReceipt from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent SalesReceipt to be deleted, or the Id of the SalesReceipt, in which case an extra GET request will be issued to first retrieve the SalesReceipt
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent SalesReceipt
 */
QuickBooks.prototype.deleteSalesReceipt = function(idOrEntity, callback) {
  module.delete(this, 'salesReceipt', idOrEntity, callback)
}

/**
 * Deletes the TimeActivity from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent TimeActivity to be deleted, or the Id of the TimeActivity, in which case an extra GET request will be issued to first retrieve the TimeActivity
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent TimeActivity
 */
QuickBooks.prototype.deleteTimeActivity = function(idOrEntity, callback) {
  module.delete(this, 'timeActivity', idOrEntity, callback)
}

/**
 * Deletes the VendorCredit from QuickBooks
 *
 * @param  {object} idOrEntity - The persistent VendorCredit to be deleted, or the Id of the VendorCredit, in which case an extra GET request will be issued to first retrieve the VendorCredit
 * @param  {function} callback - Callback function which is called with any error and the status of the persistent VendorCredit
 */
QuickBooks.prototype.deleteVendorCredit = function(idOrEntity, callback) {
  module.delete(this, 'vendorCredit', idOrEntity, callback)
}



/**
 * Finds all Accounts in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Account
 */
QuickBooks.prototype.findAccounts = function(criteria, callback) {
  module.query(this, 'account', criteria, callback)
}

/**
 * Finds all Attachables in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Attachable
 */
QuickBooks.prototype.findAttachables = function(criteria, callback) {
  module.query(this, 'attachable', criteria, callback)
}

/**
 * Finds all Bills in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Bill
 */
QuickBooks.prototype.findBills = function(criteria, callback) {
  module.query(this, 'bill', criteria, callback)
}

/**
 * Finds all BillPayments in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of BillPayment
 */
QuickBooks.prototype.findBillPayments = function(criteria, callback) {
  module.query(this, 'billPayment', criteria, callback)
}

/**
 * Finds all Budgets in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Budget
 */
QuickBooks.prototype.findBudgets = function(criteria, callback) {
  module.query(this, 'budget', criteria, callback)
}

/**
 * Finds all Classs in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Class
 */
QuickBooks.prototype.findClasses = function(criteria, callback) {
  module.query(this, 'class', criteria, callback)
}

/**
 * Finds all CompanyInfos in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of CompanyInfo
 */
QuickBooks.prototype.findCompanyInfos = function(criteria, callback) {
  module.query(this, 'companyInfo', criteria, callback)
}

/**
 * Finds all CreditMemos in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of CreditMemo
 */
QuickBooks.prototype.findCreditMemos = function(criteria, callback) {
  module.query(this, 'creditMemo', criteria, callback)
}

/**
 * Finds all Customers in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Customer
 */
QuickBooks.prototype.findCustomers = function(criteria, callback) {
  module.query(this, 'customer', criteria, callback)
}

/**
 * Finds all Departments in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Department
 */
QuickBooks.prototype.findDepartments = function(criteria, callback) {
  module.query(this, 'department', criteria, callback)
}

/**
 * Finds all Employees in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Employee
 */
QuickBooks.prototype.findEmployees = function(criteria, callback) {
  module.query(this, 'employee', criteria, callback)
}

/**
 * Finds all Estimates in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Estimate
 */
QuickBooks.prototype.findEstimates = function(criteria, callback) {
  module.query(this, 'estimate', criteria, callback)
}

/**
 * Finds all Invoices in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Invoice
 */
QuickBooks.prototype.findInvoices = function(criteria, callback) {
  module.query(this, 'invoice', criteria, callback)
}

/**
 * Finds all Items in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Item
 */
QuickBooks.prototype.findItems = function(criteria, callback) {
  module.query(this, 'item', criteria, callback)
}

/**
 * Finds all JournalEntrys in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of JournalEntry
 */
QuickBooks.prototype.findJournalEntries = function(criteria, callback) {
  module.query(this, 'journalEntry', criteria, callback)
}

/**
 * Finds all Payments in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Payment
 */
QuickBooks.prototype.findPayments = function(criteria, callback) {
  module.query(this, 'payment', criteria, callback)
}

/**
 * Finds all PaymentMethods in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of PaymentMethod
 */
QuickBooks.prototype.findPaymentMethods = function(criteria, callback) {
  module.query(this, 'paymentMethod', criteria, callback)
}

/**
 * Finds all Preferencess in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Preferences
 */
QuickBooks.prototype.findPreferenceses = function(criteria, callback) {
  module.query(this, 'preferences', criteria, callback)
}

/**
 * Finds all Purchases in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Purchase
 */
QuickBooks.prototype.findPurchases = function(criteria, callback) {
  module.query(this, 'purchase', criteria, callback)
}

/**
 * Finds all PurchaseOrders in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of PurchaseOrder
 */
QuickBooks.prototype.findPurchaseOrders = function(criteria, callback) {
  module.query(this, 'purchaseOrder', criteria, callback)
}

/**
 * Finds all RefundReceipts in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of RefundReceipt
 */
QuickBooks.prototype.findRefundReceipts = function(criteria, callback) {
  module.query(this, 'refundReceipt', criteria, callback)
}

/**
 * Finds all SalesReceipts in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of SalesReceipt
 */
QuickBooks.prototype.findSalesReceipts = function(criteria, callback) {
  module.query(this, 'salesReceipt', criteria, callback)
}

/**
 * Finds all TaxAgencys in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of TaxAgency
 */
QuickBooks.prototype.findTaxAgencies = function(criteria, callback) {
  module.query(this, 'taxAgency', criteria, callback)
}

/**
 * Finds all TaxCodes in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of TaxCode
 */
QuickBooks.prototype.findTaxCodes = function(criteria, callback) {
  module.query(this, 'taxCode', criteria, callback)
}

/**
 * Finds all TaxRates in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of TaxRate
 */
QuickBooks.prototype.findTaxRates = function(criteria, callback) {
  module.query(this, 'taxRate', criteria, callback)
}

/**
 * Finds all Terms in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Term
 */
QuickBooks.prototype.findTerms = function(criteria, callback) {
  module.query(this, 'term', criteria, callback)
}

/**
 * Finds all TimeActivitys in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of TimeActivity
 */
QuickBooks.prototype.findTimeActivities = function(criteria, callback) {
  module.query(this, 'timeActivity', criteria, callback)
}

/**
 * Finds all Vendors in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of Vendor
 */
QuickBooks.prototype.findVendors = function(criteria, callback) {
  module.query(this, 'vendor', criteria, callback)
}

/**
 * Finds all VendorCredits in QuickBooks, optionally matching the specified criteria
 *
 * @param  {object} criteria - (Optional) String or single-valued map converted to a where clause of the form "where key = 'value'"
 * @param  {function} callback - Callback function which is called with any error and the list of VendorCredit
 */
QuickBooks.prototype.findVendorCredits = function(criteria, callback) {
  module.query(this, 'vendorCredit', criteria, callback)
}



/**
 * Retrieves the BalanceSheet Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the BalanceSheet Report
 */
QuickBooks.prototype.reportBalanceSheet = function(options, callback) {
  module.report(this, 'BalanceSheet', options, callback)
}

/**
 * Retrieves the ProfitAndLoss Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the ProfitAndLoss Report
 */
QuickBooks.prototype.reportProfitAndLoss = function(options, callback) {
  module.report(this, 'ProfitAndLoss', options, callback)
}

/**
 * Retrieves the ProfitAndLossDetail Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the ProfitAndLossDetail Report
 */
QuickBooks.prototype.reportProfitAndLossDetail = function(options, callback) {
  module.report(this, 'ProfitAndLossDetail', options, callback)
}

/**
 * Retrieves the TrialBalance Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the TrialBalance Report
 */
QuickBooks.prototype.reportTrialBalance = function(options, callback) {
  module.report(this, 'TrialBalance', options, callback)
}

/**
 * Retrieves the CashFlow Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the CashFlow Report
 */
QuickBooks.prototype.reportCashFlow = function(options, callback) {
  module.report(this, 'CashFlow', options, callback)
}

/**
 * Retrieves the InventoryValuationSummary Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the InventoryValuationSummary Report
 */
QuickBooks.prototype.reportInventoryValuationSummary = function(options, callback) {
  module.report(this, 'InventoryValuationSummary', options, callback)
}

/**
 * Retrieves the CustomerSales Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the CustomerSales Report
 */
QuickBooks.prototype.reportCustomerSales = function(options, callback) {
  module.report(this, 'CustomerSales', options, callback)
}

/**
 * Retrieves the ItemSales Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the ItemSales Report
 */
QuickBooks.prototype.reportItemSales = function(options, callback) {
  module.report(this, 'ItemSales', options, callback)
}

/**
 * Retrieves the CustomerIncome Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the CustomerIncome Report
 */
QuickBooks.prototype.reportCustomerIncome = function(options, callback) {
  module.report(this, 'CustomerIncome', options, callback)
}

/**
 * Retrieves the CustomerBalance Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the CustomerBalance Report
 */
QuickBooks.prototype.reportCustomerBalance = function(options, callback) {
  module.report(this, 'CustomerBalance', options, callback)
}

/**
 * Retrieves the CustomerBalanceDetail Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the CustomerBalanceDetail Report
 */
QuickBooks.prototype.reportCustomerBalanceDetail = function(options, callback) {
  module.report(this, 'CustomerBalanceDetail', options, callback)
}

/**
 * Retrieves the AgedReceivables Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the AgedReceivables Report
 */
QuickBooks.prototype.reportAgedReceivables = function(options, callback) {
  module.report(this, 'AgedReceivables', options, callback)
}

/**
 * Retrieves the AgedReceivableDetail Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the AgedReceivableDetail Report
 */
QuickBooks.prototype.reportAgedReceivableDetail = function(options, callback) {
  module.report(this, 'AgedReceivableDetail', options, callback)
}

/**
 * Retrieves the VendorBalance Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the VendorBalance Report
 */
QuickBooks.prototype.reportVendorBalance = function(options, callback) {
  module.report(this, 'VendorBalance', options, callback)
}

/**
 * Retrieves the VendorBalanceDetail Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the VendorBalanceDetail Report
 */
QuickBooks.prototype.reportVendorBalanceDetail = function(options, callback) {
  module.report(this, 'VendorBalanceDetail', options, callback)
}

/**
 * Retrieves the AgedPayables Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the AgedPayables Report
 */
QuickBooks.prototype.reportAgedPayables = function(options, callback) {
  module.report(this, 'AgedPayables', options, callback)
}

/**
 * Retrieves the AgedPayableDetail Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the AgedPayableDetail Report
 */
QuickBooks.prototype.reportAgedPayableDetail = function(options, callback) {
  module.report(this, 'AgedPayableDetail', options, callback)
}

/**
 * Retrieves the VendorExpenses Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the VendorExpenses Report
 */
QuickBooks.prototype.reportVendorExpenses = function(options, callback) {
  module.report(this, 'VendorExpenses', options, callback)
}

/**
 * Retrieves the GeneralLedgerDetail Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the GeneralLedgerDetail Report
 */
QuickBooks.prototype.reportGeneralLedgerDetail = function(options, callback) {
  module.report(this, 'GeneralLedger', options, callback)
}

/**
 * Retrieves the DepartmentSales Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the DepartmentSales Report
 */
QuickBooks.prototype.reportDepartmentSales = function(options, callback) {
  module.report(this, 'DepartmentSales', options, callback)
}

/**
 * Retrieves the ClassSales Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the ClassSales Report
 */
QuickBooks.prototype.reportClassSales = function(options, callback) {
  module.report(this, 'ClassSales', options, callback)
}

/**
 * Retrieves the AccountListDetail Report from QuickBooks
 *
 * @param  {object} options - (Optional) Map of key-value pairs passed as options to the Report
 * @param  {function} callback - Callback function which is called with any error and the AccountListDetail Report
 */
QuickBooks.prototype.reportAccountListDetail = function(options, callback) {
  module.report(this, 'AccountList', options, callback)
}

module.request = function(context, verb, options, entity, callback) {
  var isPayment = options.url.match(/^\/(charge|tokens)/),
      url = isPayment ? context.paymentEndpoint + options.url :
                        context.endpoint + context.realmId + options.url,
      opts = {
        url:     url,
        qs:      options.qs || {},
        headers: options.headers || {},
        oauth:   module.oauth(context),
        json:    true
      }
  opts.headers['User-Agent'] = 'node-quickbooks: version ' + version
  if (isPayment) {
    opts.headers['Request-Id'] = uuid.v1()
  }
  if (options.url.match(/pdf$/)) {
    opts.headers['accept'] = 'application/pdf'
    opts.encoding = null
  }
  if (entity !== null) {
    opts.body = entity
  }
  if ('production' !== process.env.NODE_ENV && context.debug) {
    debug(request)
  }
  request[verb].call(context, opts, function (err, res, body) {
    if ('production' !== process.env.NODE_ENV && context.debug) {
      console.log('invoking endpoint: ' + url)
      console.log(entity || '')
      console.log(util.inspect(body, {showHidden: false, depth: null}));
    }
    if (callback) {
      callback(err, body)
    } else {
      return
    }
  })
}

// **********************  CRUD Api **********************
module.create = function(context, entityName, entity, callback) {
  var url = '/' + entityName.toLowerCase()
  module.request(context, 'post', {url: url}, entity, module.unwrap(callback, entityName))
}

module.read = function(context, entityName, id, callback) {
  var url = '/' + entityName.toLowerCase() + '/' + id
  module.request(context, 'get', {url: url}, null, module.unwrap(callback, entityName))
}

module.update = function(context, entityName, entity, callback) {
  if (! entity.Id || ! entity.SyncToken) {
    throw new Error(entityName + ' must contain Id and SyncToken fields: ' +
        util.inspect(entity, {showHidden: false, depth: null}))
  }
  var url = '/' + entityName.toLowerCase() + '?operation=update'
  module.request(context, 'post', {url: url}, entity, module.unwrap(callback, entityName))
}

module.delete = function(context, entityName, idOrEntity, callback) {
  var url = '/' + entityName.toLowerCase() + '?operation=delete'
  callback = callback || function(e, r) {}
  if (_.isObject(idOrEntity)) {
    module.request(context, 'post', {url: url}, idOrEntity, callback)
  } else {
    module.read(context, entityName, idOrEntity, function(err, entity) {
      if (err) {
        callback(err)
      } else {
        module.request(context, 'post', {url: url}, entity, callback)
      }
    })
  }
}

// **********************  Query Api **********************
module.query = function(context, entity, criteria, callback) {
  var url = '/query?query@@select * from ' + entity
  for (var p in criteria) {
    if (p.toLowerCase() === 'count' && criteria[p]) {
      url = url.replace('select \* from', 'select count(*) from')
      delete criteria[p]
      continue
    }
  }
  if (criteria && typeof criteria !== 'function') {
    url += module.criteriaToString(criteria) || ''
    url = url.replace(/%/, '%25')
            .replace(/'/g, '%27')
            .replace(/=/, '%3D')
            .replace(/</, '%3C')
            .replace(/>/, '%3E')
            .replace(/\&/g, '%26')
            .replace(/\#/g, '%23')
            .replace(/\\/g, '%5C')
  }
  url = url.replace('@@', '=')
  module.request(context, 'get', {url: url}, null, typeof criteria === 'function' ? criteria : callback)
}


// **********************  Report Api **********************
module.report = function(context, reportType, criteria, callback) {
  var url = '/reports/' + reportType
  if (criteria && typeof criteria !== 'function') {
    url += module.reportCriteria(criteria) || ''
  }
  module.request(context, 'get', {url: url}, null, typeof criteria === 'function' ? criteria : callback)
}


module.oauth = function(context) {
  return {
    consumer_key:    context.consumerKey,
    consumer_secret: context.consumerSecret,
    token:           context.token,
    token_secret:    context.tokenSecret
  }
}

module.isNumeric = function(n) {
  return ! isNaN(parseFloat(n)) && isFinite(n);
}

module.checkProperty = function(field, name) {
  return (field.toLowerCase() === name)
}

module.criteriaToString = function(criteria) {
  if (_.isString(criteria)) return criteria
  var flattened = [];
  if (_.isArray(criteria)) {
    if (criteria.length === 0) return ''
    for (var i=0, l=criteria.length; i<l; i++) {
      var c = criteria[i];
      if (_.isUndefined(c.field) || _.isUndefined(c.value)) continue
      var criterion = {
        field:    c.field,
        value:    c.value,
        operator: '='
      }
      if (! _.isUndefined(c.operator) && _.contains(QuickBooks.QUERY_OPERATORS, c.operator.toUpperCase())) {
        criterion.operator = c.operator
      }
      flattened[flattened.length] = criterion
    }
  } else if (_.isObject(criteria)) {
    if (! Object.keys(criteria).length) return ''
    for (var p in criteria) {
      var criterion = {
        field:    p,
        value:    criteria[p],
        operator: '='
      }
      flattened[flattened.length] = criterion
    }
  }
  var sql = '', limit, offset, desc, asc
  for (var i=0, l=flattened.length; i<l; i++) {
    var criterion = flattened[i];
    if (module.checkProperty(criterion.field, 'limit')) {
      limit = criterion.value
      continue
    }
    if (module.checkProperty(criterion.field, 'offset')) {
      offset = criterion.value
      continue
    }
    if (module.checkProperty(criterion.field, 'desc')) {
      desc = criterion.value
      continue
    }
    if (module.checkProperty(criterion.field, 'asc')) {
      asc = criterion.value
      continue
    }
    if (sql != '') {
      sql += ' and '
    }
    sql += criterion.field + ' ' + criterion.operator + ' '
    sql += "'" + criterion.value + "'"
  }
  if (sql != '') {
    sql = ' where ' + sql
  }
  if (asc)  sql += ' orderby ' + asc + ' asc'
  if (desc)  sql += ' orderby ' + desc + ' desc'
  if (offset) sql += ' startposition ' + offset
  if (limit)  sql += ' maxresults ' + limit
  return sql
}

module.reportCriteria = function(criteria) {
  var s = '?'
  for (var p in criteria) {
    s += p + '=' + criteria[p] + '&'
  }
  return s
}

module.capitalize = function(s) {
  return s.substring(0, 1).toUpperCase() + s.substring(1)
}

QuickBooks.prototype.capitalize = module.capitalize

module.pluralize = function(s) {
  var last = s.substring(s.length - 1)
  if (last === 's') {
    return s + "es"
  } else if (last === 'y') {
    return s.substring(0, s.length - 1) + "ies"
  } else {
    return s + 's'
  }
}

QuickBooks.prototype.pluralize = module.pluralize

module.unwrap = function(callback, entityName) {
  if (! callback) return function(err, data) {}
  return function(err, data) {
    if (err) {
      if (callback) callback(err)
    } else {
      var name = module.capitalize(entityName)
      if (callback) callback(err, data[name] || data)
    }
  }
}
