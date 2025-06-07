const calculateScores = (analysis) => {
  // Content Score (40% weight)
  let contentScore = 0;
  
  // Keywords matching
  if (analysis.keywords.matchPercentage) {
    contentScore += analysis.keywords.matchPercentage * 0.5;
  }
  
  // Skills matching
  if (analysis.skillsMatch.matchPercentage) {
    contentScore += analysis.skillsMatch.matchPercentage * 0.3;
  }
  
  // Content quality indicators
  const contentQuality = analysis.improvements.filter(imp => 
    imp.status === 'good'
  ).length;
  contentScore += (contentQuality * 10) * 0.2;
  
  contentScore = Math.min(100, Math.round(contentScore));
  
  // Formatting Score (30% weight)
  let formattingScore = 100;
  const formattingIssues = analysis.formatting.length;
  const severeIssues = analysis.formatting.filter(f => f.severity === 'high').length;
  
  formattingScore -= (formattingIssues * 10);
  formattingScore -= (severeIssues * 15);
  formattingScore = Math.max(0, formattingScore);
  
  // ATS Compatibility Score (30% weight)
  let atsScore = 85; // Base score
  
  // Deduct for formatting issues
  atsScore -= (formattingIssues * 5);
  
  // Deduct for missing sections
  const missingCriticalSections = analysis.improvements.filter(imp => 
    imp.title.includes('Missing') && imp.status === 'poor'
  ).length;
  atsScore -= (missingCriticalSections * 10);
  
  // Bonus for good keyword match
  if (analysis.keywords.matchPercentage > 70) {
    atsScore += 10;
  }
  
  atsScore = Math.max(0, Math.min(100, atsScore));
  
  // Calculate overall score
  const overall = Math.round(
    (contentScore * 0.4) + 
    (formattingScore * 0.3) + 
    (atsScore * 0.3)
  );
  
  return {
    overall,
    content: contentScore,
    formatting: formattingScore,
    atsCompatibility: atsScore
  };
};

module.exports = {
  calculateScores
};