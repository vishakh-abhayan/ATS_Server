const logger = require('../utils/logger');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const { uploadMiddleware } = require('../middleware/fileUpload');
const { validateAnalysisRequest } = require('../middleware/validation');

// Main analysis endpoint
router.post(
   '/analyze',
  (req, res, next) => {
    logger.info('Analysis request received', {
      files: req.files,
      body: req.body,
    });
    next();
  },
  uploadMiddleware.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'jobDescription', maxCount: 1 }
  ]),
  validateAnalysisRequest,
  resumeController.analyzeResume
);

// Get detailed feedback for specific section
router.get(
   '/feedback/:analysisId/:section',
  (req, res, next) => {
    logger.info('Feedback request received', {
      analysisId: req.params.analysisId,
      section: req.params.section,
    });
    next();
  },
  resumeController.getDetailedFeedback
);

// Generate optimized resume content
router.post(
   '/optimize',
  (req, res, next) => {
    logger.info('Optimization request received', {
      body: req.body,
    });
    next();
  },
  resumeController.generateOptimizedResume
);

// Get industry insights
router.post(
   '/industry-insights',
  (req, res, next) => {
    logger.info('Industry insights request received', {
      file: req.file,
      body: req.body,
    });
    next();
  },
  uploadMiddleware.single('resume'),
  async (req, res, next) => {
    try {
      const documentParser = require('../services/documentParser');
      const azureOpenAI = require('../services/azureOpenAIService');
      
      const resumeText = await documentParser.parseDocument(req.file);
      const insights = await azureOpenAI.generateIndustryInsights(
        resumeText,
        req.body.industry
      );
      
      res.json(insights);
    } catch (error) {
      next(error);
    }
  }
);

// Batch analysis endpoint for multiple resumes
router.post(
   '/batch-analyze',
  (req, res, next) => {
    logger.info('Batch analysis request received', {
      files: req.files,
      body: req.body,
    });
    next();
  },
  uploadMiddleware.array('resumes', 10),
  async (req, res, next) => {
    try {
      const documentParser = require('../services/documentParser');
      const azureOpenAI = require('../services/azureOpenAIService');
      
      const jobDescription = req.body.jobDescription;
      
      const analyses = await Promise.all(
        req.files.map(async (file) => {
          const resumeText = await documentParser.parseDocument(file);
          const analysis = await azureOpenAI.analyzeResume(resumeText, jobDescription);
          
          return {
            filename: file.originalname,
            score: analysis.scores.overall,
            summary: analysis.executive_summary
          };
        })
      );
      
      res.json({
        analyses,
        summary: {
          total: analyses.length,
          average_score: analyses.reduce((sum, a) => sum + a.score, 0) / analyses.length,
          top_candidates: analyses.sort((a, b) => b.score - a.score).slice(0, 3)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;