const express = require('express');
const { body } = require('express-validator/check');

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/add-product', isAuth, adminController.getAddProduct);

router.get('/products', isAuth, adminController.getProducts);

router.post('/add-product',
    isAuth,
    [
        body('title', 'Title should be atleast 3 characters long and only numbers and letters allowed')
            .isString()
            .isLength({min: 3})
            .trim(),
        body('price')
            .isFloat()
            .withMessage('Enter a valid price')
            .trim(),
        body('description')
            .isLength({min: 5, max: 400})
            .withMessage('Description should be 5-400 characters long')
            .trim()
    ],
    adminController.postAddProduct
);

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

router.post('/edit-product/',
    isAuth,
    [
        body('title', 'Title should be atleast 3 characters long and only numbers and letters allowed')
            .isString()
            .isLength({min: 3})
            .trim(),
        body('price')
            .isFloat()
            .withMessage('Enter a valid price')
            .trim(),
        body('description')
            .isLength({min: 5, max: 400})
            .withMessage('Description should be 5-400 characters long')
            .trim()
    ],
    adminController.postEditProduct);

router.post('/delete-product', isAuth, adminController.deleteProduct);

module.exports = router;
