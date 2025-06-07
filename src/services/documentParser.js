const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const path = require('path');

const parseDocument = async (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  try {
    switch (ext) {
      case '.pdf':
        return await parsePDF(file.buffer);
      case '.docx':
      case '.doc':
        return await parseWord(file.buffer);
      case '.txt':
        return file.buffer.toString('utf-8');
      default:
        throw new Error('Unsupported file type');
    }
  } catch (error) {
    throw new Error(`Failed to parse document: ${error.message}`);
  }
};

const parsePDF = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text;
};

const parseWord = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
};

module.exports = {
  parseDocument
};