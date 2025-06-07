const natural = require('natural');
const stopwords = require('natural/lib/natural/util/stopwords').words;

const extract = (text) => {
  // Tokenize and clean text
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(text.toLowerCase());
  
  // Remove stopwords
  const filteredTokens = tokens.filter(token => 
    !stopwords.includes(token) && token.length > 2
  );
  
  // Extract n-grams (1-3 word phrases)
  const unigrams = filteredTokens;
  const bigrams = natural.NGrams.bigrams(filteredTokens).map(bg => bg.join(' '));
  const trigrams = natural.NGrams.trigrams(filteredTokens).map(tg => tg.join(' '));
  
  // Calculate TF-IDF scores
  const tfidf = new natural.TfIdf();
  tfidf.addDocument(filteredTokens);
  
  // Get top keywords
  const keywords = [];
  tfidf.listTerms(0).forEach(item => {
    if (item.tfidf > 0.1) {
      keywords.push(item.term);
    }
  });
  
  // Add important bigrams and trigrams
  const importantPhrases = [...bigrams, ...trigrams].filter(phrase => {
    // Filter for likely skill or technical phrases
    return /\b(development|management|analysis|design|system|software|data|project|team|leadership)\b/i.test(phrase);
  });
  
  return [...new Set([...keywords, ...importantPhrases])].slice(0, 50);
};

module.exports = {
  extract
};