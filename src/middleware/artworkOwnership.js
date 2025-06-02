// This middleware checks if the user owns the artwork and if it can be modified

const Artwork  = require("../models/Artwork");
const AppError = require("../utils/appError");

// check if user owns the artwork
const checkArtworkOwnership = async (req, res, next) => {
  try {
    const artwork = await Artwork.findById(req.params.id);

    if (!artwork) {
      return next(new AppError("Artwork not found", 404));
    }

    if (artwork.artist.toString() !== req.user.id) {
      return next(
        new AppError("You do not have permission to modify this artwork", 403)
      );
    }

    // Attach artwork to request for use in controller
    req.artwork = artwork;
    next();
  } catch (error) {
    next(error);
    console.log(`Error in checkArtworkOwnership middleware: ${error.message}`);
  }
};

// Check if artwork can be modified (not sold)
const checkArtworkModifiable = (req, res, next) => {
  if (req.artwork.soldAt) {
    return next(new AppError("Cannot modify sold artwork", 403));
  }
  next();
};

module.exports = {
  checkArtworkOwnership,
  checkArtworkModifiable,
};
