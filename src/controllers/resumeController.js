const documentParser = require('../services/documentParser');
const azureOpenAI = require('../services/azureOpenAIService');
const cacheService = require('../services/cacheService');
const { v4: uuidv4 } = require('uuid');

const analyzeResume = async (req, res, next) => {
  const analysisId = uuidv4();
  
  try {
    // Log analysis start
    console.log(`Starting analysis: ${analysisId}`);
    
    // Extract files and text
    const resumeFile = req.files['resume']?.[0];
    const jobDescFile = req.files['jobDescription']?.[0];
    const jobDescText = req.body.jobDescriptionText;

    if (!resumeFile) {
      return res.status(400).json({ 
        error: 'Resume file is required',
        analysisId 
      });
    }

    // Parse resume
    const resumeText = await documentParser.parseDocument(resumeFile);
    
    // Parse job description
    let jobDescription = '';
    if (jobDescFile) {
      jobDescription = await documentParser.parseDocument(jobDescFile);
    } else if (jobDescText) {
      jobDescription = jobDescText;
    }

    // Check cache first
    const cacheKey = `analysis:${Buffer.from(resumeText + jobDescription).toString('base64').substring(0, 32)}`;
    const cachedResult = await cacheService.get(cacheKey);
    
    if (cachedResult) {
      console.log(`Returning cached result: ${analysisId}`);
      return res.json({
        ...cachedResult,
        analysisId,
        cached: true
      });
    }

    // Perform AI analysis
    console.log(`Starting AI analysis: ${analysisId}`);
    const startTime = Date.now();
    
    const analysis = await azureOpenAI.analyzeResume(resumeText, jobDescription);
    
    // Get industry insights
    const industryInsights = await azureOpenAI.generateIndustryInsights(resumeText);
    
    const analysisTime = Date.now() - startTime;
    console.log(`AI analysis completed in ${analysisTime}ms: ${analysisId}`);

    // Prepare comprehensive response
    const response = {
      analysisId,
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
        analysis_time: analysisTime,
        word_count: resumeText.split(/\s+/).length
      }
    };

    // Cache the result
    await cacheService.set(cacheKey, response, 3600); // Cache for 1 hour

    res.json(response);
  } catch (error) {
    console.error(`Analysis failed: ${analysisId}`, error);
    next(error);
  }
};

const getDetailedFeedback = async (req, res, next) => {
  try {
    const { analysisId, section } = req.params;
    
    // This endpoint could provide more detailed feedback for specific sections
    // You could store the full analysis in Redis and retrieve specific parts
    
    const feedback = await cacheService.get(`analysis:${analysisId}:${section}`);
    
    if (!feedback) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    res.json(feedback);
  } catch (error) {
    next(error);
  }
};

const generateOptimizedResume = async (req, res, next) => {
  try {
    const { resumeText, jobDescription, improvements } = req.body;
    
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
    
    res.json({ optimizedText: 'Optimized resume content...' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeResume,
  getDetailedFeedback,
  generateOptimizedResume
};