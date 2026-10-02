const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { STATUS_CODES } = require('../config/constants');
const mongoose = require('mongoose');

module.exports.addCategory = asyncHandler(async (req, res) => {
    const { name, images } = req.body;
    const category = new Category({ name, images });
    const newCategory = await category.save();
    res.status(STATUS_CODES.CREATED).json(new ApiResponse(STATUS_CODES.CREATED, newCategory, 'Category created successfully'));
});

module.exports.getAllCategories = asyncHandler(async (req, res) => {
    const allCategories = await Category.find({});
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, allCategories, 'Categories fetched successfully'));
});

module.exports.getCategoryById = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Invalid Id');
    }
    const category = await Category.findById(categoryId);
    if (!category) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, 'Category Not Found');
    }
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, category, 'Category fetched successfully'));
});
