const documentParser = require('../services/documentParser');
const azureOpenAI = require('../services/azureOpenAIService');
const cacheService = require('../services/cacheService');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

const analyzeResume = async (req, res, next) => {
  const analysisId = uuidv4();
  const startTime = Date.now();
  
  try {
    logger.analysis('Starting resume analysis', {
      requestId: req.requestId,
      analysisId,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
    
    // Extract files and text
    const resumeFile = req.files['resume']?.[0];
    const jobDescFile = req.files['jobDescription']?.[0];
    const jobDescText = req.body.jobDescriptionText;

    if (!resumeFile) {
      logger.warn('Resume analysis failed - no file provided', {
        requestId: req.requestId,
        analysisId
      });
      
      return res.status(400).json({ 
        error: 'Resume file is required',
        analysisId,
        requestId: req.requestId
      });
    }

    logger.analysis('Resume file received', {
      requestId: req.requestId,
      analysisId,
      filename: resumeFile.originalname,
      fileSize: resumeFile.size,
      mimeType: resumeFile.mimetype
    });

    // Parse resume
    const parseStartTime = Date.now();
    const resumeText = await documentParser.parseDocument(resumeFile);
    const parseTime = Date.now() - parseStartTime;
    
    logger.performance('Document parsing completed', {
      requestId: req.requestId,
      analysisId,
      parseTime,
      textLength: resumeText.length,
      wordCount: resumeText.split(/\s+/).length
    });
    
    // Parse job description
    let jobDescription = '';
    if (jobDescFile) {
      const jobParseStartTime = Date.now();
      jobDescription = await documentParser.parseDocument(jobDescFile);
      const jobParseTime = Date.now() - jobParseStartTime;
      
      logger.analysis('Job description file parsed', {
        requestId: req.requestId,
        analysisId,
        jobParseTime,
        jobDescLength: jobDescription.length
      });
    } else if (jobDescText) {
      jobDescription = jobDescText;
      logger.analysis('Job description text provided', {
        requestId: req.requestId,
        analysisId,
        jobDescLength: jobDescription.length
      });
    }

    // Check cache first
    const cacheKey = `analysis:${Buffer.from(resumeText + jobDescription).toString('base64').substring(0, 32)}`;
    const cacheStartTime = Date.now();
    const cachedResult = await cacheService.get(cacheKey);
    const cacheTime = Date.now() - cacheStartTime;
    
    if (cachedResult) {
      logger.analysis('Returning cached analysis result', {
        requestId: req.requestId,
        analysisId,
        cacheTime,
        totalTime: Date.now() - startTime
      });
      
      return res.json({
        ...cachedResult,
        analysisId,
        requestId: req.requestId,
        cached: true
      });
    }

    logger.analysis('Starting AI analysis - cache miss', {
      requestId: req.requestId,
      analysisId,
      cacheTime
    });

    // Perform AI analysis
    const aiStartTime = Date.now();
    const analysis = await azureOpenAI.analyzeResume(resumeText, jobDescription);
    const aiAnalysisTime = Date.now() - aiStartTime;
    
    logger.performance('AI analysis completed', {
      requestId: req.requestId,
      analysisId,
      aiAnalysisTime,
      overallScore: analysis.scores.overall
    });
    
    // Get industry insights
    const insightsStartTime = Date.now();
    const industryInsights = await azureOpenAI.generateIndustryInsights(resumeText);
    const insightsTime = Date.now() - insightsStartTime;
    
    logger.performance('Industry insights generated', {
      requestId: req.requestId,
      analysisId,
      insightsTime,
      detectedIndustry: industryInsights.detected_industry
    });

    const totalAnalysisTime = Date.now() - startTime;
    
    logger.analysis('Complete analysis finished', {
      requestId: req.requestId,
      analysisId,
      totalAnalysisTime,
      breakdown: {
        parseTime,
        aiAnalysisTime,
        insightsTime,
        cacheTime
      }
    });

    // Prepare comprehensive response
    const response = {
      analysisId,
      requestId: req.requestId,
      overall_score: analysis.scores.overall,
      score_breakdown: {
        content_analysis: {
          score: analysis.scores.content_quality,
          description: 'AI-powered evaluation of your resume content quality, clarity, and impact'
        },
        formatting: {
          score: analysis.scores.breakdown.formatting,
          description: 'Assessment of resume structure, consistency, and visual presentation'
        },
        ats_compatibility: {
          score: analysis.scores.ats_compatibility,
          description: 'How well your resume can be parsed by Applicant Tracking Systems'
        },
        job_match: jobDescription ? {
          score: analysis.scores.job_match,
          description: 'How well your qualifications match the specific job requirements'
        } : null
      },
      improvements: analysis.improvements,
      detailed_insights: {
        ats_analysis: analysis.detailed_analysis.ats,
        content_quality: analysis.detailed_analysis.content,
        extracted_information: analysis.detailed_analysis.information,
        job_matching: analysis.detailed_analysis.job_match
      },
      industry_insights: industryInsights,
      executive_summary: analysis.executive_summary,
      metadata: {
        analysis_version: '2.0',
        ai_model: 'Azure OpenAI GPT-4',
        analysis_time: totalAnalysisTime,
        word_count: resumeText.split(/\s+/).length
      }
    };

    // Cache the result
    const setCacheStartTime = Date.now();
    await cacheService.set(cacheKey, response, 3600); // Cache for 1 hour
    const setCacheTime = Date.now() - setCacheStartTime;
    
    logger.performance('Analysis result cached', {
      requestId: req.requestId,
      analysisId,
      setCacheTime
    });

    logger.analysis('Analysis successfully completed and returned', {
      requestId: req.requestId,
      analysisId,
      totalTime: Date.now() - startTime,
      score: analysis.scores.overall
    });

    res.json(response);
  } catch (error) {
    const errorTime = Date.now() - startTime;
    
    logger.error('Resume analysis failed', {
      requestId: req.requestId,
      analysisId,
      error: error.message,
      stack: error.stack,
      errorTime
    });
    
    next(error);
  }
};

const getDetailedFeedback = async (req, res, next) => {
  try {
    const { analysisId, section } = req.params;
    
    logger.api('Detailed feedback requested', {
      requestId: req.requestId,
      analysisId,
      section
    });
    
    const feedback = await cacheService.get(`analysis:${analysisId}:${section}`);
    
    if (!feedback) {
      logger.warn('Analysis not found for detailed feedback', {
        requestId: req.requestId,
        analysisId,
        section
      });
      
      return res.status(404).json({ 
        error: 'Analysis not found',
        requestId: req.requestId
      });
    }
    
    logger.api('Detailed feedback returned', {
      requestId: req.requestId,
      analysisId,
      section
    });
    
    res.json(feedback);
  } catch (error) {
    logger.error('Failed to get detailed feedback', {
      requestId: req.requestId,
      analysisId: req.params.analysisId,
      section: req.params.section,
      error: error.message
    });
    
    next(error);
  }
};

const generateOptimizedResume = async (req, res, next) => {
  try {
    const { resumeText, jobDescription, improvements } = req.body;
    
    logger.analysis('Optimized resume generation requested', {
      requestId: req.requestId,
      resumeLength: resumeText?.length,
      jobDescLength: jobDescription?.length,
      improvementsCount: improvements?.length
    });
    
    // This could use AI to generate an optimized version of the resume
    const prompt = `
    Based on these improvements, generate an optimized version of this resume section:
    
    Original: ${resumeText}
    Improvements: ${JSON.stringify(improvements)}
    Job Description: ${jobDescription}
    
    Provide the optimized text that incorporates all suggestions while maintaining authenticity.
    `;
    
    // Call Azure OpenAI to generate optimized content
    // Implementation depends on your specific needs
    
    logger.analysis('Optimized resume generated', {
      requestId: req.requestId
    });
    
    res.json({ 
      optimizedText: 'Optimized resume content...',
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Failed to generate optimized resume', {
      requestId: req.requestId,
      error: error.message
    });
    
    next(error);
  }
};

module.exports = {
  analyzeResume,
  getDetailedFeedback,
  generateOptimizedResume
};