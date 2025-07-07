

const Product = require("../models/Product");
const logger = require("../config/logger");
const { cloudinary, uploadToCloudinary } = require("../config/cloudinary");

exports.createProduct = async (req, res) => {
  const { name, description, price, stock, category } = req.body;
  let uploadedImage = null;
  
  try {
    // Validate required fields
    if (!name || !price || !stock) {
      return res.status(400).json({ message: "Name, price, and stock are required" });
    }

    console.log("Uploaded file:", req.file); // Debug file details
    
    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        uploadedImage = await uploadToCloudinary(req.file.buffer);
        logger.info(`Image uploaded to Cloudinary: ${uploadedImage.public_id}`);
      } catch (uploadError) {
        logger.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({ message: "Image upload failed" });
      }
    }
    
    // Create product with Cloudinary image URL
    const savedProduct = await new Product({
      name,
      description,
      price: parseFloat(price),
      stock: parseInt(stock),
      category,
      image: uploadedImage ? uploadedImage.secure_url : null, // Cloudinary URL
      imagePublicId: uploadedImage ? uploadedImage.public_id : null, // Store for deletion later
      createdBy: req.user ? req.user.id : null,
    }).save();

    logger.info(`Product created: ${name} by user ${req.user ? req.user.id : "unknown"}`);
    res.status(201).json({ message: "Product created", product: savedProduct });
    
  } catch (error) {
    // If product creation fails and image was uploaded to Cloudinary, delete it
    if (uploadedImage && uploadedImage.public_id) {
      try {
        await cloudinary.uploader.destroy(uploadedImage.public_id);
        logger.info(`Cleaned up Cloudinary file on error: ${uploadedImage.public_id}`);
      } catch (cleanupError) {
        logger.error("Error cleaning up Cloudinary file:", cleanupError);
      }
    }
    
    logger.error("Create product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate("createdBy", "name email");
    logger.info("Products retrieved");
    res.json(products);
  } catch (error) {
    logger.error("Get products error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, category } = req.body;
  let uploadedImage = null;
  
  try {
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Upload new image to Cloudinary if provided
    if (req.file) {
      try {
        uploadedImage = await uploadToCloudinary(req.file.buffer);
        logger.info(`New image uploaded to Cloudinary: ${uploadedImage.public_id}`);
        
        // Delete old image from Cloudinary if it exists
        if (existingProduct.imagePublicId) {
          try {
            await cloudinary.uploader.destroy(existingProduct.imagePublicId);
            logger.info(`Deleted old Cloudinary image: ${existingProduct.imagePublicId}`);
          } catch (error) {
            logger.error("Error deleting old Cloudinary image:", error);
          }
        }
      } catch (uploadError) {
        logger.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({ message: "Image upload failed" });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name,
        description,
       price: price !== undefined && price !== '' ? parseFloat(price) : existingProduct.price,
stock: stock !== undefined && stock !== '' ? parseInt(stock) : existingProduct.stock,

        category,
        ...(uploadedImage && { 
          image: uploadedImage.secure_url,
          imagePublicId: uploadedImage.public_id 
        }),
      },
      { new: true }
    );

    logger.info(`Product updated: ${id}`);
    res.json({ message: "Product updated", product: updatedProduct });
    
  } catch (error) {
    // Clean up new image if update fails
    if (uploadedImage && uploadedImage.public_id) {
      try {
        await cloudinary.uploader.destroy(uploadedImage.public_id);
        logger.info(`Cleaned up new image on error: ${uploadedImage.public_id}`);
      } catch (cleanupError) {
        logger.error("Error cleaning up Cloudinary file:", cleanupError);
      }
    }
    
    logger.error("Update product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  
  try {
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Delete image from Cloudinary if it exists
    if (product.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(product.imagePublicId);
        logger.info(`Deleted Cloudinary image: ${product.imagePublicId}`);
      } catch (error) {
        logger.error("Error deleting Cloudinary image:", error);
      }
    }

    await Product.findByIdAndDelete(id);
    logger.info(`Product deleted: ${id}`);
    res.json({ message: "Product deleted" });
    
  } catch (error) {
    logger.error("Delete product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};