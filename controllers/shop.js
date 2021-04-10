const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');
const dotenv = require('dotenv').config();
const stripe = require('stripe')(process.env.privateStripeAPIKey);

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 8;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product
    .countDocuments()
    .then(noOfProducts => {
      totalItems = noOfProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE)
    })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
        currentPage: page,
        hasNextPage: page * ITEMS_PER_PAGE < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        searchString: ''
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postSearchProducts = (req, res, next) => {
  const searchString = req.body.search;
  const page = +req.query.page || 1;
  let totalItems;
  Product
    .countDocuments({
      title: {
        $regex: new RegExp(searchString, 'i')
      }
    })
    .then(noOfProducts => {
      totalItems = noOfProducts;
      return Product
        .find({
          title: {
            $regex: new RegExp(searchString, 'i')
          }
        })
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE)
    })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'Search results- "' + searchString + '"',
        path: '/products',
        currentPage: page,
        hasNextPage: page * ITEMS_PER_PAGE < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        searchString: searchString
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req,res,next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail.ejs', {
        prod: product,
        pageTitle: product.title,
        path: '/products',
        searchString: ''
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product
    .countDocuments()
    .then(noOfProducts => {
      totalItems = noOfProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE)
    })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: page * ITEMS_PER_PAGE < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        searchString: ''
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()  //to convert populate to a promise
    .then(user => {
      const cartProducts = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: cartProducts,
        searchString: ''
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req,res,next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(() => {
      res.redirect('/cart')
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user.deleteItemFromCart(prodId)
    .then(() => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let cartProducts;
  let totalPrice = 0;
  req.user
    .populate('cart.items.productId')
    .execPopulate()  //to convert populate to a promise
    .then(user => {
      cartProducts = user.cart.items;
      totalPrice = 0;
      cartProducts.forEach(product => {
        totalPrice += product.quantity * product.productId.price;
      });
      return stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: cartProducts.map(p => {
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100,
            currency: 'usd',
            quantity: p.quantity
          };
        }),
        success_url: req.protocol + '://' + req.get('host') + '/checkout/success', //-http://localhost:3000/checkout/success
        cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel'
      });
    })
    .then(session => {
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: cartProducts,
        totalSum: totalPrice,
        sessionId: session.id,
        searchString: ''
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckoutSuccess = (req,res,next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()  //to convert populate to a promise
    .then(user => {
      const cartProducts = user.cart.items.map(i => {
        return {productData: { ...i.productId._doc }, quantity: i.quantity}; //The ._doc property provides just the object's properties without any of the methods and other metadata that Mongoose attaches to it.
      });
      const order = new Order({
        products: cartProducts,
        user: {
          userId: req.user._id,
          email: req.user.email
        }
      })
      return order.save();
    })
    .then(() => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({'user.userId': req.user._id})
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
        searchString: ''
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        const error = new Error('Order not found!');
        return next(error);
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        const error = new Error('Unauthorized access!');
        return next(error);
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="'+ invoiceName +'"');
      const pdfDoc = new PDFDocument();
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);
      pdfDoc.fontSize(26).text('Invoice', {
        underline: true
      });
      pdfDoc.text('-----------------------');
      let totalPrice = 0;
      order.products.forEach(prod => {
        totalPrice += prod.quantity * prod.productData.price;
        pdfDoc
          .fontSize(14)
          .text(
            prod.productData.title +
              ' - ' +
              prod.quantity +
              ' x ' +
              '$' +
              prod.productData.price
          );
      });
      pdfDoc.text('---');
      pdfDoc.fontSize(20).text('Total Price: $' + totalPrice);
      pdfDoc.end();
      ////-------------------------------------------------------------------------------
      ////To download a pre-existing pdf:
      // const file = fs.createReadStream(invoicePath);
      // file.pipe(res);
      ////-------------------------------------------------------------------------------
      ////Alternate way to download pdf (slower in case of bigger files):
      // fs.readFile(invoicePath, (err, data) => {
      //   if(err) {
      //     next(err);
      //   }
      //   res.setHeader('Content-Type', 'application/pdf');
      //   res.setHeader('Content-Disposition', 'inline; filename="'+ invoiceName +'"');
      //   res.send(data);
      // });
      ////-------------------------------------------------------------------------------
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};