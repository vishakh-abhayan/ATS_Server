const { OpenAIClient, AzureKeyCredential } = require("@azure/openai");
const pLimit = require('p-limit');

class AzureOpenAIService {
  constructor() {
    this.client = new OpenAIClient(
      process.env.AZURE_OPENAI_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
    );
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    
    // Limit concurrent API calls
    this.limit = pLimit(3);
  }

  async analyzeResume(resumeText, jobDescription = null) {
    const analyses = await Promise.all([
      this.limit(() => this.performATSAnalysis(resumeText)),
      this.limit(() => this.extractKeyInformation(resumeText)),
      this.limit(() => this.analyzeContentQuality(resumeText)),
      jobDescription ? 
        this.limit(() => this.matchResumeToJob(resumeText, jobDescription)) : 
        Promise.resolve(null)
    ]);

    return this.combineAnalyses(analyses);
  }

  async performATSAnalysis(resumeText) {
    const prompt = `
    You are an expert ATS (Applicant Tracking System) analyzer. Analyze this resume for ATS compatibility.
    
    Resume:
    ${resumeText}
    
    Provide a detailed JSON response with:
    {
      "ats_score": (0-100),
      "parsing_issues": [
        {
          "issue": "description",
          "severity": "high|medium|low",
          "location": "section name or general",
          "fix": "specific recommendation"
        }
      ],
      "format_analysis": {
        "has_standard_sections": boolean,
        "sections_found": ["section names"],
        "missing_sections": ["section names"],
        "header_quality": "good|fair|poor",
        "bullet_points_used": boolean,
        "consistent_formatting": boolean
      },
      "keyword_optimization": {
        "industry_keywords_found": ["keywords"],
        "action_verbs_count": number,
        "technical_terms_found": ["terms"],
        "soft_skills_found": ["skills"]
      },
      "recommendations": ["specific actionable recommendations"]
    }
    `;

    const response = await this.client.getChatCompletions(
      this.deploymentName,
      [{ role: "user", content: prompt }],
      {
        temperature: 0.1,
        responseFormat: { type: "json_object" }
      }
    );

    return JSON.parse(response.choices[0].message.content);
  }

  async extractKeyInformation(resumeText) {
    const prompt = `
    Extract and analyze key information from this resume. Be extremely thorough.
    
    Resume:
    ${resumeText}
    
    Provide a detailed JSON response with:
    {
      "contact_info": {
        "has_name": boolean,
        "has_email": boolean,
        "has_phone": boolean,
        "has_linkedin": boolean,
        "has_location": boolean,
        "completeness_score": (0-100)
      },
      "professional_summary": {
        "exists": boolean,
        "word_count": number,
        "quality_score": (0-100),
        "key_strengths_mentioned": ["strengths"],
        "improvement_suggestions": ["suggestions"]
      },
      "experience": {
        "total_years": number,
        "positions": [
          {
            "title": "position title",
            "company": "company name",
            "duration": "time period",
            "has_quantifiable_achievements": boolean,
            "achievement_examples": ["achievements"],
            "uses_action_verbs": boolean,
            "relevance_score": (0-100)
          }
        ],
        "career_progression": "linear|varied|unclear",
        "gaps_detected": boolean
      },
      "education": {
        "highest_degree": "degree name",
        "institutions": ["names"],
        "graduation_years": ["years"],
        "gpa_mentioned": boolean,
        "relevant_coursework": ["courses"],
        "certifications": ["cert names"]
      },
      "skills": {
        "technical_skills": ["skills"],
        "soft_skills": ["skills"],
        "languages": ["languages"],
        "tools_and_technologies": ["tools"],
        "skill_categories": {
          "programming": ["skills"],
          "frameworks": ["skills"],
          "databases": ["skills"],
          "cloud": ["skills"],
          "other": ["skills"]
        }
      },
      "achievements": {
        "quantifiable_results": ["results"],
        "awards_and_recognition": ["awards"],
        "impact_statements": ["statements"]
      }
    }
    `;

    const response = await this.client.getChatCompletions(
      this.deploymentName,
      [{ role: "user", content: prompt }],
      {
        temperature: 0.1,
        responseFormat: { type: "json_object" }
      }
    );

    return JSON.parse(response.choices[0].message.content);
  }

  async analyzeContentQuality(resumeText) {
    const prompt = `
    Analyze the content quality and writing effectiveness of this resume.
    
    Resume:
    ${resumeText}
    
    Provide a detailed JSON response with:
    {
      "content_score": (0-100),
      "writing_analysis": {
        "clarity_score": (0-100),
        "conciseness_score": (0-100),
        "professional_tone_score": (0-100),
        "grammar_issues": ["issues found"],
        "repetitive_phrases": ["phrases"],
        "passive_voice_usage": "high|medium|low",
        "readability_score": (0-100)
      },
      "impact_analysis": {
        "strong_action_verbs": ["verbs used"],
        "weak_phrases": ["phrases to improve"],
        "quantifiable_achievements_count": number,
        "specific_vs_generic_ratio": number,
        "value_proposition_clarity": (0-100)
      },
      "storytelling": {
        "career_narrative_coherence": (0-100),
        "progression_clarity": (0-100),
        "unique_value_highlighted": boolean,
        "memorable_achievements": ["achievements"]
      },
      "improvements": [
        {
          "section": "section name",
          "current_text": "current phrase",
          "suggested_text": "improved phrase",
          "impact": "high|medium|low"
        }
      ]
    }
    `;

    const response = await this.client.getChatCompletions(
      this.deploymentName,
      [{ role: "user", content: prompt }],
      {
        temperature: 0.2,
        responseFormat: { type: "json_object" }
      }
    );

    return JSON.parse(response.choices[0].message.content);
  }

  async matchResumeToJob(resumeText, jobDescription) {
    const prompt = `
    Perform a comprehensive match analysis between this resume and job description.
    
    Resume:
    ${resumeText}
    
    Job Description:
    ${jobDescription}
    
    Provide a detailed JSON response with:
    {
      "match_score": (0-100),
      "qualification_analysis": {
        "required_qualifications_met": ["qualifications"],
        "required_qualifications_missing": ["qualifications"],
        "preferred_qualifications_met": ["qualifications"],
        "overqualified_areas": ["areas"]
      },
      "keyword_analysis": {
        "critical_keywords_matched": ["keywords"],
        "critical_keywords_missing": ["keywords"],
        "keyword_density_score": (0-100),
        "context_relevance_score": (0-100)
      },
      "skills_gap_analysis": {
        "required_skills_matched": ["skills"],
        "required_skills_missing": ["skills"],
        "transferable_skills": ["skills"],
        "skills_to_highlight": ["skills"],
        "skills_to_acquire": ["skills"]
      },
      "experience_alignment": {
        "years_required": number,
        "years_provided": number,
        "relevance_score": (0-100),
        "similar_roles_held": ["roles"],
        "industry_match": boolean,
        "seniority_match": "under|match|over"
      },
      "cultural_fit_indicators": {
        "company_values_alignment": ["values"],
        "work_style_match": "good|fair|poor",
        "soft_skills_alignment": ["skills"]
      },
      "competitive_analysis": {
        "strengths_vs_typical_candidate": ["strengths"],
        "weaknesses_vs_typical_candidate": ["weaknesses"],
        "unique_selling_points": ["points"],
        "estimated_interview_probability": (0-100)
      },
      "optimization_suggestions": [
        {
          "priority": "high|medium|low",
          "section": "section to modify",
          "action": "specific action to take",
          "keywords_to_add": ["keywords"],
          "expected_impact": "description of impact"
        }
      ],
      "tailored_summary": "A 2-3 sentence summary that could replace the current summary to better match this job"
    }
    `;

    const response = await this.client.getChatCompletions(
      this.deploymentName,
      [{ role: "user", content: prompt }],
      {
        temperature: 0.1,
        responseFormat: { type: "json_object" }
      }
    );

    return JSON.parse(response.choices[0].message.content);
  }

  async generateIndustryInsights(resumeText, industry = null) {
    const prompt = `
    Provide industry-specific insights and recommendations for this resume.
    ${industry ? `Industry: ${industry}` : 'Detect the industry from the resume.'}
    
    Resume:
    ${resumeText}
    
    Provide a detailed JSON response with:
    {
      "detected_industry": "industry name",
      "industry_trends": {
        "hot_skills": ["skills in demand"],
        "emerging_technologies": ["technologies"],
        "declining_skills": ["skills becoming less relevant"]
      },
      "benchmark_comparison": {
        "compared_to_industry_standard": "above|at|below",
        "percentile_estimate": (0-100),
        "areas_above_average": ["areas"],
        "areas_below_average": ["areas"]
      },
      "role_specific_insights": {
        "typical_career_path": ["role progression"],
        "current_position_in_path": "entry|mid|senior|executive",
        "next_logical_roles": ["potential next roles"],
        "skills_for_advancement": ["skills needed"]
      },
      "market_positioning": {
        "unique_value_proposition": "what makes this candidate unique",
        "competitive_advantages": ["advantages"],
        "potential_concerns": ["concerns"],
        "salary_range_indication": "range based on experience and skills"
      },
      "future_proofing": {
        "skills_to_develop": ["skills"],
        "certifications_recommended": ["certifications"],
        "experience_gaps_to_fill": ["gaps"],
        "networking_suggestions": ["suggestions"]
      }
    }
    `;

    const response = await this.client.getChatCompletions(
      this.deploymentName,
      [{ role: "user", content: prompt }],
      {
        temperature: 0.3,
        responseFormat: { type: "json_object" }
      }
    );

    return JSON.parse(response.choices[0].message.content);
  }

  combineAnalyses(analyses) {
    const [atsAnalysis, keyInfo, contentQuality, jobMatch] = analyses;
    
    // Calculate comprehensive scores
    const scores = this.calculateComprehensiveScores(
      atsAnalysis, 
      keyInfo, 
      contentQuality, 
      jobMatch
    );

    // Generate improvement items
    const improvements = this.generateImprovementItems(
      atsAnalysis,
      keyInfo,
      contentQuality,
      jobMatch
    );

    return {
      scores,
      detailed_analysis: {
        ats: atsAnalysis,
        information: keyInfo,
        content: contentQuality,
        job_match: jobMatch
      },
      improvements,
      executive_summary: this.generateExecutiveSummary(scores, improvements)
    };
  }

  calculateComprehensiveScores(atsAnalysis, keyInfo, contentQuality, jobMatch) {
    // Base scores from AI analysis
    const atsScore = atsAnalysis.ats_score;
    const contentScore = contentQuality.content_score;
    
    // Calculate information completeness score
    const infoScore = this.calculateInfoScore(keyInfo);
    
    // Calculate overall score with different weights
    let overallScore;
    if (jobMatch) {
      // When job description is provided, matching is most important
      overallScore = (
        jobMatch.match_score * 0.35 +
        atsScore * 0.25 +
        contentScore * 0.25 +
        infoScore * 0.15
      );
    } else {
      // Without job description, focus on general quality
      overallScore = (
        atsScore * 0.35 +
        contentScore * 0.35 +
        infoScore * 0.30
      );
    }

    return {
      overall: Math.round(overallScore),
      ats_compatibility: atsScore,
      content_quality: contentScore,
      information_completeness: infoScore,
      job_match: jobMatch ? jobMatch.match_score : null,
      breakdown: {
        formatting: Math.round(atsAnalysis.format_analysis.consistent_formatting ? 85 : 60),
        keywords: Math.round(atsAnalysis.keyword_optimization.industry_keywords_found.length * 5),
        experience: Math.round(this.calculateExperienceScore(keyInfo.experience)),
        skills: Math.round(this.calculateSkillsScore(keyInfo.skills)),
        achievements: Math.round(contentQuality.impact_analysis.quantifiable_achievements_count * 10)
      }
    };
  }

  calculateInfoScore(keyInfo) {
    let score = 0;
    const weights = {
      contact_info: 0.15,
      professional_summary: 0.20,
      experience: 0.35,
      education: 0.15,
      skills: 0.15
    };

    score += keyInfo.contact_info.completeness_score * weights.contact_info;
    score += (keyInfo.professional_summary.quality_score || 0) * weights.professional_summary;
    score += this.calculateExperienceScore(keyInfo.experience) * weights.experience;
    score += (keyInfo.education.highest_degree ? 80 : 40) * weights.education;
    score += Math.min(100, keyInfo.skills.technical_skills.length * 10) * weights.skills;

    return Math.round(score);
  }

  calculateExperienceScore(experience) {
    if (!experience.positions || experience.positions.length === 0) return 0;
    
    const avgRelevance = experience.positions.reduce((sum, pos) => 
      sum + (pos.relevance_score || 50), 0) / experience.positions.length;
    
    const achievementScore = experience.positions.reduce((sum, pos) => 
      sum + (pos.has_quantifiable_achievements ? 20 : 0), 0);
    
    const progressionScore = experience.career_progression === 'linear' ? 20 : 10;
    
    return Math.min(100, avgRelevance * 0.6 + achievementScore + progressionScore);
  }

  calculateSkillsScore(skills) {
    const technicalCount = skills.technical_skills.length;
    const softCount = skills.soft_skills.length;
    const toolsCount = skills.tools_and_technologies.length;
    
    return Math.min(100, (technicalCount * 5) + (softCount * 3) + (toolsCount * 2));
  }

  generateImprovementItems(atsAnalysis, keyInfo, contentQuality, jobMatch) {
    const improvements = [];

    // High priority ATS issues
    atsAnalysis.parsing_issues.forEach(issue => {
      if (issue.severity === 'high') {
        improvements.push({
          title: `ATS Parsing Issue: ${issue.issue}`,
          description: issue.issue,
          status: 'poor',
          actionItem: issue.fix,
          priority: 'high',
          category: 'ats'
        });
      }
    });

    // Missing critical sections
    if (atsAnalysis.format_analysis.missing_sections.length > 0) {
      improvements.push({
        title: 'Missing Critical Sections',
        description: 'Your resume is missing important sections that recruiters expect',
        status: 'poor',
        actionItem: `Add these sections: ${atsAnalysis.format_analysis.missing_sections.join(', ')}`,
        priority: 'high',
        category: 'structure'
      });
    }

    // Contact information issues
    if (!keyInfo.contact_info.has_email || !keyInfo.contact_info.has_phone) {
      improvements.push({
        title: 'Incomplete Contact Information',
        description: 'Missing essential contact details',
        status: 'poor',
        actionItem: 'Add email address and phone number to your resume header',
        priority: 'high',
        category: 'contact'
      });
    }

    // Professional summary
    if (!keyInfo.professional_summary.exists) {
      improvements.push({
        title: 'Missing Professional Summary',
        description: 'A strong summary helps recruiters quickly understand your value',
        status: 'warning',
        actionItem: 'Add a 2-3 sentence professional summary highlighting your key strengths',
        priority: 'medium',
        category: 'content'
      });
    }

    // Quantifiable achievements
    if (contentQuality.impact_analysis.quantifiable_achievements_count < 3) {
      improvements.push({
        title: 'Lack of Quantifiable Achievements',
        description: 'Your experience lacks specific, measurable accomplishments',
        status: 'warning',
        actionItem: 'Add numbers to your achievements (e.g., "Increased sales by 25%")',
        priority: 'high',
        category: 'content'
      });
    }

    // Job-specific improvements
    if (jobMatch) {
      if (jobMatch.keyword_analysis.critical_keywords_missing.length > 0) {
        improvements.push({
          title: 'Missing Critical Keywords',
          description: 'Your resume lacks keywords that are essential for this position',
          status: 'poor',
          actionItem: `Incorporate these keywords naturally: ${jobMatch.keyword_analysis.critical_keywords_missing.slice(0, 5).join(', ')}`,
          priority: 'high',
          category: 'keywords'
        });
      }

      if (jobMatch.skills_gap_analysis.required_skills_missing.length > 0) {
        improvements.push({
          title: 'Skills Gap Detected',
          description: 'You\'re missing some required skills for this position',
          status: 'warning',
          actionItem: `Highlight transferable skills or consider adding: ${jobMatch.skills_gap_analysis.required_skills_missing.slice(0, 3).join(', ')}`,
          priority: 'medium',
          category: 'skills'
        });
      }
    }

    // Content quality improvements
    contentQuality.improvements.slice(0, 3).forEach(imp => {
      improvements.push({
        title: `Improve ${imp.section}`,
        description: `Current: "${imp.current_text}"`,
        status: imp.impact === 'high' ? 'poor' : 'warning',
        actionItem: `Change to: "${imp.suggested_text}"`,
        priority: imp.impact,
        category: 'content'
      });
    });

    // Add positive feedback
    if (atsAnalysis.ats_score > 80) {
      improvements.push({
        title: 'Excellent ATS Compatibility',
        description: 'Your resume is well-optimized for applicant tracking systems',
        status: 'good',
        category: 'ats'
      });
    }

    if (contentQuality.impact_analysis.strong_action_verbs.length > 10) {
      improvements.push({
        title: 'Strong Action Verbs',
        description: 'Great use of impactful action verbs throughout your resume',
        status: 'good',
        category: 'content'
      });
    }

    return improvements.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });
  }

  generateExecutiveSummary(scores, improvements) {
    const criticalIssues = improvements.filter(i => i.status === 'poor').length;
    const warnings = improvements.filter(i => i.status === 'warning').length;
    
    let summary = `Your resume scores ${scores.overall}/100 overall. `;
    
    if (scores.overall >= 80) {
      summary += "Your resume is well-optimized and likely to perform well in ATS systems. ";
    } else if (scores.overall >= 60) {
      summary += "Your resume has a good foundation but needs some improvements to maximize success. ";
    } else {
      summary += "Your resume needs significant improvements to be competitive. ";
    }
    
    if (criticalIssues > 0) {
      summary += `Focus on fixing ${criticalIssues} critical issues first. `;
    }
    
    if (scores.job_match !== null) {
      if (scores.job_match >= 70) {
        summary += "You're a strong match for this position. ";
      } else if (scores.job_match >= 50) {
        summary += "You have relevant experience but should better align your resume with the job requirements. ";
      } else {
        summary += "Consider highlighting transferable skills and relevant experience more prominently. ";
      }
    }
    
    return summary;
  }
}

module.exports = new AzureOpenAIService();