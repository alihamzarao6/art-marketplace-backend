const sharp = require("sharp");
const AppError = require("./appError");

// Validate image dimensions
const validateImageDimensions = async (
  buffer,
  minWidth = 500,
  minHeight = 500
) => {
  try {
    const metadata = await sharp(buffer).metadata();

    if (metadata.width < minWidth || metadata.height < minHeight) {
      throw new AppError(
        `Image dimensions too small. Minimum size is ${minWidth}x${minHeight}px`,
        400
      );
    }

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: metadata.size,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Invalid image file", 400);
  }
};

// Format artwork for API response
const formatArtworkResponse = (artwork, includePrivateFields = false) => {
  const formatted = {
    id: artwork._id,
    title: artwork.title,
    description: artwork.description,
    price: artwork.price,
    images: artwork.images,
    status: artwork.status,
    tags: artwork.tags,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    year: artwork.year,
    isOriginal: artwork.isOriginal,
    edition: artwork.edition,
    createdAt: artwork.createdAt,
    approvedAt: artwork.approvedAt,
    artist: artwork.artist,
    currentOwner: artwork.currentOwner,
  };

  // Include private fields only if requested and authorized
  if (includePrivateFields) {
    formatted.soldAt = artwork.soldAt;
    formatted.rejectedAt = artwork.rejectedAt;
    formatted.rejectionReason = artwork.rejectionReason;
  }

  return formatted;
};

// Generate artwork thumbnail URL from main image
const generateThumbnailUrl = (imageUrl, size = "300x300") => {
  if (!imageUrl || !imageUrl.includes("cloudinary.com")) {
    return imageUrl;
  }

  // Insert transformation parameters into Cloudinary URL
  const parts = imageUrl.split("/upload/");
  if (parts.length === 2) {
    return `${parts[0]}/upload/w_${size.split("x")[0]},h_${
      size.split("x")[1]
    },c_fill,f_auto,q_auto/${parts[1]}`;
  }

  return imageUrl;
};

// Validate artwork data completeness
const validateArtworkCompleteness = (artwork) => {
  const required = ["title", "description", "price", "images"];
  const missing = required.filter(
    (field) =>
      !artwork[field] ||
      (Array.isArray(artwork[field]) && artwork[field].length === 0)
  );

  if (missing.length > 0) {
    throw new AppError(`Missing required fields: ${missing.join(", ")}`, 400);
  }

  return true;
};

module.exports = {
  validateImageDimensions,
  formatArtworkResponse,
  generateThumbnailUrl,
  validateArtworkCompleteness,
};
