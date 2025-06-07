const Joi = require('joi');

const validateAnalysisRequest = (req, res, next) => {
  // Validate request body
  const schema = Joi.object({
    jobDescriptionText: Joi.string().max(10000).optional(),
    includeIndustryInsights: Joi.boolean().optional(),
    targetRole: Joi.string().max(100).optional(),
    experienceLevel: Joi.string().valid('entry', 'mid', 'senior', 'executive').optional()
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'Invalid request',
      details: error.details[0].message
    });
  }

  next();
};

module.exports = {
  validateAnalysisRequest
};