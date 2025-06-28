const { query, validationResult } = require("express-validator");

// Validation middleware to check for errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// Validate analytics query parameters
const validateAnalyticsQuery = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),

  query("period")
    .optional()
    .isIn(["week", "month", "quarter", "year", "all"])
    .withMessage("Period must be one of: week, month, quarter, year, all"),

  query("category")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

  handleValidationErrors,
];

// Validate report generation query
const validateReportQuery = [
  query("period")
    .optional()
    .isIn(["week", "month", "quarter", "year"])
    .withMessage("Period must be one of: week, month, quarter, year"),

  handleValidationErrors,
];

module.exports = {
  validateAnalyticsQuery,
  validateReportQuery,
};

/* working on project whose details are mentioned in these documents. I have completed the 'User', 'Artwork' and 'Payment' module. you gave me this plan in you previous chat: Key Features to Implement 
1. User authentication system with roles (artist, buyer, admin) 
2. Artwork listing, management, and approval workflow 
3. Payment processing with Stripe (€1 listing fee) 
4. Artwork traceability system 
5. Real-time messaging between buyers and artists (just text messages not any type file or media. Also Message can only be between Artist and Buyer directly not related to any specific artwork. like buyer visit the profile of artist and will message him from there. So it won't be directly related to any artwork.)  
6. Admin moderation tools 
7. Image upload and management 
8. Necessary Background job processing

Database Schema will include: * *
*Users * 
Artworks * *
*Transactions * 
TraceabilityRecords * *
*Messages * 
ListingPayments * *
*ArtistProfiles * 
Analytics 

Let's approach this methodically, starting with the project setup and core architecture. We'll follow the structure in your backend plan document. Typical approach would be: 
1. Project initialization and core setup 
2. Database connection and models 
3. Authentication system 
4. Basic CRUD operations for artworks 
5. Middleware implementation 
6. Payment integration 
7. Traceability system 
8. Messaging system 
9. Admin features (include all necessary stat of platform and also the approval and rejection of pending artwork created by artist, Top-selling categories/artists. Also add 2 APIs in relevant modules to get top artist and top artworks to show as feature on top.)
1. and followers and following functionality between artist and buyer (one way just like twitter)
2. and like unlike feature of art
3. and also the Artwork imae should not be downloaded in anyway

you have the access to @art-marketplace-backend repo. You can see complete current status of the project by seeing in all folders and files.
suggest me which next should we work on? just analyze the whole project and give the suggestion of next module. */