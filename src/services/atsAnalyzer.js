const natural = require('natural');
const nlp = require('compromise');
const keywordExtractor = require('./keywordExtractor');

const analyze = async (resumeText, jobDescription = '') => {
  const analysis = {
    keywords: {},
    improvements: [],
    skillsMatch: {},
    experienceRelevance: {},
    formatting: {}
  };

  // Extract and analyze keywords
  const resumeKeywords = keywordExtractor.extract(resumeText);
  const jobKeywords = jobDescription ? keywordExtractor.extract(jobDescription) : [];
  
  analysis.keywords = analyzeKeywordMatch(resumeKeywords, jobKeywords);
  
  // Check formatting issues
  analysis.formatting = checkFormatting(resumeText);
  
  // Analyze content structure
  const contentAnalysis = analyzeContent(resumeText);
  
  // Generate improvements
  analysis.improvements = generateImprovements(
    analysis.keywords,
    analysis.formatting,
    contentAnalysis
  );
  
  // Calculate skills match
  if (jobDescription) {
    analysis.skillsMatch = calculateSkillsMatch(resumeText, jobDescription);
  }
  
  return analysis;
};

const analyzeKeywordMatch = (resumeKeywords, jobKeywords) => {
  const matchedKeywords = [];
  const missingKeywords = [];
  
  jobKeywords.forEach(keyword => {
    if (resumeKeywords.some(rk => 
      rk.toLowerCase().includes(keyword.toLowerCase()) ||
      keyword.toLowerCase().includes(rk.toLowerCase())
    )) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  });
  
  return {
    matched: matchedKeywords,
    missing: missingKeywords,
    matchPercentage: jobKeywords.length > 0 
      ? (matchedKeywords.length / jobKeywords.length) * 100 
      : 0
  };
};

const checkFormatting = (text) => {
  const issues = [];
  
  // Check for common formatting issues
  if (text.includes('�')) {
    issues.push({
      type: 'encoding',
      severity: 'high',
      message: 'Document contains special characters that may not parse correctly'
    });
  }
  
  // Check section headers
  const commonSections = ['experience', 'education', 'skills', 'summary'];
  const foundSections = commonSections.filter(section => 
    text.toLowerCase().includes(section)
  );
  
  if (foundSections.length < 3) {
    issues.push({
      type: 'structure',
      severity: 'medium',
      message: 'Missing common resume sections'
    });
  }
  
  // Check length
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 200) {
    issues.push({
      type: 'content',
      severity: 'high',
      message: 'Resume appears to be too short'
    });
  } else if (wordCount > 1000) {
    issues.push({
      type: 'content',
      severity: 'medium',
      message: 'Resume may be too long for ATS systems'
    });
  }
  
  return issues;
};

const analyzeContent = (text) => {
  const doc = nlp(text);
  
  return {
    hasContactInfo: checkContactInfo(text),
    hasActionVerbs: checkActionVerbs(doc),
    hasQuantifiableResults: checkQuantifiableResults(doc),
    hasBulletPoints: text.includes('•') || text.includes('–') || text.includes('-')
  };
};

const checkContactInfo = (text) => {
  const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
  const phoneRegex = /[\d\s()+-]+\d{3}[\s()-]+\d{3}[\s()-]+\d{4}/;
  
  return {
    hasEmail: emailRegex.test(text),
    hasPhone: phoneRegex.test(text)
  };
};

const checkActionVerbs = (doc) => {
  const actionVerbs = [
    'achieved', 'improved', 'managed', 'developed', 'created',
    'implemented', 'increased', 'decreased', 'led', 'designed',
    'analyzed', 'established', 'executed', 'generated', 'enhanced'
  ];
  
  const foundVerbs = actionVerbs.filter(verb => 
    doc.has(verb)
  );
  
  return foundVerbs.length >= 5;
};

const checkQuantifiableResults = (doc) => {
  // Check for numbers and percentages
  const numbers = doc.match('#Value').out('array');
  const percentages = doc.match('#Percent').out('array');
  
  return numbers.length + percentages.length >= 3;
};

const calculateSkillsMatch = (resumeText, jobDescription) => {
  // Extract skills using NLP
  const resumeDoc = nlp(resumeText);
  const jobDoc = nlp(jobDescription);
  
  // Common skill patterns
  const skillPatterns = [
    '#Noun #Noun',
    '#Acronym',
    '#Technology'
  ];
  
  const resumeSkills = new Set();
  const jobSkills = new Set();
  
  skillPatterns.forEach(pattern => {
    resumeDoc.match(pattern).out('array').forEach(skill => 
      resumeSkills.add(skill.toLowerCase())
    );
    jobDoc.match(pattern).out('array').forEach(skill => 
      jobSkills.add(skill.toLowerCase())
    );
  });
  
  const matchedSkills = [...resumeSkills].filter(skill => 
    jobSkills.has(skill)
  );
  
  return {
    resumeSkills: [...resumeSkills],
    requiredSkills: [...jobSkills],
    matchedSkills,
    matchPercentage: jobSkills.size > 0 
      ? (matchedSkills.length / jobSkills.size) * 100 
      : 0
  };
};

const generateImprovements = (keywords, formatting, content) => {
  const improvements = [];
  
  // Keyword improvements
  if (keywords.matchPercentage < 50) {
    improvements.push({
      title: 'Low Keyword Match',
      description: 'Your resume lacks several key terms found in similar job descriptions for your target role.',
      status: 'poor',
      actionItem: `Incorporate missing keywords: ${keywords.missing.slice(0, 5).join(', ')}`
    });
  }
  
  // Formatting improvements
  formatting.forEach(issue => {
    if (issue.severity === 'high') {
      improvements.push({
        title: 'Formatting Issue Detected',
        description: issue.message,
        status: 'poor',
        actionItem: 'Fix formatting to ensure ATS compatibility'
      });
    }
  });
  
  // Content improvements
  if (!content.hasActionVerbs) {
    improvements.push({
      title: 'Weak Action Verbs',
      description: 'Your resume needs stronger action verbs to describe achievements.',
      status: 'warning',
      actionItem: 'Start bullet points with action verbs like "achieved", "implemented", "managed"'
    });
  }
  
  if (!content.hasQuantifiableResults) {
    improvements.push({
      title: 'Missing Quantifiable Results',
      description: 'Your experience descriptions would be stronger with specific metrics and outcomes.',
      status: 'warning',
      actionItem: 'Add numbers to demonstrate impact, e.g., "Increased sales by 20%" or "Reduced costs by $50K"'
    });
  }
  
  if (!content.hasContactInfo.hasEmail || !content.hasContactInfo.hasPhone) {
    improvements.push({
      title: 'Missing Contact Information',
      description: 'Ensure your resume includes complete contact information.',
      status: 'poor',
      actionItem: 'Add email address and phone number to the header'
    });
  }
  
  // Add positive feedback
  if (content.hasActionVerbs && keywords.matchPercentage > 70) {
    improvements.push({
      title: 'Good Use of Keywords and Action Verbs',
      description: 'Your resume effectively uses relevant keywords and strong action verbs.',
      status: 'good'
    });
  }
  
  return improvements;
};

module.exports = {
  analyze
};