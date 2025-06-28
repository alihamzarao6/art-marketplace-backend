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
    formatted.listingFeeStatus = artwork.listingFeeStatus;
    formatted.listingFeePaidAt = artwork.listingFeePaidAt;
  }

  return formatted;
};

module.exports = {
  validateImageDimensions,
  formatArtworkResponse,
};
