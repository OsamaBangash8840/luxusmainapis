const { Property } = require("../models/Property");
const PropertyView = require('../models/PropertyView');
const Category = require("../models/Category");
const mongoose = require('mongoose');
const { off } = require("../models/User");
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { MESSAGES, STATUS_CODES } = require('../config/constants');
const logger = require('../utils/logger');
const escapeRegex = require('../utils/escapeRegex');



module.exports.addProperty = asyncHandler(async (req, res) => {
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
        throw new ApiError(STATUS_CODES.FORBIDDEN, 'Only sellers or admins can create properties');
    }

    const { title, description, price, location, address, type, buildYear, size, lotSize, amenities, images, category } = req.body;

    const safeCategory = escapeRegex(category);
    const categoryObj = await Category.findOne({ name: new RegExp(`^${safeCategory}$`, 'i') });

    if (!categoryObj) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Category not found');
    }

    const property = new Property({
        title,
        description,
        price,
        location,
        address,
        type,
        buildYear,
        size,
        lotSize,
        amenities,
        images,
        category: categoryObj._id,
        seller: req.user.id
    });

    const newProperty = await property.save();

    logger.info('Property created', { propertyId: newProperty._id, userId: req.user.id });
    res.status(STATUS_CODES.CREATED).json(new ApiResponse(STATUS_CODES.CREATED, newProperty, MESSAGES.PROPERTY.CREATE_SUCCESS));
});

module.exports.getUserProperties = asyncHandler(async (req, res) => {
    const properties = await Property.find({ seller: req.user.id })
        .sort({ createdAt: -1 });
    res.json(new ApiResponse(STATUS_CODES.OK, properties, MESSAGES.PROPERTY.FETCH_SUCCESS));
});

module.exports.searchProperty = asyncHandler(async (req, res) => {
    const { minPrice, maxPrice, search, category, location, page = '1', limit = '10' } = req.query;

    const query = { status: 'approved' };

    if (search) {
        const safeSearch = escapeRegex(search);
        query.$or = [
            { title: new RegExp(safeSearch, 'i') },
            { description: new RegExp(safeSearch, 'i') }
        ];
    }

    if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (category) {
        if (mongoose.Types.ObjectId.isValid(category)) {
            // Category is an ID
            const categoryDoc = await Category.findById(category);
            if (categoryDoc) query.category = categoryDoc._id;
        } else {
            // Category is a name string
            const safeCategory = escapeRegex(category);
            if (safeCategory) {
                const categoryDoc = await Category.findOne({
                    name: new RegExp(`^${safeCategory}$`, 'i')
                });
                if (categoryDoc) {
                    query.category = categoryDoc._id;
                }
            }
        }
    }

    if (location) {
        const safeLocation = escapeRegex(location);
        const locationRegex = new RegExp(safeLocation, 'i');
        query.$or = query.$or || [];
        query.$or.push(
            { 'address.street': locationRegex },
            { 'address.city': locationRegex },
            { 'address.state': locationRegex },
            { 'address.zipCode': locationRegex },
            { 'address.country': locationRegex }
        );
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const properties = await Property.find(mongoose.trusted(query))
        .populate('category')
        .populate('seller', 'name email')
        .skip(skip)
        .limit(limitNumber)
        .sort({ createdAt: -1 });

    const total = await Property.countDocuments(mongoose.trusted(query));

    res.status(STATUS_CODES.OK).json(
        new ApiResponse(STATUS_CODES.OK, {
            properties,
            pagination: {
                total,
                page: pageNumber,
                pages: Math.ceil(total / limitNumber)
            }
        }, MESSAGES.PROPERTY.FETCH_SUCCESS)
    );
});

module.exports.getProperties = asyncHandler(async (req, res) => {
    const allProperties = await Property.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, allProperties, MESSAGES.PROPERTY.FETCH_SUCCESS));
});

module.exports.singleProperty = asyncHandler(async (req, res) => {
    const propertyId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.VALIDATION.INVALID_ID);
    }

    const property = await Property.findById(propertyId)
        .populate("seller", "username email phone");

    if (!property) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
    }

    if (property.status === 'approved') {
        const ipAddress = req.ip || req.connection.remoteAddress;
        try {
            await PropertyView.create({ propertyId: property._id, ipAddress });
            property.views += 1;
            await property.save();
        } catch (err) {
            // Duplicate key error (E11000) means the IP already viewed it in the last hour
        }
    }

    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, property, MESSAGES.PROPERTY.FETCH_SUCCESS));
});

module.exports.relatedProperties = asyncHandler(async (req, res) => {
    const property = await Property.findById(req.params.id).populate('category');
    const relatedProperties = await Property.find({
        category: property.category._id,
        _id: { $ne: property._id }
    }).limit(3);
    res.json(new ApiResponse(STATUS_CODES.OK, relatedProperties, MESSAGES.PROPERTY.FETCH_SUCCESS));
});

module.exports.updateProperty = asyncHandler(async (req, res) => {
    const propertyId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.VALIDATION.INVALID_ID);
    }

    let property = await Property.findById(propertyId);
    if (!property) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
    }

    if (!property.seller.equals(req.user.id) && req.user.role !== 'admin') {
        throw new ApiError(STATUS_CODES.FORBIDDEN, 'Not authorized to update this property');
    }

    const allowedFields = ['title', 'description', 'price', 'location', 'address', 'type', 'buildYear', 'size', 'lotSize', 'amenities', 'images', 'category'];
    const updateData = {};
    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updateData[field] = req.body[field];
        }
    }

    if (property.status === 'approved' && req.user.role === 'seller') {
        updateData.status = 'pending';
    }

    const updatedProperty = await Property.findByIdAndUpdate(propertyId, updateData, { new: true });

    logger.info('Property updated', { propertyId, userId: req.user?.id });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, updatedProperty, MESSAGES.PROPERTY.UPDATE_SUCCESS));
});

module.exports.deleteProperty = asyncHandler(async (req, res) => {
    const propertyId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, MESSAGES.VALIDATION.INVALID_ID);
    }

    const property = await Property.findById(propertyId);
    if (!property) {
        throw new ApiError(STATUS_CODES.NOT_FOUND, MESSAGES.PROPERTY.NOT_FOUND);
    }

    if (!property.seller.equals(req.user.id) && req.user.role !== 'admin') {
        throw new ApiError(STATUS_CODES.FORBIDDEN, 'Not authorized to delete this property');
    }

    await Property.findByIdAndDelete(propertyId);

    logger.info('Property deleted', { propertyId, userId: req.user?.id });
    res.status(STATUS_CODES.OK).json(new ApiResponse(STATUS_CODES.OK, null, MESSAGES.PROPERTY.DELETE_SUCCESS));
});


module.exports.getPropertiesByCategory = asyncHandler(async (req, res) => {
    const { category } = req.params;

    if (!category) {
        throw new ApiError(STATUS_CODES.BAD_REQUEST, 'Category parameter is required');
    }

    let categoryQuery;
    if (mongoose.Types.ObjectId.isValid(category)) {
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            throw new ApiError(STATUS_CODES.NOT_FOUND, 'Category not found');
        }
        categoryQuery = category;
    } else {
        const safeCategory = escapeRegex(category);
        const categoryObj = await Category.findOne({ name: new RegExp(`^${safeCategory}$`, 'i') });
        if (!categoryObj) {
            throw new ApiError(STATUS_CODES.NOT_FOUND, 'Category not found'); // Changed to NOT_FOUND for consistency
        }
        categoryQuery = categoryObj._id;
    }

    const properties = await Property.find({ category: categoryQuery, status: 'approved' })
        .sort({ createdAt: -1 })
        .populate('category')
        .populate('seller', 'name email');

    res.json(new ApiResponse(STATUS_CODES.OK, properties, MESSAGES.PROPERTY.FETCH_SUCCESS));
});